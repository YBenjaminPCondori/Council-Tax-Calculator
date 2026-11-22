import type { CalculationResult } from './engine/calculate'
import { formatPounds, zero } from './engine/money'

export function guidedResult(result: CalculationResult) {
  if (result.status === 'insufficient') return null

  const positive = result.status === 'potential'
  const percentage = formatPounds(result.annualReduction.div(result.annualCharge).mul(100)).slice(1)
  const incomeGap = result.assessableIncome.sub(result.applicableAmount)
  let reasons: string[]

  if (incomeGap.compare(zero) > 0) {
    const excess = formatPounds(incomeGap).replace(/\.00$/, '')
    const amount = excess === '£0' ? 'less than £0.01' : excess
    reasons = [
      `Weekly assessable income exceeds the applicable amount by ${amount}.`,
      positive ? 'A positive reduction remains after the income taper.' : 'The income taper removes the full estimated reduction.',
    ]
  } else if (incomeGap.equals(zero)) {
    reasons = [
      'Weekly assessable income equals the applicable amount.',
      'This estimate applies no taper at equality. Confirm the treatment with Newham Council.',
    ]
  } else {
    reasons = ['Weekly assessable income is below the applicable amount.', 'The maximum estimated reduction applies.']
  }

  return {
    verdict: positive ? 'Yes' : 'No',
    percentage: `${positive && percentage === '0.00' ? '<0.01' : percentage}% estimated reduction`,
    reasons,
  }
}
