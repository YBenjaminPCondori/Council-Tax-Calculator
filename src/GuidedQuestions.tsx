import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  benefitFrequencies, employmentFrequencies, type BenefitPayment, type CalculationInput,
} from './engine/calculate'
import { parsePounds } from './engine/money'
import { newhamPolicies, sources } from './engine/policy'
import { assessmentFigures } from './AssessmentFigures'

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
  change: (value: string) => void
  check?: { title: string; guidance: ReactNode }
}

type Props = {
  active: boolean
  figures: Figures
  benefits: BenefitRow[]
  onUpdate: <K extends keyof Figures>(key: K, value: Figures[K]) => void
  onChangeBenefit: (id: number, change: Partial<BenefitPayment>) => void
  onAddBenefit: () => void
  onRemoveBenefit: (id: number) => void
  onClearBenefits: () => void
  onReset: () => void
  onSubmit: () => void
  renderEstimate: (editAnswer: (id: string) => void) => ReactNode
}

const yesNo = { yes: 'Yes', no: 'No' } as const
const yesNoUnsure = { ...yesNo, unknown: 'Not sure' } as const
const years = Object.fromEntries(Object.entries(newhamPolicies).map(([key, value]) => [key, value.label]))

export function GuidedQuestions({
  active, figures, benefits, onUpdate, onChangeBenefit, onAddBenefit,
  onRemoveBenefit, onClearBenefits, onReset, onSubmit, renderEstimate,
}: Props) {
  const [stepId, setStepId] = useState('newham')
  const [newham, setNewham] = useState('')
  const [workingAge, setWorkingAge] = useState('')
  const [benefitsChoice, setBenefitsChoice] = useState<string | null>(null)
  const [noBenefitsConfirmed, setNoBenefitsConfirmed] = useState(false)
  const [moreBenefits, setMoreBenefits] = useState('')
  const [issue, setIssue] = useState('')
  const [checking, setChecking] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const controlRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const policy = newhamPolicies[figures.year]
  const bandOptions = Object.fromEntries(Object.keys(policy.annualCharges).map(band => [band, `Band ${band}`]))
  const benefitOptions = Object.fromEntries(Object.entries(policy.benefitRules).map(([id, rule]) => [id, rule.label]))
  const period = figures.payFrequency

  function figure<K extends keyof Figures>(id: K, title: string, config: Omit<Partial<Question>, 'id' | 'title' | 'value' | 'change'> = {}): Question {
    return { id, title, value: figures[id], change: value => onUpdate(id, value as Figures[K]), ...config }
  }

  function goTo(id: string) {
    setStepId(id)
    setIssue('')
    setChecking(false)
  }

  const questions: Question[] = [
    {
      id: 'newham', title: 'Is the home on your Council Tax bill in Newham?', value: newham,
      options: yesNoUnsure, change: setNewham,
      check: {
        title: 'Check which council bills you',
        guidance: <>Look for the council name at the top of your bill. If you don’t have it, <a href="https://www.gov.uk/find-local-council">find your council by postcode on GOV.UK</a>. This estimate uses Newham’s scheme.</>,
      },
    },
    {
      id: 'working-age', title: 'Are you below State Pension age?', value: workingAge,
      options: yesNoUnsure, change: setWorkingAge,
      check: {
        title: 'Check your State Pension age',
        guidance: <>Use your date of birth to <a href="https://www.gov.uk/state-pension-age">check your State Pension age on GOV.UK</a>. If you’ve reached that age, see <a href={sources.guide}>Newham’s guidance for pension-age residents</a>.</>,
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
      id: 'benefits', title: 'Do you receive any benefits?',
      value: benefitsChoice ?? (benefits.length ? 'yes' : noBenefitsConfirmed ? 'no' : ''),
      hint: benefits.length ? 'Choose Yes to keep the payments you’ve entered.' : undefined,
      options: yesNo, change: setBenefitsChoice,
    },
    ...benefits.flatMap<Question>((benefit, position) => [
      {
        id: `benefit-type-${position}`, title: `What type is benefit payment ${position + 1}?`,
        value: benefit.type, options: benefitOptions,
        change: value => onChangeBenefit(benefit.id, { type: value as BenefitPayment['type'] }),
      },
      {
        id: `benefit-payment-${position}`, title: `How much is benefit payment ${position + 1}?`,
        value: benefit.payment, hint: 'Enter the gross award before any recovery deductions.',
        change: value => onChangeBenefit(benefit.id, { payment: value }),
      },
      {
        id: `benefit-frequency-${position}`, title: `How often is benefit payment ${position + 1} paid?`,
        value: benefit.frequency, options: benefitFrequencies,
        change: value => onChangeBenefit(benefit.id, { frequency: value as BenefitPayment['frequency'] }),
      },
    ]),
    ...(benefits.length ? [{
      id: 'more-benefits', title: 'Do you receive another benefit?', value: moreBenefits, options: yesNo,
      change: setMoreBenefits,
    }] : []),
    figure('weeklyApplicableAmount', 'What is your weekly applicable amount?', {
      hint: assessmentFigures.weeklyApplicableAmount.explanation + ' Leave blank if you’re unsure.',
      blankAllowed: true,
    }),
    figure('weeklyEarningsDisregard', 'What is your weekly earnings disregard?', {
      hint: assessmentFigures.weeklyEarningsDisregard.explanation + ' Leave blank if you have no take-home pay or you’re unsure.',
      blankAllowed: true,
    }),
  ]

  const index = questions.findIndex(question => question.id === stepId)
  const question = stepId === 'estimate' ? undefined : questions[index] ?? questions.find(question => question.id === 'benefits')!
  const questionId = question?.id
  useEffect(() => {
    if (active && questionId) heading.current?.focus()
  }, [active, benefits.length, checking, questionId])

  function continueQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!question) return

    const answer = question.value.trim()
    let error = ''
    if (question.options ? !Object.hasOwn(question.options, answer) : !answer && !question.blankAllowed) {
      error = question.options ? 'Choose an answer to continue.' : 'Enter the amount before continuing.'
    } else if (!question.options && answer && parsePounds(answer) === null) {
      error = 'Enter a non-negative amount in pounds with up to two decimal places.'
    }
    if (error) {
      setIssue(error)
      controlRef.current?.focus()
      return
    }
    if (question.check && answer !== 'yes') {
      setChecking(true)
      return
    }

    if (question.id === 'benefits') {
      setBenefitsChoice(null)
      setNoBenefitsConfirmed(answer === 'no')
      if (answer === 'no') {
        onClearBenefits()
        goTo('weeklyApplicableAmount')
      } else {
        if (benefits.length === 0) onAddBenefit()
        goTo('benefit-type-0')
      }
      return
    }
    if (question.id === 'more-benefits' && answer === 'yes') {
      onAddBenefit()
      setMoreBenefits('')
      goTo(`benefit-type-${benefits.length}`)
      return
    }

    const next = questions[questions.indexOf(question) + 1]
    goTo(next?.id ?? 'estimate')
    if (!next) onSubmit()
  }

  function startOver() {
    setNewham('')
    setWorkingAge('')
    setBenefitsChoice(null)
    setNoBenefitsConfirmed(false)
    setMoreBenefits('')
    onReset()
    goTo('newham')
  }

  function removePayment(position: number) {
    onRemoveBenefit(benefits[position].id)
    if (benefits.length === 1) {
      setNoBenefitsConfirmed(true)
      goTo('benefits')
    } else {
      goTo(position === benefits.length - 1 ? 'more-benefits' : `benefit-type-${position}`)
    }
  }

  if (!question) {
    return (
      <>
        {active && renderEstimate(goTo)}
        <div className="guided-actions">
          <button type="button" className="secondary" onClick={() => goTo('weeklyEarningsDisregard')}>Back to answers</button>
          <button type="button" className="text-button" onClick={startOver}>Start over</button>
        </div>
      </>
    )
  }

  if (checking && question.check) {
    return (
      <section className="panel guided" aria-labelledby="guided-heading">
        <h2 ref={heading} id="guided-heading" tabIndex={-1}>{question.check.title}</h2>
        <p className="guided-hint">{question.check.guidance}</p>
        <div className="guided-actions">
          <button type="button" className="secondary" onClick={() => setChecking(false)}>Back to your answer</button>
        </div>
      </section>
    )
  }

  const previous = questions[questions.indexOf(question) - 1]
  const benefitType = question.id.startsWith('benefit-type-')
  const control = {
    value: question.value,
    'aria-labelledby': 'guided-heading',
    'aria-describedby': [question.hint && 'guided-hint', issue && 'guided-error'].filter(Boolean).join(' ') || undefined,
    'aria-invalid': issue ? true : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      question.change(event.target.value)
      setIssue('')
    },
  }

  return (
    <section className="panel guided" aria-labelledby="guided-heading">
      <h2 ref={heading} id="guided-heading" tabIndex={-1}>{question.title}</h2>
      <form onSubmit={continueQuestions} noValidate autoComplete="off">
        {question.hint && <p id="guided-hint" className="guided-hint">{question.hint}</p>}
        {question.id === 'band' && <p className="hint"><a href="https://www.gov.uk/council-tax-bands" target="_blank" rel="noreferrer">Find your band on GOV.UK (opens in a new tab)</a></p>}
        <div className="guided-input">
          {question.options ? (
            <select {...control} ref={node => { controlRef.current = node }} data-empty={question.value === '' || undefined}>
              <option value="">Choose an answer</option>
              {Object.entries(question.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          ) : (
            <div className="money-input">
              <span aria-hidden="true">£</span>
              <input {...control} ref={node => { controlRef.current = node }} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="0.00" />
            </div>
          )}
        </div>
        {issue && <p id="guided-error" className="error" role="alert">{issue}</p>}
        <div className="guided-actions">
          {previous && <button type="button" className="secondary" onClick={() => goTo(previous.id)}>Back</button>}
          <button type="submit" className="primary">{question.id === 'weeklyEarningsDisregard' ? 'See estimate' : 'Continue'}</button>
          {benefitType && <button type="button" className="text-button"
            onClick={() => removePayment(Number(question.id.slice('benefit-type-'.length)))}>Remove this payment</button>}
          {previous && <button type="button" className="text-button" onClick={startOver}>Start over</button>}
        </div>
      </form>
    </section>
  )
}
