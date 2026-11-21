import {
  Document, ExternalHyperlink, HeadingLevel, Math as WordMath, MathRun, MathSubScript,
  Packer, Paragraph, TextRun, type ParagraphChild,
} from 'docx'
import { describeQuantity, labelValue, type FormulaToken, type Walkthrough } from './walkthrough'

const font = 'Calibri'

function heading(text: string, level: typeof HeadingLevel.TITLE | typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2) {
  const size = level === HeadingLevel.TITLE ? 48 : level === HeadingLevel.HEADING_1 ? 28 : 23
  return new Paragraph({
    heading: level, keepNext: true, spacing: { before: 180, after: 70 },
    children: [new TextRun({ text, font, size, bold: true, color: '000000' })],
  })
}

function paragraph(text: string) {
  return new Paragraph({ text, spacing: { after: 85 } })
}

function maths(tokens: FormulaToken[]) {
  return new WordMath({ children: tokens.map(({ text, subscript }) => subscript
    ? new MathSubScript({ children: [new MathRun(text)], subScript: [new MathRun(subscript)] })
    : new MathRun(text)) })
}

function formula(tokens: FormulaToken[]) {
  return new Paragraph({ keepNext: true, spacing: { after: 45 }, children: [maths(tokens)] })
}

function linkedParagraph(text: string, references: { label: string; url: string }[]) {
  const children: ParagraphChild[] = text ? [new TextRun(text)] : []
  for (const { label, url } of references) {
    if (children.length > 0) children.push(new TextRun('  '))
    children.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, style: 'Hyperlink' })] }))
  }
  return new Paragraph({ children, spacing: { after: 85 } })
}

export async function createReceipt(trace: Walkthrough): Promise<Blob> {
  const { summary, values, band, yearLabel } = trace
  if (!band || !summary) throw new Error('A complete estimate is required to create a receipt.')
  const value = (quantity: keyof typeof values) => labelValue(values[quantity])

  const benefits = trace.benefits.length === 0
    ? [paragraph('No benefit payments were entered.')]
    : trace.benefits.map(benefit => linkedParagraph(
      `${benefit.label}. ${benefit.payment} paid ${benefit.frequency.toLowerCase()}. ` +
      `Weekly amount ${labelValue(benefit.weeklyPayment)}. Countable per week ${labelValue(benefit.countable)}. ${benefit.detail}`,
      benefit.source ? [benefit.source] : [],
    ))

  const doc = new Document({
    title: 'Council Tax Reduction Calculation Receipt',
    creator: 'Newham Council Tax Reduction Calculator',
    styles: { default: { document: { run: { font, size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, right: 1050, bottom: 900, left: 1050 } } },
      children: [
        heading('Council Tax Reduction Calculation Receipt', HeadingLevel.TITLE),
        paragraph(`Newham ${yearLabel} · Working age · Band ${band}`),
        new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: summary.status, bold: true })] }),
        paragraph(`Weekly reduction ${summary.weeklyReduction}. Annual reduction ${summary.annualReduction}. ` +
          `Estimated annual Council Tax payable ${summary.annualPayable}. Monthly average ${summary.monthlyPayable}.`),
        paragraph('This is an estimate. Newham Council determines the final award.'),
        heading('Figures used', HeadingLevel.HEADING_1),
        paragraph(`${trace.payFrequency} pay. Gross ${value('G')}, Income Tax ${value('T')}, ` +
          `employee National Insurance ${value('NI')}, and qualifying employee pension contributions ${value('P')}.`),
        paragraph(`Weekly applicable amount ${value('A')}. ` + (trace.disregardSupplied
          ? `Weekly earnings disregard supplied ${value('D')}.`
          : 'The earnings disregard was left blank. Zero net earnings make it immaterial to the estimate.')),
        paragraph(`Annual band charge ${value('C')}. This model assumes no discounts and a ${value('N')} weekly non-dependant deduction.`),
        ...benefits,
        heading('Calculation and reasons', HeadingLevel.HEADING_1),
        ...trace.steps.flatMap((step, index) => [
          heading(`${index + 1}  ${step.title}`, HeadingLevel.HEADING_2),
          ...step.equations.flatMap(({ symbolic, substituted }) => [
            formula(symbolic), ...(substituted ? [formula(substituted)] : []),
          ]),
          new Paragraph({
            spacing: { after: 75 },
            children: step.quantities.flatMap((quantity, position) => {
              const symbol = describeQuantity(trace, quantity)
              return [
                ...(position > 0 ? [new TextRun('  ·  ')] : []),
                maths([symbol]), new TextRun(` ${symbol.label} ${labelValue(symbol.value)}`),
              ]
            }),
          }),
          linkedParagraph(step.rationale, step.sources),
        ]),
        paragraph('The calculation uses unrounded intermediate values. The symbol ≈ marks rounded values, and final amounts are shown to the nearest penny.'),
      ],
    }],
  })
  return Packer.toBlob(doc)
}
