import { describe, expect, it } from 'vitest'
import { calculate, type CalculationInput } from './engine/calculate'
import { guidedResult } from './guidedResult'

const bandF: CalculationInput = {
  year: '2026-27', band: 'F', payFrequency: 'weekly', grossPay: '125', incomeTax: '',
  nationalInsurance: '', employeePension: '', weeklyApplicableAmount: '100',
  weeklyEarningsDisregard: '5', benefits: [],
}

describe('guided estimate summary', () => {
  it('uses the exact annual reduction and stays within the 50-word result limit', () => {
    const summary = guidedResult(calculate(bandF))!
    expect(summary).toEqual({
      verdict: 'Yes',
      percentage: '60.72% estimated reduction',
      reasons: [
        'Weekly assessable income exceeds the applicable amount by £20.',
        'A positive reduction remains after the income taper.',
      ],
    })
    expect([summary.verdict, summary.percentage, ...summary.reasons].join(' ').split(/\s+/).length).toBeLessThanOrEqual(50)
  })

  it('reports zero when the taper removes the full reduction', () => {
    expect(guidedResult(calculate({ ...bandF, grossPay: '1000' }))).toMatchObject({
      verdict: 'No', percentage: '0.00% estimated reduction',
    })
  })

  it('does not display a zero percentage for a positive estimate', () => {
    expect(guidedResult(calculate({ ...bandF, grossPay: '255.80' }))).toMatchObject({
      verdict: 'Yes', percentage: '<0.01% estimated reduction',
    })
  })

  it('does not infer a verdict when a required earnings disregard is missing', () => {
    expect(guidedResult(calculate({ ...bandF, weeklyEarningsDisregard: '' }))).toBeNull()
  })
})
