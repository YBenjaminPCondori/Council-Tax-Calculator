export const sources = {
  scheme: 'https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026',
  charges: 'https://www.newham.gov.uk/council-tax/council-tax-bands-charges-appeals/1',
  guide: 'https://www.newham.gov.uk/ctrhowmuch',
} as const

export type BenefitRule = {
  label: string
  treatment: 'countable' | 'disregarded' | 'special' | 'unsupported'
  rule: string
  reference?: string
  page?: number
}

const benefitRules2026 = {
  'carers-allowance': {
    label: 'Carer’s Allowance', treatment: 'countable',
    rule: 'Use the gross recurring award. Check any carer premium and earnings disregard separately.',
    reference: 'Paragraph 54(1)–(3) and Schedule 3 paragraph 14', page: 120,
  },
  'maternity-allowance': {
    label: 'Maternity Allowance', treatment: 'countable',
    rule: 'Use the gross recurring award.', reference: 'Paragraph 54(1)–(3)', page: 120,
  },
  'new-style-jsa': {
    label: 'New Style / contribution-based Jobseeker’s Allowance', treatment: 'countable',
    rule: 'Use the gross recurring contribution-based award.',
    reference: 'Paragraph 54(1)–(3) and Schedule 8 paragraph 7', page: 120,
  },
  pip: {
    label: 'Personal Independence Payment (PIP)', treatment: 'disregarded',
    rule: 'Disregard the payment. Check any disability premium and earnings disregard separately.',
    reference: 'Schedule 8 paragraph 10', page: 289,
  },
  dla: {
    label: 'Disability Living Allowance (DLA)', treatment: 'disregarded',
    rule: 'Disregard the payment. Check any disability premium and earnings disregard separately.',
    reference: 'Schedule 8 paragraph 10', page: 289,
  },
  afip: {
    label: 'Armed Forces Independence Payment (AFIP)', treatment: 'disregarded',
    rule: 'Disregard the payment. Check any disability premium and earnings disregard separately.',
    reference: 'Schedule 8 paragraph 10', page: 289,
  },
  'attendance-allowance': {
    label: 'Attendance Allowance', treatment: 'disregarded',
    rule: 'Disregard the payment in this working-age income model. Check the applicable amount separately.',
    reference: 'Schedule 8 paragraph 13', page: 289,
  },
  'child-benefit': {
    label: 'Child Benefit', treatment: 'disregarded', rule: 'Disregard the payment.',
    reference: 'Schedule 8 paragraph 65', page: 306,
  },
  'housing-benefit': {
    label: 'Housing Benefit', treatment: 'disregarded', rule: 'Disregard the payment.',
    reference: 'Schedule 8 paragraph 41', page: 301,
  },
  'guardians-allowance': {
    label: 'Guardian’s Allowance', treatment: 'disregarded', rule: 'Disregard the payment.',
    reference: 'Schedule 8 paragraph 51', page: 303,
  },
  'universal-credit': {
    label: 'Universal Credit', treatment: 'special',
    rule: 'Newham uses DWP’s income assessment and the UC entitlement. A payment figure alone is insufficient.',
    reference: 'Paragraphs 28 and 37', page: 90,
  },
  'income-support': {
    label: 'Income Support', treatment: 'special',
    rule: 'This award can change the treatment of earnings and the rest of the applicant’s income.',
    reference: 'Schedule 7 paragraph 14 and Schedule 8 paragraph 7', page: 285,
  },
  'income-based-jsa': {
    label: 'Income-based Jobseeker’s Allowance', treatment: 'special',
    rule: 'This award can change the treatment of earnings and the rest of the applicant’s income.',
    reference: 'Schedule 7 paragraph 14 and Schedule 8 paragraph 7', page: 285,
  },
  'income-related-esa': {
    label: 'Income-related Employment and Support Allowance', treatment: 'special',
    rule: 'This award can change the treatment of earnings and the rest of the applicant’s income.',
    reference: 'Schedule 7 paragraph 14 and Schedule 8 paragraph 7', page: 285,
  },
  'contributory-esa': {
    label: 'New Style / contributory Employment and Support Allowance', treatment: 'special',
    rule: 'Newham may use the award before specified reductions. Exempt-work rules may also change the earnings disregard.',
    reference: 'Paragraph 54(4) and Schedule 7 paragraph 12', page: 120,
  },
  'statutory-pay': {
    label: 'Statutory pay from an employer', treatment: 'special',
    rule: 'Enter employer statutory sick, maternity, paternity, adoption or shared parental pay once in gross earnings. Remove this benefit row after including it there.',
    reference: 'Paragraph 51(1)(j)', page: 116,
  },
  other: {
    label: 'Other or unsure', treatment: 'unsupported',
    rule: 'The payment needs to be identified before the relevant rule and assessable amount can be established.',
  },
} as const satisfies Record<string, BenefitRule>

export const newhamPolicies = {
  '2026-27': {
    label: '2026–27',
    days: 365,
    annualCharges: {
      A: '1296.15', B: '1512.18', C: '1728.20', D: '1944.23',
      E: '2376.28', F: '2808.33', G: '3240.38', H: '3888.46',
    },
    maximumRate: '0.70', // Scheme paragraph 29(1)
    weeklyTaper: '0.25', // Paragraphs 17(f) and 32(3), seven times the daily rate
    employeePensionDeductionRate: '0.50', // Paragraph 52(3)(b)
    modelWeeklyNonDependantDeduction: '0', // Phase 1 scenario assumption
    benefitRules: benefitRules2026,
  },
} as const

export type FinancialYear = keyof typeof newhamPolicies
export type CouncilTaxBand = keyof (typeof newhamPolicies)['2026-27']['annualCharges']
export type BenefitType = keyof typeof benefitRules2026
