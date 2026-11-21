import { benefitFrequencies, employmentFrequencies, type CalculationInput, type CalculationResult } from './engine/calculate'
import { amount, formatPounds, zero, type Amount } from './engine/money'
import { newhamPolicies, sources } from './engine/policy'

type SymbolDefinition = { text: string; label: string; subscript?: string }

const symbols = {
  C: { text: 'C', label: 'Annual liability before CTR' },
  d: { text: 'd', label: 'Days in the financial year' },
  W: { text: 'W', label: 'Weekly Council Tax liability' },
  G: { text: 'G', label: 'Gross earnings per pay period' },
  T: { text: 'T', label: 'Income Tax per pay period' },
  NI: { text: 'NI', label: 'Employee National Insurance per pay period' },
  P: { text: 'P', label: 'Employee pension contribution per pay period' },
  r: { text: 'r', label: 'Share of pension contribution deducted' },
  k: { text: 'k', label: 'Factor to convert pay to a weekly amount' },
  E: { text: 'E', label: 'Weekly net earnings' },
  Ea: { text: 'E', subscript: 'a', label: 'Assessable weekly earnings after the disregard' },
  D: { text: 'D', label: 'Weekly earnings disregard' },
  B: { text: 'B', label: 'Countable weekly benefits' },
  I: { text: 'I', label: 'Weekly assessable income' },
  A: { text: 'A', label: 'Weekly applicable amount' },
  N: { text: 'N', label: 'Weekly non-dependant deduction assumed' },
  rho: { text: 'ρ', label: 'Working-age maximum reduction rate' },
  M: { text: 'M', label: 'Maximum weekly reduction' },
  delta: { text: 'Δ', label: 'Weekly income above the applicable amount' },
  tau: { text: 'τ', label: 'Weekly taper rate' },
  Q: { text: 'Q', label: 'Weekly taper deduction' },
  Rw: { text: 'R', subscript: 'w', label: 'Modelled weekly reduction' },
  Ra: { text: 'R', subscript: 'a', label: 'Modelled annual reduction' },
  Y: { text: 'Y', label: 'Estimated annual payable' },
  Ym: { text: 'Y', subscript: 'm', label: 'Estimated monthly average' },
} satisfies Record<string, SymbolDefinition>

export type Quantity = keyof typeof symbols
export type FormulaToken = { text: string; subscript?: string; quantity?: Quantity }
type Operand = string | { quantity: Quantity }
type DisplayValue = { text: string; exact: string; approximate?: boolean }
type Values = Record<Quantity, DisplayValue | null>
type Source = { label: string; url: string }

function exact(text: string): DisplayValue {
  return { text, exact: text }
}

function money(value: Amount | null | undefined): DisplayValue | null {
  if (value == null) return null
  const approximate = value.mul(100).d !== 1n
  return { text: formatPounds(value, approximate ? 6 : 2), exact: value.toFraction(), approximate }
}

function percent(rate: Amount): DisplayValue {
  return exact(`${rate.mul(100).toFraction()}%`)
}

function displayMoney(value: Amount): string {
  const rounded = formatPounds(value)
  return rounded === '£0.00' && value.compare(zero) > 0 ? '< £0.01' : rounded
}

function variable(quantity: Quantity): FormulaToken {
  const { text, subscript } = symbols[quantity] as SymbolDefinition
  return { text, subscript, quantity }
}

function ref(quantity: Quantity) {
  return { quantity }
}

function equation(values: Values, result: Quantity, rhs: Operand[], substitution = rhs) {
  const symbolic = [variable(result), { text: ' = ' }, ...rhs.map(operand =>
    typeof operand === 'string' ? { text: operand } : variable(operand.quantity))]
  const calculated = values[result]
  const inputs = substitution.map(operand => typeof operand === 'string' ? exact(operand) : values[operand.quantity])
  if (!calculated || inputs.some(input => input === null)) return { symbolic, substituted: null }

  const approximate = inputs.some(input => input?.approximate)
  const numeric = substitution.map<FormulaToken>(operand => typeof operand === 'string'
    ? { text: operand }
    : { text: values[operand.quantity]!.text, quantity: operand.quantity })
  return {
    symbolic,
    substituted: [
      variable(result), { text: approximate ? ' ≈ ' : ' = ' }, ...numeric,
      { text: approximate || calculated.approximate ? ' ≈ ' : ' = ' },
      { text: calculated.text, quantity: result },
    ],
  }
}

type Stage = {
  title: string
  intro: string
  rationale: string
  equations: Array<ReturnType<typeof equation>>
  quantities: Quantity[]
  sources: Source[]
}

export const publicSources = {
  charges: { label: 'Newham 2026–27 charges', url: 'https://www.newham.gov.uk/downloads/file/10583/billing-booklet-2026-27#page=10' },
  ratios: { label: 'Statutory band ratios', url: 'https://www.legislation.gov.uk/ukpga/1992/14/section/5' },
  valuations: { label: 'Valuation Office guidance', url: 'https://www.gov.uk/guidance/understand-how-council-tax-bands-are-assessed' },
  lookup: { label: 'Check your band on GOV.UK', url: 'https://www.gov.uk/council-tax-bands' },
} satisfies Record<string, Source>

function scheme(page: number, label: string): Source {
  return { label, url: `${sources.scheme}#page=${page}` }
}

export function buildWalkthrough(input: CalculationInput, result: CalculationResult | null) {
  const policy = newhamPolicies[input.year]
  const complete = result && result.status !== 'insufficient' ? result : null
  const hasZeroNet = result?.weeklyNet.equals(zero) ?? false
  const values: Values = {
    C: money(result?.annualCharge ?? (input.band ? amount(policy.annualCharges[input.band]) : null)),
    d: exact(String(policy.days)), W: money(result?.weeklyCharge),
    G: money(result?.earnings.gross), T: money(result?.earnings.tax), NI: money(result?.earnings.ni),
    P: money(result?.earnings.pension), r: percent(result?.pensionRate ?? amount(policy.employeePensionDeductionRate)),
    k: exact(input.payFrequency === 'weekly' ? '1' : '(12 ÷ 52)'), E: money(result?.weeklyNet),
    Ea: money(result?.assessableEarnings),
    D: money(result?.weeklyDisregard ?? (hasZeroNet ? zero : null)), B: money(result?.countableBenefits),
    I: money(result?.assessableIncome), A: money(result?.applicableAmount),
    N: money(result?.nonDependantDeduction ?? amount(policy.modelWeeklyNonDependantDeduction)),
    rho: percent(result?.maximumRate ?? amount(policy.maximumRate)), M: money(result?.maximumWeeklyReduction),
    delta: money(complete?.excessIncome), tau: percent(result?.weeklyTaper ?? amount(policy.weeklyTaper)),
    Q: money(complete?.taperDeduction), Rw: money(complete?.weeklyReduction), Ra: money(complete?.annualReduction),
    Y: money(complete?.annualPayable), Ym: money(complete?.monthlyPayable),
  }

  const summary = complete ? {
    status: complete.status === 'potential' ? 'Potential reduction indicated' : 'No reduction under the selected assumptions',
    weeklyReduction: displayMoney(complete.weeklyReduction), annualReduction: displayMoney(complete.annualReduction),
    annualPayable: displayMoney(complete.annualPayable), monthlyPayable: displayMoney(complete.monthlyPayable),
  } : null
  const equalityNote = complete?.atApplicableAmount
    ? 'Income exactly equals the applicable amount. This model uses a zero taper deduction at equality. Ask Newham Council to confirm the treatment in your case.'
    : null

  const steps: Stage[] = [
    {
      title: 'Find the weekly liability',
      intro: 'Start with the annual Council Tax liability before Council Tax Reduction.',
      rationale: 'The scheme uses liability after any other applicable discounts. This estimate assumes no discounts and uses Newham’s full band charge. Divide by the days in the financial year and multiply by seven.',
      equations: [equation(values, 'W', ['7 × ', ref('C'), ' ÷ ', ref('d')])],
      quantities: ['C', 'd', 'W'], sources: [publicSources.charges, scheme(69, 'Scheme paragraph 29(1)')],
    },
    {
      title: 'Work out weekly assessable income',
      intro: 'Convert net pay to a weekly amount, apply the earnings disregard, and add countable benefits.',
      rationale: `Net earnings deduct Income Tax, employee National Insurance, and half of qualifying workplace pension contributions. ${result && hasZeroNet && !result.weeklyDisregard ? 'With zero net earnings, an earnings disregard does not affect the calculation.' : 'The model uses the weekly earnings disregard you supply.'}`,
      equations: [
        equation(values, 'E', [ref('k'), ' × (', ref('G'), ' − ', ref('T'), ' − ', ref('NI'), ' − ', ref('r'), ' × ', ref('P'), ')']),
        equation(values, 'I', ['max(0, ', ref('E'), ' − ', ref('D'), ') + ', ref('B')]),
      ],
      quantities: ['G', 'T', 'NI', 'P', 'r', 'k', 'E', 'D', 'Ea', 'B', 'I'],
      sources: [scheme(114, 'Paragraphs 50, 52 and 54'), scheme(279, 'Schedule 7 earnings disregards')],
    },
    {
      title: 'Set the maximum reduction',
      intro: 'Apply the working-age maximum rate to the weekly liability before the income taper.',
      rationale: 'The model assumes a £0 non-dependant deduction. An actual assessment considers whether anyone living with the applicant affects the deduction.',
      equations: [equation(values, 'M', ['max(0, ', ref('rho'), ' × ', ref('W'), ' − ', ref('N'), ')'],
        ['max(0, ', ref('rho'), ' × (7 × ', ref('C'), ' ÷ ', ref('d'), ') − ', ref('N'), ')'])],
      quantities: ['rho', 'W', 'N', 'M'], sources: [scheme(69, 'Paragraph 29(1)')],
    },
    {
      title: 'Apply the income taper',
      intro: 'Only weekly income above the applicable amount attracts the taper.',
      rationale: equalityNote ?? 'The estimate uses the applicable amount you supply. The weekly taper is equivalent to applying the scheme’s daily taper across seven days.',
      equations: [
        equation(values, 'delta', ['max(0, ', ref('I'), ' − ', ref('A'), ')']),
        equation(values, 'Q', [ref('tau'), ' × ', ref('delta')]),
      ],
      quantities: ['I', 'A', 'delta', 'tau', 'Q'], sources: [scheme(46, 'Paragraph 17(f)'), scheme(65, 'Paragraphs 26–28')],
    },
    {
      title: 'Calculate the weekly reduction',
      intro: 'Subtract the taper deduction from the maximum weekly reduction, down to a minimum of £0.',
      rationale: complete?.status === 'potential'
        ? 'A positive weekly reduction remains, so the calculator indicates a potential reduction. Newham Council determines the final award.'
        : complete?.status === 'none'
          ? 'The taper leaves a weekly reduction of zero under the figures supplied.'
          : 'The estimate needs all required figures and any benefits that require separate assessment resolved.',
      equations: [equation(values, 'Rw', ['max(0, ', ref('M'), ' − ', ref('tau'), ' × ', ref('delta'), ')'])],
      quantities: ['M', 'Q', 'tau', 'delta', 'Rw'], sources: [scheme(85, 'Paragraph 32(3)')],
    },
    {
      title: 'See the estimated bill',
      intro: 'Convert the weekly reduction to an annual amount and take it off the annual liability.',
      rationale: 'The annual estimate assumes the same figures throughout the financial year. The monthly figure is a twelve-month average. Your bill sets the instalments.',
      equations: [
        equation(values, 'Ra', [ref('Rw'), ' × ', ref('d'), ' ÷ 7']),
        equation(values, 'Y', ['max(0, ', ref('C'), ' − ', ref('Ra'), ')']),
        equation(values, 'Ym', [ref('Y'), ' ÷ 12']),
      ],
      quantities: ['C', 'd', 'Rw', 'Ra', 'Y', 'Ym'], sources: [],
    },
  ]

  return {
    year: input.year, yearLabel: policy.label, band: input.band,
    payFrequency: employmentFrequencies[input.payFrequency], summary, values, steps,
    equalityNote, disregardSupplied: result?.weeklyDisregard != null,
    reasons: result?.status === 'insufficient' ? result.reasons : [],
    benefits: result?.benefits.map(({ rule, payment, frequency, weeklyPayment, countable }) => ({
      label: rule.label, detail: rule.rule, payment: formatPounds(payment), frequency: benefitFrequencies[frequency],
      weeklyPayment: money(weeklyPayment)!, countable: money(countable),
      source: rule.reference && rule.page ? scheme(rule.page, rule.reference) : null,
    })) ?? [],
  }
}

export type Walkthrough = ReturnType<typeof buildWalkthrough>

export function describeQuantity(trace: Walkthrough, quantity: Quantity) {
  return { ...variable(quantity), label: symbols[quantity].label, value: trace.values[quantity] }
}

export function labelValue(value: DisplayValue | null): string {
  return value ? `${value.approximate ? '≈ ' : ''}${value.text}` : 'Unavailable'
}

export function changedQuantities(previous: Walkthrough, next: Walkthrough): Quantity[] {
  return (Object.keys(next.values) as Quantity[]).filter(quantity => {
    const current = next.values[quantity]
    return current !== null && current.exact !== previous.values[quantity]?.exact
  })
}
