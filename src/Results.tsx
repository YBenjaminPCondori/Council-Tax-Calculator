import type { ReactNode, RefObject } from 'react'
import { weeklyPaymentFactors, type CalculationResult } from './engine/calculate'
import { formatPounds, zero, type Amount } from './engine/money'
import { sources } from './engine/policy'

const statuses = {
  potential: 'Potential reduction indicated',
  none: 'No reduction under the selected assumptions',
  insufficient: 'Insufficient information for an eligibility estimate',
}

function pounds(value: Amount | null) {
  if (value === null) return 'Unavailable'
  const rounded = formatPounds(value)
  return rounded === '£0.00' && value.compare(zero) > 0 ? '< £0.01' : rounded
}

function MoneyRows({ rows }: { rows: Array<[string, Amount | null]> }) {
  return <dl className="metrics">{rows.map(([label, value]) => (
    <div key={label}><dt>{label}</dt><dd>{pounds(value)}</dd></div>
  ))}</dl>
}

export function ResultPanel({ result, headingRef }: { result: CalculationResult | null; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const complete = result?.status === 'potential' || result?.status === 'none' ? result : null
  return (
    <section className="panel result" aria-labelledby="result-heading">
      <div className="result-header">
        <h2 id="result-heading" ref={headingRef} tabIndex={-1}>Your estimate</h2>
        {result ? <p className="result-status" role="status">{statuses[result.status]}</p> : (
          <p>Enter your figures and select Calculate estimate to see your reduction and estimated bill.</p>
        )}
        {complete && (
          <div className="payable">
            <div><span>Annual Council Tax payable</span><strong>{formatPounds(complete.annualPayable)}</strong></div>
            <div><span>Monthly payable (average)</span><strong>{formatPounds(complete.monthlyPayable)}</strong></div>
          </div>
        )}
      </div>
      {result && (
        <div className="result-body">
          {result.status === 'insufficient' && (
            <div className="notice">
              <h3>More information is needed</h3>
              <ul>{result.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
            </div>
          )}
          <MoneyRows rows={[
            ['Standard annual Council Tax', result.annualCharge],
            ['Assessable earnings per week', result.assessableEarnings],
            ['Countable benefits per week', result.countableBenefits],
            ['Combined assessable income per week', result.assessableIncome],
            ['Income above the applicable amount per week', complete?.excessIncome ?? null],
            ['Maximum potential reduction per week', result.maximumWeeklyReduction],
            ['Modelled reduction per week', complete?.weeklyReduction ?? null],
            ['Modelled annual reduction', complete?.annualReduction ?? null],
          ]} />
          {complete?.atApplicableAmount && <p className="hint">Income exactly equals the applicable amount. This model applies a zero taper deduction at equality. Ask Newham Council to confirm the treatment in your case.</p>}
          {complete && <p className="hint">The annual estimate assumes the same figures throughout the year. Monthly average is one twelfth of the annual amount. Your bill sets the instalments.</p>}
        </div>
      )}
    </section>
  )
}

function detailPounds(value: Amount) {
  if (value.mul(100).d === 1n) return formatPounds(value)
  return <span title={value.toFraction() + ' pounds'}>≈{formatPounds(value, 6)}</span>
}

function Equation({ label, expression, value }: { label: string; expression?: ReactNode; value: Amount | null }) {
  return (
    <div className="equation">
      <dt>{label}</dt>
      <dd>{expression && <span>{expression} = </span>}{value === null ? 'Unavailable' : detailPounds(value)}</dd>
    </div>
  )
}

function percent(rate: Amount) {
  return `${rate.mul(100).toFraction()}%`
}

export function CalculationBreakdown({ result }: { result: CalculationResult }) {
  const { gross, tax, ni, pension } = result.earnings
  const factor = weeklyPaymentFactors[result.payFrequency].toFraction()
  return (
    <details className="panel breakdown">
      <summary>Show calculation</summary>
      <div className="breakdown-body">
        <p className="hint">Amounts are in pounds. We keep exact values in the calculation. The ≈ symbol marks values displayed to six decimal places.</p>

        <h3>Council Tax liability</h3>
        <dl>
          <Equation label="Annual band charge (CT)" value={result.annualCharge} />
          <Equation label="Weekly liability (W)" expression={<>{detailPounds(result.annualCharge)} × 7 ÷ {result.days}</>} value={result.weeklyCharge} />
          <Equation label="Weekly non-dependant deduction (N), model assumption" value={result.nonDependantDeduction} />
          <Equation label="Maximum weekly reduction" expression={<>max(£0, {percent(result.maximumRate)} × {detailPounds(result.weeklyCharge)} − {detailPounds(result.nonDependantDeduction)})</>} value={result.maximumWeeklyReduction} />
        </dl>

        <h3>Employment income</h3>
        <dl>
          <Equation label="Pension deduction for the pay period" expression={<>{percent(result.pensionRate)} × {detailPounds(pension)}</>} value={result.pensionDeduction} />
          <Equation label="Gross earnings less Income Tax, NI and pension deduction" expression={<>{detailPounds(gross)} − {detailPounds(tax)} − {detailPounds(ni)} − {detailPounds(result.pensionDeduction)}</>} value={result.periodNet} />
          <Equation label="Weekly net earnings" expression={<>{detailPounds(result.periodNet)} × {factor}</>} value={result.weeklyNet} />
          <Equation label="Weekly earnings disregard supplied" value={result.weeklyDisregard} />
          <Equation label="Assessable earnings per week" expression={result.assessableEarnings === null ? undefined : (
            <>max(£0, {detailPounds(result.weeklyNet)} − {detailPounds(result.weeklyDisregard ?? zero)})</>
          )} value={result.assessableEarnings} />
        </dl>

        <h3>Benefits and combined income</h3>
        {result.benefits.length > 0 && (
          <ul className="benefit-breakdown">{result.benefits.map(({ rule, payment, frequency, weeklyPayment, countable }, index) => (
            <li key={index}>
              <strong>{rule.label}</strong>
              <dl>
                <Equation label="Weekly payment" expression={<>{detailPounds(payment)} × {weeklyPaymentFactors[frequency].toFraction()}</>} value={weeklyPayment} />
                <Equation label={countable === null ? 'Requires further assessment' : rule.treatment === 'countable' ? 'Countable per week' : 'Disregarded, countable per week'} value={countable} />
              </dl>
              {rule.reference && <a href={`${sources.scheme}#page=${rule.page}`}>{rule.reference}</a>}
            </li>
          ))}</ul>
        )}
        <dl>
          <Equation label="Sum of countable benefits per week" value={result.countableBenefits} />
          <Equation label="Weekly assessable earnings + countable benefits (I)" expression={result.assessableEarnings !== null && result.countableBenefits !== null ? (
            <>{detailPounds(result.assessableEarnings)} + {detailPounds(result.countableBenefits)}</>
          ) : undefined} value={result.assessableIncome} />
        </dl>

        <h3>Reduction and estimated bill</h3>
        <dl>
          <Equation label="Weekly applicable amount supplied (A)" value={result.applicableAmount} />
          <div className="equation"><dt>Weekly income taper rate (t)</dt><dd>{percent(result.weeklyTaper)}</dd></div>
          {result.status === 'insufficient' ? (
            <div className="equation"><dt>Reduction and payable amounts</dt><dd>Unavailable until the missing figures are established.</dd></div>
          ) : (
            <>
              <Equation label="Excess income per week" expression={<>max(£0, {detailPounds(result.assessableIncome)} − {detailPounds(result.applicableAmount)})</>} value={result.excessIncome} />
              <Equation label="Weekly taper deduction" expression={<>{percent(result.weeklyTaper)} × {detailPounds(result.excessIncome)}</>} value={result.taperDeduction} />
              <Equation label="Modelled weekly reduction (CTR)" expression={<>max(£0, {detailPounds(result.maximumWeeklyReduction)} − {detailPounds(result.taperDeduction)})</>} value={result.weeklyReduction} />
              <Equation label="Annual reduction" expression={<>{detailPounds(result.weeklyReduction)} × {result.days} ÷ 7</>} value={result.annualReduction} />
              <Equation label="Annual payable" expression={<>max(£0, {detailPounds(result.annualCharge)} − {detailPounds(result.annualReduction)})</>} value={result.annualPayable} />
              <Equation label="Monthly average payable" expression={<>{detailPounds(result.annualPayable)} ÷ 12</>} value={result.monthlyPayable} />
            </>
          )}
        </dl>
      </div>
    </details>
  )
}
