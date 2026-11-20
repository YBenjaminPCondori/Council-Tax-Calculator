import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import { CalculationBreakdown, ResultPanel } from './Results'
import {
  benefitFrequencies, calculate, CalculationInputError, employmentFrequencies,
  type BenefitPayment, type CalculationInput, type CalculationResult,
} from './engine/calculate'
import { newhamPolicies, sources, type CouncilTaxBand, type FinancialYear } from './engine/policy'

const BandMap = lazy(() => import('../band-map/src/BandMap'))

type View = 'calculator' | 'band-map'

function currentView(): View {
  return window.location.hash === '#band-map' ? 'band-map' : 'calculator'
}

const initialInput: Omit<CalculationInput, 'benefits'> = {
  year: '2026-27', band: '', payFrequency: 'weekly', grossPay: '', incomeTax: '',
  nationalInsurance: '', employeePension: '', weeklyEarningsDisregard: '', weeklyApplicableAmount: '',
}

type BenefitRow = BenefitPayment & { id: number }
type Options = Readonly<Record<string, string>>
type Theme = 'light' | 'dark'

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
}

function Field({ id, label, value, onChange, error, hint, options, placeholder, required }: FieldProps & {
  options?: Options
  placeholder?: string
  required?: boolean
}) {
  const control = {
    id, name: id, value, required, 'aria-invalid': error ? true : undefined,
    'aria-describedby': [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {options ? (
        <select {...control} onChange={event => onChange(event.target.value)}>
          {placeholder && <option value="">{placeholder}</option>}
          {Object.entries(options).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      ) : (
        <div className="money-input">
          <span aria-hidden="true">£</span>
          <input {...control} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
            placeholder={placeholder ?? '0.00'} onChange={event => onChange(event.target.value)} />
        </div>
      )}
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  )
}

const yearOptions = Object.fromEntries(Object.entries(newhamPolicies).map(([year, policy]) => [year, policy.label]))

function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

  function changeTheme(next: Theme) {
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem('newham-ctr-theme', next)
    } catch {
      // The theme still applies to the current page.
    }
  }

  return (
    <div className="theme-picker" role="group" aria-label="Colour theme">
      <button type="button" aria-label="Light mode" aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}>Light</button>
      <button type="button" aria-label="Dark mode" aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}>Dark</button>
    </div>
  )
}

export function App() {
  const [view, setView] = useState(currentView)
  const [input, setInput] = useState(initialInput)
  const [benefits, setBenefits] = useState<BenefitRow[]>([])
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<CalculationInputError | null>(null)
  const nextId = useRef(1)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const focusBandOnReturn = useRef(false)

  useEffect(() => {
    const syncView = () => setView(currentView())
    window.addEventListener('hashchange', syncView)
    return () => window.removeEventListener('hashchange', syncView)
  }, [])

  useEffect(() => {
    document.title = view === 'band-map' ? 'Council Tax Band Map | Newham' : 'Newham Council Tax Reduction Calculator'
    if (view !== 'calculator' || !focusBandOnReturn.current) return
    const frame = requestAnimationFrame(() => {
      focusBandOnReturn.current = false
      document.getElementById('band')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [view])

  function invalidate() {
    setResult(null)
    setError(null)
  }

  function update<K extends Exclude<keyof CalculationInput, 'benefits'>>(field: K, value: CalculationInput[K]) {
    setInput(current => ({ ...current, [field]: value }))
    invalidate()
  }

  function useMapBand(band: CouncilTaxBand) {
    if (input.band !== band) update('band', band)
    focusBandOnReturn.current = true
    window.location.hash = 'calculator'
  }

  function changeBenefit(id: number, change: Partial<BenefitPayment>) {
    setBenefits(current => current.map(row => row.id === id ? { ...row, ...change } : row))
    invalidate()
  }

  function addBenefit() {
    const id = nextId.current++
    const index = benefits.length
    setBenefits(current => [...current, { id, type: '', payment: '', frequency: 'weekly' }])
    invalidate()
    requestAnimationFrame(() => document.getElementById(`benefit-type-${index}`)?.focus())
  }

  function removeBenefit(id: number, index: number) {
    setBenefits(current => current.filter(row => row.id !== id))
    invalidate()
    requestAnimationFrame(() => {
      const next = document.getElementById(`benefit-type-${index}`) ?? document.getElementById('add-benefit')
      next?.focus()
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setResult(calculate({ ...input, benefits }))
      setError(null)
      requestAnimationFrame(() => resultHeading.current?.focus())
    } catch (problem) {
      if (!(problem instanceof CalculationInputError)) throw problem
      setResult(null)
      setError(problem)
      requestAnimationFrame(() => document.getElementById(problem.field)?.focus())
    }
  }

  function errorFor(id: string) {
    return error?.field === id ? error.message : undefined
  }

  const policy = newhamPolicies[input.year]
  const bandOptions = Object.fromEntries(Object.keys(policy.annualCharges).map(band => [band, `Band ${band}`]))
  const benefitOptions = Object.fromEntries(Object.entries(policy.benefitRules).map(([id, rule]) => [id, rule.label]))

  return (
    <>
      <a className="skip" href="#main-content" onClick={event => {
        event.preventDefault()
        document.getElementById('main-content')?.focus()
      }}>Skip to content</a>
      <header className="hero">
        <div className="page">
          <div className="hero-top">
            <p className="eyebrow">{view === 'calculator' ? `Newham · Working age · ${policy.label}` : 'Newham · Beckton'}</p>
            <ThemePicker />
          </div>
          <nav className="app-navigation" aria-label="Main navigation">
            <a href="#calculator" aria-current={view === 'calculator' ? 'page' : undefined}>Calculator</a>
            <a href="#band-map" aria-current={view === 'band-map' ? 'page' : undefined}>Map visualizer</a>
          </nav>
          <h1>{view === 'calculator' ? 'Council Tax Reduction Calculator' : 'Council Tax band map'}</h1>
          <p>{view === 'calculator'
            ? 'Estimate how much your Newham Council Tax bill could be reduced using your income and an applicable amount you supply.'
            : 'Explore the flats at Woolspinners House and Softwood House on Carrack Mews.'}</p>
        </div>
      </header>

      {view === 'band-map' && (
        <main className="page map-page" id="main-content" tabIndex={-1}>
          <Suspense fallback={<p className="map-loading" role="status">Loading the band map…</p>}>
            <BandMap onUseBand={useMapBand} />
          </Suspense>
        </main>
      )}

      {view === 'calculator' && <main className="page layout" id="main-content" tabIndex={-1}>
        <form className="panel form" onSubmit={submit} noValidate autoComplete="off" aria-labelledby="figures-heading">
          <h2 id="figures-heading">Your figures</h2>
          <fieldset>
            <legend>Property</legend>
            <div className="fields two">
              <Field id="band" label="Council Tax band" value={input.band} options={bandOptions}
                required placeholder="Select a band" error={errorFor('band')}
                onChange={value => update('band', value as CalculationInput['band'])} />
              <Field id="year" label="Financial year" value={input.year} options={yearOptions}
                error={errorFor('year')} onChange={value => update('year', value as FinancialYear)} />
            </div>
            <a className="property-map-link" href="#band-map">Find a band on the map</a>
          </fieldset>

          <fieldset>
            <legend>Employment income</legend>
            <p className="section-hint">Use average figures for the same pay period. Leave unused pay fields blank for £0.</p>
            <div className="fields two">
              <Field id="payFrequency" label="Pay frequency" options={employmentFrequencies} value={input.payFrequency}
                error={errorFor('payFrequency')} onChange={value => update('payFrequency', value as CalculationInput['payFrequency'])} />
              <Field id="grossPay" label="Gross earnings" value={input.grossPay}
                error={errorFor('grossPay')} onChange={value => update('grossPay', value)} />
              <Field id="incomeTax" label="Income Tax deducted" value={input.incomeTax}
                error={errorFor('incomeTax')} onChange={value => update('incomeTax', value)} />
              <Field id="nationalInsurance" label="Employee National Insurance" value={input.nationalInsurance}
                error={errorFor('nationalInsurance')} onChange={value => update('nationalInsurance', value)} />
              <div className="wide">
                <Field id="employeePension" label="Employee pension contributions" value={input.employeePension}
                  hint="Use qualifying workplace contributions you paid from these earnings. Use gross pay after any salary sacrifice and exclude the sacrifice from this field."
                  error={errorFor('employeePension')} onChange={value => update('employeePension', value)} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Benefits</legend>
            <p className="section-hint">Add each regular award. Use the gross award before any recovery deductions.</p>
            {benefits.map(({ id, type, payment, frequency }, index) => {
              const rule = type ? policy.benefitRules[type] : null
              const treatment = rule?.treatment === 'countable' ? 'Countable' : rule?.treatment === 'disregarded' ? 'Disregarded' : 'Requires further assessment'
              return (
                <fieldset className="benefit" key={id}>
                  <legend>Benefit payment {index + 1}</legend>
                  <div className="fields two">
                    <div className="wide">
                      <Field id={`benefit-type-${index}`} label="Benefit type" required placeholder="Select a benefit" options={benefitOptions}
                        value={type} error={errorFor(`benefit-type-${index}`)}
                        onChange={value => changeBenefit(id, { type: value as BenefitPayment['type'] })} />
                    </div>
                    <Field id={`benefit-payment-${index}`} label="Payment amount" required value={payment}
                      error={errorFor(`benefit-payment-${index}`)} onChange={value => changeBenefit(id, { payment: value })} />
                    <Field id={`benefit-frequency-${index}`} label="Payment frequency" options={benefitFrequencies}
                      value={frequency} error={errorFor(`benefit-frequency-${index}`)}
                      onChange={value => changeBenefit(id, { frequency: value as BenefitPayment['frequency'] })} />
                    {rule && <p className="wide hint benefit-treatment"><strong>{treatment}.</strong> {rule.rule}</p>}
                  </div>
                  <button className="text-button" type="button" aria-label={`Remove benefit payment ${index + 1}`}
                    onClick={() => removeBenefit(id, index)}>Remove payment</button>
                </fieldset>
              )
            })}
            <button id="add-benefit" className="secondary" type="button" onClick={addBenefit}>Add a benefit</button>
          </fieldset>

          <fieldset>
            <legend>Assessment figures</legend>
            <div className="fields">
              <Field id="weeklyApplicableAmount" label="Applicable amount per week" value={input.weeklyApplicableAmount}
                placeholder="Enter an amount if known" error={errorFor('weeklyApplicableAmount')}
                hint="The applicable amount is the income allowance for your circumstances. Supply a known amount or one you want to model."
                onChange={value => update('weeklyApplicableAmount', value)} />
              <Field id="weeklyEarningsDisregard" label="Earnings disregard per week" value={input.weeklyEarningsDisregard}
                placeholder="Enter an amount if known" error={errorFor('weeklyEarningsDisregard')}
                hint="For paid work, supply the weekly amount to set aside under Schedule 7 of the scheme. Enter £0 only if your scenario assumes a zero disregard."
                onChange={value => update('weeklyEarningsDisregard', value)} />
            </div>
          </fieldset>

          <div className="submit-area">
            <button className="primary" type="submit">Calculate estimate</button>
            <p className="hint">Your figures stay in this page and clear when you reload.</p>
          </div>
        </form>

        <div className="results-column">
          <ResultPanel result={result} headingRef={resultHeading} />
          {result && <CalculationBreakdown result={result} />}
          <aside className="panel scope" aria-labelledby="scope-heading">
            <h2 id="scope-heading">What this estimate covers</h2>
            <p>This model uses the full annual band charge and assumes £0 in non-dependant deductions. Newham Council determines the final award.</p>
            <details>
              <summary>Rules that need a separate assessment</summary>
              <ul>
                <li>Household and family circumstances, including the applicable amount, earnings disregards, childcare and non-dependants.</li>
                <li>Discounts, exemptions, student status, joint liability and changes during the year.</li>
                <li>Pension-age cases, capital, residence and other eligibility checks.</li>
                <li>Universal Credit and other benefits with special rules, as well as self-employment, separate personal pensions and other income.</li>
              </ul>
            </details>
          </aside>
        </div>
      </main>}

      <footer className="page footer">
        <p>Independent calculator using Newham Council’s published figures.</p>
        <nav aria-label="Official Newham sources">
          <a href={sources.scheme}>2026–27 scheme</a>
          <a href={sources.charges}>Council Tax band charges</a>
          <a href={sources.guide}>Council guidance</a>
        </nav>
      </footer>
    </>
  )
}
