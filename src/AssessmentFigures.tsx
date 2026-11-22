import { sources } from './engine/policy'

export const newhamClaim = 'https://www.newham.gov.uk/council-tax/council-tax-reduction-ctr-disputes-appeals'

export const assessmentFigures = {
  weeklyApplicableAmount: {
    label: 'Weekly applicable amount',
    explanation: 'The weekly income allowance Newham compares with the income it counts for your household.',
    nextStep: 'Check your Council Tax Reduction decision or ask Newham Benefits what weekly allowance applies to your household.',
    schemeUrl: `${sources.scheme}#page=241`,
    schemeLabel: 'Applicable amounts in Schedule 3 (PDF)',
  },
  weeklyEarningsDisregard: {
    label: 'Weekly earnings disregard',
    explanation: 'The part of your weekly earnings Newham leaves out after allowing for tax, National Insurance and qualifying pension contributions.',
    nextStep: 'Check your Council Tax Reduction decision or ask Newham Benefits how much of your weekly pay they would leave out.',
    schemeUrl: `${sources.scheme}#page=279`,
    schemeLabel: 'Earnings disregards in Schedule 7 (PDF)',
  },
} as const

export type AssessmentFigure = keyof typeof assessmentFigures

export function AssessmentHelp() {
  return (
    <aside className="panel assessment-help" aria-labelledby="assessment-help-heading">
      <h2 id="assessment-help-heading">Before you start</h2>
      <p>Have your Council Tax band and weekly applicable amount ready. If you have take-home pay from a job, you’ll also need your weekly earnings disregard.</p>
      <details>
        <summary>What these figures mean and where to find them</summary>
        <dl>
          {Object.values(assessmentFigures).map(figure => (
            <div key={figure.label}>
              <dt>{figure.label}</dt>
              <dd>{figure.explanation} <a href={figure.schemeUrl}>{figure.schemeLabel}</a></dd>
            </div>
          ))}
        </dl>
        <p>For example, with £125 weekly take-home pay and a £5 disregard, Newham would count £120 from pay. If your applicable amount is £100 and that is your only income, you are £20 above the allowance. These are example figures.</p>
        <p>Look for the amounts on your Council Tax Reduction decision if you have one, or <a href={newhamClaim}>contact Newham Benefits</a> to ask what figures apply to you.</p>
        <p>The estimate uses the full band charge before discounts and assumes no deduction for other adults in your home.</p>
      </details>
    </aside>
  )
}
