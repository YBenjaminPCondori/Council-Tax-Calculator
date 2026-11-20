import { amount, nonNegative, parsePounds, zero, type Amount } from './money'
import { newhamPolicies, type BenefitRule, type BenefitType, type CouncilTaxBand, type FinancialYear } from './policy'

export const employmentFrequencies = { weekly: 'Weekly', monthly: 'Monthly' } as const
export const benefitFrequencies = {
  weekly: 'Weekly', fortnightly: 'Every 2 weeks', fourWeekly: 'Every 4 weeks', monthly: 'Monthly',
} as const

type EmploymentFrequency = keyof typeof employmentFrequencies
type PaymentFrequency = keyof typeof benefitFrequencies

export const weeklyPaymentFactors = {
  weekly: amount(1), fortnightly: amount(1).div(2), fourWeekly: amount(1).div(4), monthly: amount(12).div(52),
} as const satisfies Record<PaymentFrequency, Amount>

export type BenefitPayment = { type: BenefitType | ''; payment: string; frequency: PaymentFrequency }

export type CalculationInput = {
  year: FinancialYear
  band: CouncilTaxBand | ''
  payFrequency: EmploymentFrequency
  grossPay: string
  incomeTax: string
  nationalInsurance: string
  employeePension: string
  weeklyEarningsDisregard: string // Supply the applicable amount under Schedule 7, or leave blank if unknown.
  weeklyApplicableAmount: string // Supply explicitly. An empty string means unknown.
  benefits: readonly BenefitPayment[]
}

export class CalculationInputError extends Error {
  constructor(public field: string, message: string) {
    super(message)
    this.name = 'CalculationInputError'
  }
}

function readPounds(text: string, field: string, label: string): Amount {
  const value = parsePounds(text)
  if (value === null) throw new CalculationInputError(field, `Enter ${label} in pounds with up to two decimal places.`)
  return value
}

function optionalPounds(text: string, field: string, label: string): Amount | null {
  return text.trim() === '' ? null : readPounds(text, field, label)
}

export function toWeekly(payment: Amount, frequency: PaymentFrequency): Amount {
  if (!Object.hasOwn(weeklyPaymentFactors, frequency)) throw new RangeError('Unknown payment frequency.')
  return payment.mul(weeklyPaymentFactors[frequency])
}

function assessBenefit(input: BenefitPayment, index: number, benefitRules: Readonly<Record<BenefitType, BenefitRule>>) {
  if (!input.type || !Object.hasOwn(benefitRules, input.type)) {
    throw new CalculationInputError(`benefit-type-${index}`, `Choose a benefit type for payment ${index + 1}.`)
  }
  if (!Object.hasOwn(weeklyPaymentFactors, input.frequency)) {
    throw new CalculationInputError(`benefit-frequency-${index}`, `Choose a frequency for benefit payment ${index + 1}.`)
  }
  const rule: BenefitRule = benefitRules[input.type]
  const payment = readPounds(input.payment, `benefit-payment-${index}`, `benefit payment ${index + 1}`)
  const weeklyPayment = toWeekly(payment, input.frequency)
  const countable = rule.treatment === 'countable' ? weeklyPayment : rule.treatment === 'disregarded' ? zero : null
  return { rule, payment, frequency: input.frequency, weeklyPayment, countable }
}

export type CalculationResult = ReturnType<typeof calculate>

export function calculate(input: CalculationInput) {
  if (!Object.hasOwn(newhamPolicies, input.year)) {
    throw new CalculationInputError('year', 'Choose a supported financial year.')
  }
  const policy = newhamPolicies[input.year]
  if (!input.band || !Object.hasOwn(policy.annualCharges, input.band)) {
    throw new CalculationInputError('band', 'Choose a Council Tax band.')
  }
  if (!Object.hasOwn(employmentFrequencies, input.payFrequency)) {
    throw new CalculationInputError('payFrequency', 'Choose a weekly or monthly pay frequency.')
  }

  const earnings = {
    gross: optionalPounds(input.grossPay, 'grossPay', 'gross earnings') ?? zero,
    tax: optionalPounds(input.incomeTax, 'incomeTax', 'Income Tax deducted') ?? zero,
    ni: optionalPounds(input.nationalInsurance, 'nationalInsurance', 'National Insurance deducted') ?? zero,
    pension: optionalPounds(input.employeePension, 'employeePension', 'employee pension contributions') ?? zero,
  }
  if (earnings.tax.add(earnings.ni).add(earnings.pension).compare(earnings.gross) > 0) {
    throw new CalculationInputError('grossPay', 'Income Tax, National Insurance and pension contributions together must be within gross earnings for the same pay period.')
  }
  const pensionRate = amount(policy.employeePensionDeductionRate)
  const pensionDeduction = earnings.pension.mul(pensionRate)
  const periodNet = earnings.gross.sub(earnings.tax).sub(earnings.ni).sub(pensionDeduction)
  const weeklyNet = toWeekly(periodNet, input.payFrequency)
  const weeklyDisregard = optionalPounds(input.weeklyEarningsDisregard, 'weeklyEarningsDisregard', 'the weekly earnings disregard')
  const assessableEarnings = weeklyDisregard === null && weeklyNet.compare(zero) > 0
    ? null
    : nonNegative(weeklyNet.sub(weeklyDisregard ?? zero))

  const benefits = input.benefits.map((benefit, index) => assessBenefit(benefit, index, policy.benefitRules))
  const reasons = benefits.filter(benefit => benefit.countable === null).map(({ rule }) => `${rule.label} — ${rule.rule}`)
  const countableBenefits = reasons.length > 0 ? null : benefits.reduce((sum, benefit) => sum.add(benefit.countable ?? zero), zero)
  const applicableAmount = optionalPounds(input.weeklyApplicableAmount, 'weeklyApplicableAmount', 'the weekly applicable amount')
  if (applicableAmount === null) reasons.push('Supply the weekly applicable amount for the circumstances you want to model.')
  if (assessableEarnings === null) reasons.push('Supply the applicable weekly earnings disregard to estimate assessable earnings.')

  const annualCharge = amount(policy.annualCharges[input.band])
  const weeklyCharge = annualCharge.mul(7).div(policy.days)
  const maximumRate = amount(policy.maximumRate)
  const nonDependantDeduction = amount(policy.modelWeeklyNonDependantDeduction)
  const maximumWeeklyReduction = nonNegative(weeklyCharge.mul(maximumRate).sub(nonDependantDeduction))
  const weeklyTaper = amount(policy.weeklyTaper)
  const base = {
    annualCharge, weeklyCharge, days: policy.days, maximumRate, nonDependantDeduction, maximumWeeklyReduction, weeklyTaper,
    earnings, pensionRate, pensionDeduction, periodNet, payFrequency: input.payFrequency, weeklyNet,
    weeklyDisregard, assessableEarnings, benefits, countableBenefits, applicableAmount,
  }
  if (applicableAmount === null || assessableEarnings === null || countableBenefits === null) {
    const assessableIncome = assessableEarnings !== null && countableBenefits !== null
      ? assessableEarnings.add(countableBenefits)
      : null
    return { ...base, assessableIncome, status: 'insufficient' as const, reasons }
  }

  const assessableIncome = assessableEarnings.add(countableBenefits)
  const excessIncome = nonNegative(assessableIncome.sub(applicableAmount))
  const taperDeduction = weeklyTaper.mul(excessIncome)
  const weeklyReduction = nonNegative(maximumWeeklyReduction.sub(taperDeduction))
  const annualReduction = weeklyReduction.mul(policy.days).div(7)
  const annualPayable = nonNegative(annualCharge.sub(annualReduction))

  return {
    ...base, assessableEarnings, countableBenefits, assessableIncome, applicableAmount,
    status: weeklyReduction.compare(zero) > 0 ? 'potential' as const : 'none' as const,
    excessIncome, taperDeduction, weeklyReduction, annualReduction, annualPayable, monthlyPayable: annualPayable.div(12),
    atApplicableAmount: assessableIncome.equals(applicableAmount),
  }
}
