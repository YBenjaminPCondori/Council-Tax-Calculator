import type { RefObject } from 'react'
import { amount, formatPounds } from './engine/money'
import { newhamPolicies, type CouncilTaxBand, type FinancialYear } from './engine/policy'
import { publicSources } from './walkthrough'

const valuationRanges = {
  A: 'Up to £40,000',
  B: '£40,001 to £52,000',
  C: '£52,001 to £68,000',
  D: '£68,001 to £88,000',
  E: '£88,001 to £120,000',
  F: '£120,001 to £160,000',
  G: '£160,001 to £320,000',
  H: 'More than £320,000',
} satisfies Record<CouncilTaxBand, string>

type BandGuideProps = {
  year: FinancialYear
  selected: CouncilTaxBand | ''
  headingRef: RefObject<HTMLHeadingElement | null>
  hidden: boolean
  onBack: () => void
}

export function BandGuide({ year, selected, headingRef, hidden, onBack }: BandGuideProps) {
  const { annualCharges, label } = newhamPolicies[year]
  const bandD = amount(annualCharges.D)
  const bandF = formatPounds(amount(annualCharges.F))
  const bandCheck = formatPounds(bandD.mul(13).div(9))

  return (
    <section className="panel band-guide" id="band-guide" aria-labelledby="band-guide-heading" hidden={hidden}>
      <header className="band-guide-header">
        <h2 id="band-guide-heading" ref={headingRef} tabIndex={-1}>Newham Council Tax band guide</h2>
        <button className="secondary" type="button" onClick={onBack}>Back to calculation</button>
      </header>
      <p>Use the band on your Council Tax bill or <a href={publicSources.lookup.url}>check your band by address on GOV.UK</a>.</p>
      <table>
        <caption>{label} charges include the Greater London Authority precept and are shown before discounts and Council Tax Reduction.</caption>
        <thead>
          <tr><th scope="col">Band</th><th scope="col">Value on 1 April 1991</th><th scope="col">Newham annual charge</th></tr>
        </thead>
        <tbody>
          {(Object.keys(valuationRanges) as CouncilTaxBand[]).map(band => (
            <tr key={band} data-selected={selected === band || undefined}>
              <th scope="row" aria-current={selected === band ? 'true' : undefined}>{band}</th>
              <td>{valuationRanges[band]}</td>
              <td>{formatPounds(amount(annualCharges[band]))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">As a cross-check, Band D ({formatPounds(bandD)}) × 13 ÷ 9 rounds to {bandCheck}.
        {' '}The calculator uses Newham’s published Band F charge of {bandF}.</p>
      <ul className="step-sources">
        {[publicSources.valuations, publicSources.charges, publicSources.ratios].map(source => (
          <li key={source.url}><a href={source.url}>{source.label}</a></li>
        ))}
      </ul>
    </section>
  )
}
