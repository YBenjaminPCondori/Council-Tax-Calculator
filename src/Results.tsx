import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import {
  changedQuantities, describeQuantity, labelValue, type FormulaToken, type Quantity, type Walkthrough,
} from './walkthrough'

type WalkthroughPanelProps = {
  trace: Walkthrough
  headingRef: RefObject<HTMLHeadingElement | null>
  pendingMessage?: string
  hidden: boolean
}

const playbackDelay = 6500
const highlightDuration = 1800

function Formula({ tokens, highlighted = [] }: { tokens: FormulaToken[]; highlighted?: Quantity[] }) {
  return <>{tokens.map(({ text, subscript, quantity }, index) => (
    <Fragment key={index}>
      {quantity ? <span className="formula-token" data-highlighted={highlighted.includes(quantity) || undefined}>
        {text}{subscript && <sub>{subscript}</sub>}
      </span> : text}
    </Fragment>
  ))}</>
}

function BenefitAssessment({ benefits }: { benefits: Walkthrough['benefits'] }) {
  if (benefits.length === 0) return null
  return (
    <details className="walkthrough-benefits">
      <summary>Benefit assessment</summary>
      <ul>
        {benefits.map((benefit, index) => (
          <li key={index}>
            <strong>{benefit.label}</strong>
            <p>{benefit.payment} · {benefit.frequency} · {labelValue(benefit.weeklyPayment)} per week</p>
            <p>{benefit.countable ? `Counted per week: ${labelValue(benefit.countable)}` : 'Requires further assessment'}. {benefit.detail}</p>
            {benefit.source && <a href={benefit.source.url}>{benefit.source.label}</a>}
          </li>
        ))}
      </ul>
    </details>
  )
}

export function WalkthroughPanel({ trace, headingRef, pendingMessage, hidden }: WalkthroughPanelProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [highlighted, setHighlighted] = useState<Quantity[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const previousTrace = useRef(trace)
  const step = trace.steps[stepIndex]
  const lastIndex = trace.steps.length - 1

  useEffect(() => {
    if (previousTrace.current === trace) return
    const updated = changedQuantities(previousTrace.current, trace)
    previousTrace.current = trace
    setHighlighted(updated)
    setExportError(false)
    if (updated.length === 0) return
    const timeout = window.setTimeout(() => setHighlighted([]), highlightDuration)
    return () => window.clearTimeout(timeout)
  }, [trace])

  useEffect(() => {
    if (hidden) setPlaying(false)
    if (!playing || hidden || stepIndex >= lastIndex) return
    const timeout = window.setTimeout(() => {
      setStepIndex(stepIndex + 1)
      if (stepIndex + 1 === lastIndex) setPlaying(false)
    }, playbackDelay)
    return () => window.clearTimeout(timeout)
  }, [hidden, lastIndex, playing, stepIndex])

  function selectStep(index: number) {
    setStepIndex(Math.min(lastIndex, Math.max(0, index)))
    setPlaying(false)
  }

  function onNavigationKey(event: KeyboardEvent<HTMLElement>) {
    const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (!offset) return
    event.preventDefault()
    selectStep(stepIndex + offset)
  }

  function playOrPause() {
    if (stepIndex === lastIndex) setStepIndex(0)
    setPlaying(stepIndex === lastIndex || !playing)
  }

  async function downloadReceipt() {
    if (!trace.summary || !trace.band || exporting) return
    const snapshot = trace
    setExporting(true)
    setExportError(false)
    try {
      const { createReceipt } = await import('./receipt')
      const url = URL.createObjectURL(await createReceipt(snapshot))
      const link = document.createElement('a')
      link.href = url
      link.download = `newham-ctr-${snapshot.year}-band-${snapshot.band.toLowerCase()}.docx`
      try {
        document.body.append(link)
        link.click()
      } finally {
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  const summary = trace.summary
  const pendingStatus = trace.reasons.length > 0
    ? 'Insufficient information for an eligibility estimate'
    : pendingMessage ?? 'Fill in your figures to see the estimate'
  const status = summary ? `${summary.status} (${summary.decision})` : pendingStatus
  const payables = summary ? [
    ['Original annual charge', summary.annualCharge],
    ['Weekly reduction', summary.weeklyReduction],
    ['Monthly average', summary.monthlyPayable],
  ] : []

  return (
    <section className="panel walkthrough" id="calculation-walkthrough" aria-labelledby="result-heading" hidden={hidden}>
      <h2 ref={headingRef} id="result-heading" tabIndex={-1} onFocus={() => setPlaying(false)}>Your estimate</h2>
      <div className="walkthrough-status">
        <p role="status"><strong>{status}</strong></p>
        {!summary && trace.reasons.length > 0 && <ul>{trace.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
        {summary && <>
          <dl className="annual-estimate">
            <div>
              <dt>Estimated annual bill</dt>
              <dd>{summary.annualPayable}</dd>
            </div>
            <div>
              <dt>Annual reduction</dt>
              <dd>{summary.annualReduction} <span>{summary.annualReductionPercentage} of original charge</span></dd>
            </div>
          </dl>
          <dl className="payable">
            {payables.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </>}
      </div>

      {summary && <div className="estimate-explanation">
        <h3>How the calculator reached this estimate</h3>
        <ol className="estimate-decisions">
          {summary.decisions.map(({ title, detail }) => <li key={title}>
            <strong>{title}</strong>
            <p>{detail}</p>
          </li>)}
        </ol>
        {trace.equalityNote && <p className="hint">{trace.equalityNote}</p>}
        <p className="hint">Newham Council determines the final award.</p>
      </div>}

      <details className="walkthrough-details" onToggle={event => {
        if (!event.currentTarget.open) setPlaying(false)
      }}>
        <summary>Full calculation and formulas</summary>
        <header className="walkthrough-header">
          <p className="step-count" role="status">Step {stepIndex + 1} of {trace.steps.length}</p>
        </header>

        <nav className="step-progress" aria-label="Calculation stages" onKeyDown={onNavigationKey}>
          {trace.steps.map(({ label, title, quantities, equations }, index) => {
            const updated = quantities.some(quantity => highlighted.includes(quantity)) ||
              equations.some(({ substituted }) => substituted?.some(token => token.quantity && highlighted.includes(token.quantity)))
            return <button key={title} type="button" onClick={() => selectStep(index)}
              aria-label={`Step ${index + 1}: ${label}${updated ? ' (updated)' : ''}`}
              aria-current={index === stepIndex ? 'step' : undefined}
              data-highlighted={updated || undefined}>{label}</button>
          })}
        </nav>

        <article className="walkthrough-step" key={stepIndex} aria-labelledby="walkthrough-step-title"
          onFocusCapture={() => setPlaying(false)}>
          <h3 id="walkthrough-step-title">{step.title}</h3>
          <p className="step-intro">{step.intro}</p>
          <div className="formula-block">
            {step.equations.map(({ symbolic }, index) => (
              <p className="symbolic-formula" key={index}><Formula tokens={symbolic} /></p>
            ))}
            <h4>With your figures</h4>
            {step.equations.map(({ substituted }, index) => (
              <p className="numeric-formula" key={index}>
                {substituted ? <Formula tokens={substituted} highlighted={highlighted} /> : 'Waiting for the required figures.'}
              </p>
            ))}
          </div>

          <dl className="symbol-grid">
            {step.quantities.map(quantity => {
              const symbol = describeQuantity(trace, quantity)
              return <div key={quantity} data-highlighted={highlighted.includes(quantity) || undefined}>
                <dt><span className="symbol-name"><Formula tokens={[symbol]} /></span> {symbol.label}</dt>
                <dd>{labelValue(symbol.value)}</dd>
              </div>
            })}
          </dl>

          {stepIndex === 1 && <BenefitAssessment benefits={trace.benefits} />}
          <div className="step-rationale">
            <h4>Why this step applies</h4>
            <p>{step.rationale}</p>
            {step.sources.length > 0 && <ul className="step-sources">
              {step.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}
            </ul>}
          </div>
        </article>

        <div className="walkthrough-footer">
          <div className="walkthrough-controls" role="group" aria-label="Walkthrough playback" onKeyDown={onNavigationKey}>
            <button className="secondary" type="button" disabled={stepIndex === 0} onClick={() => selectStep(stepIndex - 1)}>Previous</button>
            <button className="secondary" type="button" onClick={playOrPause}>
              {stepIndex === lastIndex ? 'Replay' : playing ? 'Pause' : 'Play'}
            </button>
            <button className="secondary" type="button" disabled={stepIndex === lastIndex} onClick={() => selectStep(stepIndex + 1)}>Next</button>
          </div>
        </div>
      </details>
      {summary && <div className="estimate-receipt">
        <button type="button" className="secondary" onClick={downloadReceipt} disabled={exporting}>
          {exporting ? 'Creating receipt…' : 'Download Word receipt'}
        </button>
      </div>}
      {exportError && <p className="error" role="alert">Could not create the Word receipt. Try downloading it again.</p>}
    </section>
  )
}
