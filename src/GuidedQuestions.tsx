import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  benefitFrequencies, employmentFrequencies, type BenefitPayment, type CalculationInput,
  type CalculationInputError, type CalculationResult,
} from './engine/calculate'
import { parsePounds } from './engine/money'
import { newhamPolicies } from './engine/policy'
import { guidedResult } from './guidedResult'

type Figures = Omit<CalculationInput, 'benefits'>
export type BenefitRow = BenefitPayment & { id: number }
type Options = Readonly<Record<string, string>>

type Question = {
  id: string
  title: string
  value: string
  hint?: string
  options?: Options
  blankAllowed?: boolean
  save: (value: string) => string | void
  remove?: () => void
}

type Props = {
  figures: Figures
  benefits: BenefitRow[]
  result: CalculationResult | null
  validationError: CalculationInputError | null
  onUpdate: <K extends keyof Figures>(key: K, value: Figures[K]) => void
  onChangeBenefit: (id: number, change: Partial<BenefitPayment>) => void
  onAddBenefit: () => void
  onRemoveBenefit: (id: number) => void
  onClearBenefits: () => void
  onReset: () => void
}

const yesNo = { yes: 'Yes', no: 'No' } as const
const years = Object.fromEntries(Object.entries(newhamPolicies).map(([key, value]) => [key, value.label]))

export function GuidedQuestions(props: Props) {
  const { figures, benefits, result, validationError, onUpdate, onChangeBenefit,
    onAddBenefit, onRemoveBenefit, onClearBenefits, onReset } = props
  const [index, setIndex] = useState(0)
  const [scope, setScope] = useState('')
  const [benefitsAnswer, setBenefitsAnswer] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const [issue, setIssue] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const policy = newhamPolicies[figures.year]
  const bandOptions = Object.fromEntries(Object.keys(policy.annualCharges).map(band => [band, `Band ${band}`]))
  const benefitOptions = Object.fromEntries(Object.entries(policy.benefitRules).map(([id, rule]) => [id, rule.label]))
  const period = figures.payFrequency

  function figure<K extends keyof Figures>(id: K, title: string, config: Omit<Partial<Question>, 'id' | 'title' | 'value' | 'save'> = {}): Question {
    return { id, title, value: figures[id], save: value => onUpdate(id, value as Figures[K]), ...config }
  }

  function navigate(next: number) {
    setIndex(next)
    setDraft(null)
    setIssue('')
  }

  const questions: Question[] = [
    {
      id: 'scope', title: 'Does this estimate fit your circumstances?', value: scope,
      hint: 'Use this for a working-age Newham case with the full band charge, no discounts and no non-dependant deductions. It covers employed earnings and supported benefits. Newham Council decides the actual award.',
      options: { ...yesNo, unknown: 'Not sure' },
      save: value => {
        setScope(value)
        if (value !== 'yes') return 'Confirm that this calculator covers your case before continuing.'
      },
    },
    figure('year', 'Which financial year are you checking?', { options: years }),
    figure('band', 'What is your Council Tax band?', {
      options: bandOptions, hint: 'Look for the band on your Council Tax bill.',
    }),
    figure('payFrequency', 'How often are you paid?', {
      options: employmentFrequencies, hint: 'If you have no employment income, choose weekly and enter £0 for gross pay.',
    }),
    figure('grossPay', `What are your ${period} gross earnings?`, {
      hint: 'Enter £0 if you have no employment income. Use pay after any salary sacrifice.',
    }),
    figure('incomeTax', `How much Income Tax is deducted ${period}?`, {
      hint: 'Leave blank if you pay none.', blankAllowed: true,
    }),
    figure('nationalInsurance', `How much employee National Insurance is deducted ${period}?`, {
      hint: 'Leave blank if you pay none.', blankAllowed: true,
    }),
    figure('employeePension', `How much do you contribute to a workplace pension ${period}?`, {
      hint: 'Use your qualifying contributions and exclude salary sacrifice. Leave blank if you pay none.', blankAllowed: true,
    }),
    {
      id: 'benefits', title: 'Do you receive any benefits?', value: benefits.length ? 'yes' : benefitsAnswer,
      options: yesNo, save: value => {
        setBenefitsAnswer(value)
        if (value === 'yes' && benefits.length === 0) onAddBenefit()
        if (value === 'no' && benefits.length > 0) onClearBenefits()
      },
    },
    ...benefits.flatMap<Question>((benefit, position) => [
      {
        id: `benefit-type-${position}`, title: `What type is benefit payment ${position + 1}?`,
        value: benefit.type, options: benefitOptions,
        save: value => {
          const type = value as keyof typeof policy.benefitRules
          onChangeBenefit(benefit.id, { type })
          const rule = policy.benefitRules[type]
          if (rule.treatment === 'special' || rule.treatment === 'unsupported') {
            return `${rule.label} needs further assessment. ${rule.rule}`
          }
        },
        remove: () => {
          onRemoveBenefit(benefit.id)
          if (benefits.length === 1) setBenefitsAnswer('no')
          navigate(benefits.length === 1 ? index - 1 : index)
        },
      },
      {
        id: `benefit-payment-${position}`, title: `How much is benefit payment ${position + 1}?`,
        value: benefit.payment, hint: 'Enter the gross award before any recovery deductions.',
        save: value => onChangeBenefit(benefit.id, { payment: value }),
      },
      {
        id: `benefit-frequency-${position}`, title: `How often is benefit payment ${position + 1} paid?`,
        value: benefit.frequency, options: benefitFrequencies,
        save: value => onChangeBenefit(benefit.id, { frequency: value as BenefitPayment['frequency'] }),
      },
    ]),
    ...(benefits.length ? [{
      id: 'more-benefits', title: 'Do you receive another benefit?', value: '', options: yesNo,
      save: (value: string) => { if (value === 'yes') onAddBenefit() },
    }] : []),
    figure('weeklyApplicableAmount', 'What is your weekly applicable amount?', {
      hint: 'Enter the income allowance that applies to your circumstances. If you are unsure, enter “unknown”.',
    }),
    figure('weeklyEarningsDisregard', 'What is your weekly earnings disregard?', {
      hint: 'Enter the amount of weekly earnings that can be set aside. Leave blank if you had no net earnings, or enter “unknown” if you are unsure.',
      blankAllowed: true,
    }),
  ]

  const question = questions[index]
  const questionId = question?.id
  useEffect(() => { heading.current?.focus() }, [questionId, benefits.length])

  function continueQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!question) return

    const answer = (draft ?? question.value).trim()
    if (question.options ? !Object.hasOwn(question.options, answer) : !answer && !question.blankAllowed) {
      setIssue(question.options ? 'Choose an answer to continue.' : 'Enter the amount before continuing.')
      return
    }
    if (!question.options && answer && parsePounds(answer) === null) {
      setIssue(answer.toLowerCase() === 'unknown'
        ? 'You’ll need this figure before an estimate is possible.'
        : 'Enter a non-negative amount in pounds with up to two decimal places.')
      return
    }
    const error = question.save(answer)
    if (error) {
      setIssue(error)
      return
    }
    navigate(question.id === 'more-benefits' && answer === 'yes' ? index : index + 1)
  }

  function startOver() {
    setScope('')
    setBenefitsAnswer('')
    onReset()
    navigate(0)
    heading.current?.focus()
  }

  const summary = result ? guidedResult(result) : null
  const incompleteField = result?.status === 'insufficient' && result.assessableEarnings === null
    ? 'weeklyEarningsDisregard'
    : undefined
  const editIndex = questions.findIndex(item => item.id === (validationError?.field ?? incompleteField))
  const title = question?.title ?? summary?.verdict ?? 'Cannot estimate yet'
  const control = {
    value: draft ?? question?.value ?? '',
    'aria-labelledby': 'guided-heading',
    'aria-describedby': [question?.hint && 'guided-hint', issue && 'guided-error'].filter(Boolean).join(' ') || undefined,
    'aria-invalid': issue ? true : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDraft(event.target.value)
      setIssue('')
    },
  }

  return (
    <section className="panel guided" aria-labelledby="guided-heading">
      <h2 ref={heading} id="guided-heading" tabIndex={-1}>{title}</h2>
      {question ? (
        <form onSubmit={continueQuestions} noValidate autoComplete="off">
          {question.hint && <p id="guided-hint" className="guided-hint">{question.hint}</p>}
          {question.id === 'band' && <p className="hint"><a href="https://www.gov.uk/council-tax-bands" target="_blank" rel="noreferrer">Find your band on GOV.UK (opens in a new tab)</a></p>}
          <div className="guided-input">
            {question.options ? (
              <select {...control}>
                <option value="">Choose an answer</option>
                {Object.entries(question.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ) : (
              <div className="money-input">
                <span aria-hidden="true">£</span>
                <input {...control} inputMode="decimal" autoComplete="off" spellCheck={false} />
              </div>
            )}
          </div>
          {issue && <p id="guided-error" className="error" role="alert">{issue}</p>}
          <div className="guided-actions">
            {index > 0 && <button type="button" className="secondary" onClick={() => navigate(index - 1)}>Back</button>}
            <button type="submit" className="primary">{index === questions.length - 1 ? 'See estimate' : 'Continue'}</button>
            {question.remove && <button type="button" className="text-button" onClick={question.remove}>Remove this payment</button>}
            {index > 0 && <button type="button" className="text-button" onClick={startOver}>Start over</button>}
          </div>
        </form>
      ) : (
        <>
          {summary ? (
            <div className="guided-verdict">
              <p className="guided-percentage">{summary.percentage}</p>
              <ul>{summary.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
            </div>
          ) : (
            <div className="guided-verdict">
              {validationError && <p className="error">{validationError.message}</p>}
              {result?.status === 'insufficient' && <ul>{result.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>}
            </div>
          )}
          <div className="guided-actions">
            <button type="button" className="secondary" onClick={() => navigate(index - 1)}>Back</button>
            {editIndex >= 0 && <button type="button" className="primary" onClick={() => navigate(editIndex)}>Correct answer</button>}
            <button type="button" className="text-button" onClick={startOver}>Start over</button>
          </div>
        </>
      )}
    </section>
  )
}
