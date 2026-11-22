import { describe, expect, it } from 'vitest'
import { calculate, type CalculationInput } from './engine/calculate'
import { createReceipt } from './receipt'
import { buildWalkthrough, changedQuantities, labelValue, type FormulaToken } from './walkthrough'

const example: CalculationInput = {
  year: '2026-27', band: 'F', payFrequency: 'weekly', grossPay: '125', incomeTax: '0',
  nationalInsurance: '0', employeePension: '0', weeklyEarningsDisregard: '5',
  weeklyApplicableAmount: '100', benefits: [],
}

function walkthrough(changes: Partial<CalculationInput> = {}) {
  const input = { ...example, ...changes }
  return buildWalkthrough(input, calculate(input))
}

function expression(tokens: FormulaToken[] | null) {
  return tokens?.map(token => token.subscript ? `${token.text}_${token.subscript}` : token.text).join('')
}

describe('walkthrough values and receipt', () => {
  it('substitutes the Band F worked example using the exact engine result', () => {
    const trace = walkthrough()
    expect(trace.steps).toHaveLength(6)
    expect(expression(trace.steps[0].equations[0].substituted)).toBe('W = 7 × £2,808.33 ÷ 365 ≈ £53.858384')
    expect(labelValue(trace.values.I)).toBe('£120.00')
    expect(expression(trace.steps[2].equations[0].substituted)).toBe('M = max(0, 70% × (7 × £2,808.33 ÷ 365) − £0.00) ≈ £37.700868')
    expect(labelValue(trace.values.delta)).toBe('£20.00')
    expect(labelValue(trace.values.Q)).toBe('£5.00')
    expect(expression(trace.steps[4].equations[0].symbolic)).toBe('R_w = max(0, M − τ × Δ)')
    expect(trace.summary).toMatchObject({
      status: 'Potential reduction indicated', decision: 'Yes', weeklyReduction: '£32.70', annualReduction: '£1,705.12',
      annualPayable: '£1,103.21', monthlyPayable: '£91.93', annualCharge: '£2,808.33', annualReductionPercentage: '60.72%',
    })
    expect(trace.summary?.decisions.map(decision => decision.title)).toEqual([
      'Counted income is £20.00 above the weekly allowance',
      'The taper deducts £5.00 a week',
      '£32.70 in weekly reduction remains',
    ])
  })

  it('retains the monthly pay conversion and its pension deduction', () => {
    const trace = walkthrough({
      payFrequency: 'monthly', grossPay: '650', incomeTax: '26', nationalInsurance: '13', employeePension: '52',
    })
    expect(labelValue(trace.values.E)).toBe('£135.00')
    expect(labelValue(trace.values.I)).toBe('£130.00')
    expect(expression(trace.steps[1].equations[0].substituted)).toBe('E = (12 ÷ 52) × (£650.00 − £26.00 − £13.00 − 50% × £52.00) = £135.00')
  })

  it('highlights changed quantities without attributing changes to unrelated inputs', () => {
    const original = walkthrough()
    const payUpdate = walkthrough({ grossPay: '85' })
    const bandUpdate = walkthrough({ band: 'E' })
    expect(changedQuantities(original, payUpdate)).toEqual(expect.arrayContaining(['G', 'E', 'I', 'delta', 'Q', 'Rw', 'Y']))
    expect(changedQuantities(original, payUpdate)).not.toContain('W')
    expect(changedQuantities(original, bandUpdate)).toEqual(expect.arrayContaining(['C', 'W', 'M', 'Rw', 'Y']))
    expect(changedQuantities(original, bandUpdate)).not.toContain('I')
    expect(changedQuantities(original, walkthrough({ grossPay: '125.00' }))).toEqual([])
  })

  it.each<Partial<CalculationInput>>([
    { weeklyApplicableAmount: '' },
    { weeklyEarningsDisregard: '' },
    { benefits: [{ type: 'universal-credit', payment: '50', frequency: 'weekly' }] },
  ])('does not turn an incomplete assessment into a payable result or receipt', async changes => {
    const trace = walkthrough(changes)
    expect(trace.summary).toBeNull()
    expect(trace.reasons.length).toBeGreaterThan(0)
    expect(trace.steps[0].equations[0].substituted).not.toBeNull()
    expect(trace.steps[5].equations.every(equation => equation.substituted === null)).toBe(true)
    await expect(createReceipt(trace)).rejects.toThrow('A complete estimate is required')
  })

  it('preserves the equality caveat and the zero-earnings disregard exception', () => {
    const equality = walkthrough({ grossPay: '105' })
    expect(equality.equalityNote).toContain('exactly equals')
    expect(equality.summary?.decisions.map(decision => decision.title)).toEqual([
      'Counted income matches the weekly allowance',
      'No income taper applies',
      '£37.70 in weekly reduction remains',
    ])
    const zeroEarnings = walkthrough({ grossPay: '0', weeklyEarningsDisregard: '' })
    expect(zeroEarnings.summary).not.toBeNull()
    expect(zeroEarnings.summary?.decisions[0].title).toBe('Counted income is £100.00 below the weekly allowance')
    expect(zeroEarnings.disregardSupplied).toBe(false)
    expect(labelValue(zeroEarnings.values.D)).toBe('£0.00')
  })

  it('distinguishes a small positive reduction from a taper that uses up the maximum', () => {
    expect(walkthrough({ grossPay: '255.80' }).summary).toMatchObject({ decision: 'Yes', annualReductionPercentage: '< 0.01%' })
    const fullTaper = walkthrough({ grossPay: '255.81' }).summary
    expect(fullTaper).toMatchObject({ decision: 'No', annualReductionPercentage: '0.00%' })
    expect(fullTaper?.decisions[2].title).toBe('No weekly reduction remains')
  })

  it.each(['125', '1000'])('generates a Word receipt for a complete estimate with £%s gross', async grossPay => {
    const trace = walkthrough({ grossPay })
    expect(trace.summary?.weeklyReduction).toBe(grossPay === '125' ? '£32.70' : '£0.00')
    const receipt = await createReceipt(trace)
    expect(receipt.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect([...new Uint8Array(await receipt.slice(0, 4).arrayBuffer())]).toEqual([80, 75, 3, 4])
  })
})
