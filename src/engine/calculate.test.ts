import { describe, expect, it } from 'vitest'
import { calculate, CalculationInputError, toWeekly, type BenefitPayment, type CalculationInput } from './calculate'
import { amount, formatPounds, parsePounds } from './money'
import type { BenefitType, CouncilTaxBand } from './policy'

const scenario: CalculationInput = {
  year: '2026-27', band: 'F', payFrequency: 'weekly', grossPay: '0', incomeTax: '',
  nationalInsurance: '', employeePension: '', weeklyApplicableAmount: '100', weeklyEarningsDisregard: '',
  benefits: [],
}

function benefit(type: BenefitType, payment = '40', frequency: BenefitPayment['frequency'] = 'weekly'): BenefitPayment {
  return { type, payment, frequency }
}

function completed(input: Partial<CalculationInput> = {}) {
  const result = calculate({ ...scenario, ...input })
  if (result.status === 'insufficient') throw new Error(result.reasons.join('\n'))
  return result
}

describe('annual rates and liability', () => {
  it.each<[CouncilTaxBand, string]>([
    ['A', '£1,296.15'], ['B', '£1,512.18'], ['C', '£1,728.20'], ['D', '£1,944.23'],
    ['E', '£2,376.28'], ['F', '£2,808.33'], ['G', '£3,240.38'], ['H', '£3,888.46'],
  ])('uses the published Band %s charge of %s', (band, expected) => {
    const result = completed({ band })
    expect(formatPounds(result.annualCharge)).toBe(expected)
    expect(result.weeklyCharge.mul(365).div(7)).toEqual(result.annualCharge)
  })

  it('converts Band F liability to a week and applies the 70% ceiling and £0 scenario deduction', () => {
    const result = completed()
    expect(result.weeklyCharge.toFraction()).toBe('1965831/36500')
    expect(result.maximumWeeklyReduction.toFraction()).toBe('13760817/365000')
    expect(result.nonDependantDeduction.toFraction()).toBe('0')
  })
})

describe('payment periods and earnings', () => {
  it.each<[BenefitPayment['frequency'], string]>([
    ['weekly', '130'], ['fortnightly', '65'], ['fourWeekly', '65/2'], ['monthly', '30'],
  ])('converts a recurring %s payment to a weekly amount', (frequency, expected) => {
    expect(toWeekly(amount('130'), frequency).toFraction()).toBe(expected)
  })

  it('deducts tax, employee NI, half the workplace pension and the supplied weekly disregard', () => {
    const result = completed({
      payFrequency: 'monthly', grossPay: '1,300.00', incomeTax: '130',
      nationalInsurance: '65', employeePension: '130', weeklyEarningsDisregard: '15',
    })
    expect(result.pensionDeduction.toFraction()).toBe('65')
    expect(result.periodNet.toFraction()).toBe('1040')
    expect(result.weeklyNet.toFraction()).toBe('240')
    expect(result.assessableEarnings.toFraction()).toBe('225')
    expect(result.assessableIncome.toFraction()).toBe('225')
  })

  it('preserves fractional pennies in pension deductions and floors earnings after a disregard at zero', () => {
    const result = completed({ grossPay: '8', employeePension: '0.01', weeklyEarningsDisregard: '9' })
    expect(result.pensionDeduction.toFraction()).toBe('1/200')
    expect(result.periodNet.toFraction()).toBe('1599/200')
    expect(result.assessableEarnings.toFraction()).toBe('0')
  })

  it('withholds assessable earnings if paid earnings have no supplied disregard', () => {
    const result = calculate({ ...scenario, grossPay: '250' })
    expect(result.status).toBe('insufficient')
    expect(result.assessableEarnings).toBeNull()
    expect(result.assessableIncome).toBeNull()
    expect(result).not.toHaveProperty('weeklyReduction')
  })
})

describe('benefit treatment', () => {
  it.each<[BenefitType, string]>([
    ['carers-allowance', 'countable'], ['maternity-allowance', 'countable'], ['new-style-jsa', 'countable'],
    ['pip', 'disregarded'], ['dla', 'disregarded'], ['afip', 'disregarded'], ['attendance-allowance', 'disregarded'],
    ['child-benefit', 'disregarded'], ['housing-benefit', 'disregarded'], ['guardians-allowance', 'disregarded'],
    ['universal-credit', 'special'], ['income-support', 'special'], ['income-based-jsa', 'special'],
    ['income-related-esa', 'special'], ['contributory-esa', 'special'], ['statutory-pay', 'special'], ['other', 'unsupported'],
  ])('classifies %s as %s', (type, treatment) => {
    const result = calculate({ ...scenario, benefits: [benefit(type)] })
    expect(result.benefits[0].rule.treatment).toBe(treatment)
    if (treatment === 'countable' || treatment === 'disregarded') {
      expect(result.countableBenefits?.toFraction()).toBe(treatment === 'countable' ? '40' : '0')
      expect(result.status).toBe('potential')
    } else {
      expect(result.status).toBe('insufficient')
      expect(result.countableBenefits).toBeNull()
      expect(result.benefits[0].countable).toBeNull()
      expect(result).not.toHaveProperty('annualPayable')
    }
  })

  it('adds only countable amounts across benefits with different payment periods', () => {
    const result = completed({
      grossPay: '80', weeklyEarningsDisregard: '5',
      benefits: [benefit('maternity-allowance', '130', 'monthly'), benefit('carers-allowance', '30', 'fortnightly'), benefit('pip', '480', 'fourWeekly')],
    })
    expect(result.benefits.map(row => row.weeklyPayment.toFraction())).toEqual(['30', '15', '120'])
    expect(result.countableBenefits.toFraction()).toBe('45')
    expect(result.assessableIncome.toFraction()).toBe('120')
    expect(result.excessIncome.toFraction()).toBe('20')
  })

  it('withholds the full benefit and income totals when any assessment is unresolved', () => {
    const result = calculate({ ...scenario, benefits: [benefit('maternity-allowance'), benefit('universal-credit', '0')] })
    expect(result.status).toBe('insufficient')
    expect(result.benefits[0].countable?.toFraction()).toBe('40')
    expect(result.countableBenefits).toBeNull()
    expect(result.assessableIncome).toBeNull()
  })
})

describe('reduction and payable amounts', () => {
  it('requires an explicit applicable amount and can use an explicitly supplied zero', () => {
    const result = calculate({ ...scenario, weeklyApplicableAmount: '' })
    expect(result.status).toBe('insufficient')
    expect(result.assessableIncome?.toFraction()).toBe('0')
    expect(result.applicableAmount).toBeNull()
    expect(result).not.toHaveProperty('annualReduction')
    expect(completed({ weeklyApplicableAmount: '0' }).applicableAmount.toFraction()).toBe('0')
  })

  it.each(['0', '90', '100'])('applies no taper at £%s income with a £100 applicable amount', grossPay => {
    const result = completed({ grossPay, weeklyEarningsDisregard: '0' })
    expect(result.status).toBe('potential')
    expect(result.atApplicableAmount).toBe(grossPay === '100')
    expect(result.excessIncome.toFraction()).toBe('0')
    expect(result.taperDeduction.toFraction()).toBe('0')
    expect(result.weeklyReduction).toEqual(result.maximumWeeklyReduction)
    expect(formatPounds(result.annualReduction)).toBe('£1,965.83')
    expect(formatPounds(result.annualPayable)).toBe('£842.50')
    expect(formatPounds(result.monthlyPayable)).toBe('£70.21')
  })

  it('subtracts 25% of weekly excess income, then annualises before displaying rounded values', () => {
    const result = completed({ grossPay: '120', weeklyEarningsDisregard: '0' })
    expect(result.excessIncome.toFraction()).toBe('20')
    expect(result.taperDeduction.toFraction()).toBe('5')
    expect(result.weeklyReduction.toFraction()).toBe('11935817/365000')
    expect(result.annualReduction.toFraction()).toBe('11935817/7000')
    expect(result.annualPayable.toFraction()).toBe('7722493/7000')
    expect(formatPounds(result.annualPayable)).toBe('£1,103.21')
    expect(formatPounds(result.monthlyPayable)).toBe('£91.93')
  })

  it('uses exact precision either side of the taper cutoff and floors reduction at zero', () => {
    const below = completed({ grossPay: '250.80', weeklyEarningsDisregard: '0' })
    const above = completed({ grossPay: '250.81', weeklyEarningsDisregard: '0' })
    expect(below.status).toBe('potential')
    expect(formatPounds(below.weeklyReduction)).toBe('£0.00')
    expect(formatPounds(below.annualReduction)).toBe('£0.05')
    expect(above.status).toBe('none')
    expect(above.weeklyReduction.toFraction()).toBe('0')
    expect(above.annualReduction.toFraction()).toBe('0')
    expect(above.annualPayable).toEqual(above.annualCharge)
  })

  it('reproduces Newham’s Band C working-age couple ready-reckoner cutoff to the penny', () => {
    // Newham billing booklet 2026/27, p. 29. A is supplied from SI 2026/148, Schedule 4.
    const figures = { band: 'C' as const, weeklyApplicableAmount: '150.15', weeklyEarningsDisregard: '0' }
    expect(completed({ ...figures, grossPay: '242.95' }).status).toBe('potential')
    expect(completed({ ...figures, grossPay: '242.96' }).status).toBe('none')
  })
})

describe('input validation and money display', () => {
  it.each(['-1', '1e3', '1.001', '1,00', 'Infinity', '£10', '1/2', ''])('rejects the amount %j', input => {
    expect(parsePounds(input)).toBeNull()
  })

  it('parses grouped pounds and displays half-pennies upwards', () => {
    expect(parsePounds(' 2,808.33 ')?.toFraction()).toBe('280833/100')
    expect(formatPounds(amount('1.005'))).toBe('£1.01')
    expect(formatPounds(amount('999.995'))).toBe('£1,000.00')
    expect(formatPounds(amount('1').div(7), 6)).toBe('£0.142857')
  })

  it.each<[Partial<CalculationInput>, string]>([
    [{ band: '' }, 'band'],
    [{ year: '2025-26' as CalculationInput['year'] }, 'year'],
    [{ grossPay: '10', incomeTax: '6', nationalInsurance: '3', employeePension: '2' }, 'grossPay'],
    [{ grossPay: '10.021' }, 'grossPay'],
    [{ incomeTax: '-1' }, 'incomeTax'],
    [{ nationalInsurance: '-1' }, 'nationalInsurance'],
    [{ employeePension: '-1' }, 'employeePension'],
    [{ weeklyApplicableAmount: 'no' }, 'weeklyApplicableAmount'],
    [{ weeklyEarningsDisregard: '-5' }, 'weeklyEarningsDisregard'],
    [{ payFrequency: 'daily' as CalculationInput['payFrequency'] }, 'payFrequency'],
    [{ benefits: [{ ...benefit('pip'), type: '' }] }, 'benefit-type-0'],
    [{ benefits: [benefit('pip', '')] }, 'benefit-payment-0'],
    [{ benefits: [benefit('pip', '40', 'daily' as BenefitPayment['frequency'])] }, 'benefit-frequency-0'],
  ])('flags invalid data for %s at field %s', (overrides, field) => {
    expect(() => calculate({ ...scenario, ...overrides })).toThrow(CalculationInputError)
    expect(() => calculate({ ...scenario, ...overrides })).toThrow(expect.objectContaining({ field }))
  })
})
