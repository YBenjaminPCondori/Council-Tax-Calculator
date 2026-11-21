import { PDFDocument, PDFString, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import { buildings, flatAddress } from "./data";
import {
  comparisonDifference, evidenceChecklist, reviewGuidanceUrl, subjectAddress, subjectEffectiveDate,
} from "./flatEightComparisons";
import type { ComparisonCandidate } from "./flatEightComparisons";
import { flatEightEvidence as subject } from "./flatEightEvidence";

const width = 595.28;
const height = 841.89;
const margin = 48;
const navy = rgb(.07, .17, .28);
const muted = rgb(.28, .36, .45);
const blue = rgb(.08, .30, .54);

function wrap(text: string, font: PDFFont, size: number) {
  const maxWidth = width - 2 * margin;
  const supported = new Set(font.getCharacterSet());
  const safe = Array.from(text.normalize("NFC").replace(/\t/g, " "), char =>
    char === "\n" || supported.has(char.codePointAt(0)!) ? char : "?",
  ).join("");
  return safe.replace(/\r\n?/g, "\n").split("\n").flatMap(paragraph => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const trial = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        line = trial;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
    return lines;
  });
}

export async function createEvidencePackPdf(
  selected: readonly ComparisonCandidate[], notes: Readonly<Record<string, string>>, letter: string,
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Council Tax evidence pack – Flat 8, Woolspinners House");
  pdf.setSubject("Draft for a Council Tax band review");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([width, height]);
  let y = height - margin;

  function nextPage() {
    page = pdf.addPage([width, height]);
    y = height - margin;
  }

  function ensure(points: number) {
    if (y - points < margin + 12) nextPage();
  }

  function paragraph(value: string, { font = normal, size = 10.5, colour = navy, after = 5 } = {}) {
    const lineHeight = size * 1.4;
    for (const line of wrap(value, font, size)) {
      ensure(lineHeight);
      if (line) page.drawText(line, { x: margin, y: y - size, size, font, color: colour });
      y -= lineHeight;
    }
    y -= after;
  }

  function heading(value: string) {
    ensure(48);
    y -= 10;
    paragraph(value, { font: bold, size: 13, after: 4 });
  }

  function sources(links: readonly { name: string; url: string }[]) {
    const size = 9;
    ensure(19);
    let x = margin;
    for (const { name, url } of links) {
      const yText = y - size;
      page.drawText(name, { x, y: yText, size, font: normal, color: blue });
      const right = x + normal.widthOfTextAtSize(name, size);
      page.drawLine({ start: { x, y: yText - 1.5 }, end: { x: right, y: yText - 1.5 }, thickness: .55, color: blue });
      const link = pdf.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [x, yText - 3, right, yText + size + 2],
        Border: [0, 0, 0],
        A: { S: "URI", URI: PDFString.of(url) },
      });
      const ref = pdf.context.register(link);
      page.node.addAnnot(ref);
      x = right + 16;
    }
    y -= 18;
  }

  const generatedDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date());
  paragraph("DRAFT FOR REVIEW   /   " + generatedDate, { font: bold, size: 9, colour: blue });
  paragraph("Council Tax evidence pack", { font: bold, size: 26, after: 6 });
  paragraph(subjectAddress, { size: 12, colour: muted });
  y -= 5;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: blue });

  heading("Property under review");
  paragraph("Current band: " + subject.band + "  |  Effective from: " + subjectEffectiveDate + "  |  Local authority: Newham");
  paragraph("EPC property type: " + subject.propertyType + "  |  EPC total floor area: " + subject.epcFloorArea + " m²");
  paragraph("Effective Floor Area: Awaiting measured plan");
  sources([{ name: "Official band record", url: subject.valuationUrl }, { name: "Energy certificate", url: subject.epcUrl }]);

  heading("Nearby lower-band comparison candidates");
  paragraph("The 14 identified candidates are 54–75 m² mid-floor flats. Flat 8 is a 126 m² top-floor flat. The differences in size and floor position make these weak comparisons.", { colour: muted });
  if (!selected.length) paragraph("No candidates selected.", { colour: muted });
  for (const candidate of selected) {
    ensure(75);
    paragraph(flatAddress(buildings[candidate.building], candidate.flat) + "  |  Band " + candidate.band, { font: bold, after: 2 });
    paragraph(candidate.propertyType + "  |  " + candidate.epcFloorArea + " m² EPC total floor area", { after: 1 });
    paragraph(comparisonDifference(candidate), { after: 3, colour: muted });
    const note = notes[candidate.id]?.trim();
    if (note) paragraph("User notes on age, style or design: " + note, { colour: muted });
    sources([{ name: "Official band record", url: candidate.valuationUrl }, { name: "Energy certificate", url: candidate.epcUrl }]);
  }

  heading("Evidence checklist");
  evidenceChecklist.forEach(item => paragraph("[ ]  " + item));
  sources([{ name: "GOV.UK Council Tax review guidance", url: reviewGuidanceUrl }]);

  nextPage();
  paragraph("DRAFT FOR REVIEW", { font: bold, size: 9, colour: blue });
  paragraph("Council Tax review letter", { font: bold, size: 24, after: 18 });
  paragraph(letter.replace(/\r\n?/g, "\n"), { size: 11 });

  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawLine({ start: { x: margin, y: 37 }, end: { x: width - margin, y: 37 }, thickness: .65, color: muted });
    const footer = (index + 1) + " / " + pages.length;
    sheet.drawText("Flat 8 · Woolspinners House", { x: margin, y: 23, size: 8.5, font: normal, color: muted });
    sheet.drawText(footer, {
      x: width - margin - normal.widthOfTextAtSize(footer, 8.5), y: 23, size: 8.5, font: normal, color: muted,
    });
  });
  return pdf.save();
}
