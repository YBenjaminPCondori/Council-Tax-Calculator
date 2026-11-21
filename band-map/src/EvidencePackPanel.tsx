import { useState } from "react";
import type { CSSProperties, Ref } from "react";
import { bandColour, buildings } from "./data";
import {
  candidates, comparisonDifference, evidenceChecklist, makeReviewLetter, maxComparisons, reviewGuidanceUrl,
} from "./flatEightComparisons";
import type { ComparisonCandidate } from "./flatEightComparisons";

export interface EvidencePackState {
  selected: string[];
  notes: Record<string, string>;
  letter: string | null;
}

interface Props {
  draft: EvidencePackState;
  onChange: (draft: EvidencePackState) => void;
  onToggle: (id: string) => void;
  onBack: () => void;
  heading: Ref<HTMLHeadingElement>;
}

function CandidateRow({ candidate, draft, onChange, onToggle }: Pick<Props, "draft" | "onChange" | "onToggle"> & {
  candidate: ComparisonCandidate;
}) {
  const isIncluded = draft.selected.includes(candidate.id);
  return (
    <div className="evidence-pack-candidate">
      <label>
        <input type="checkbox" checked={isIncluded}
          disabled={!isIncluded && draft.selected.length >= maxComparisons}
          onChange={() => onToggle(candidate.id)} />
        <span><strong>Flat {candidate.flat}</strong> · {candidate.epcFloorArea} m² EPC</span>
        <span className="evidence-pack-band"
          style={{ "--candidate-band": bandColour(candidate.band) } as CSSProperties}>Band {candidate.band}</span>
      </label>
      <div className="evidence-pack-links">
        <a href={candidate.valuationUrl} target="_blank" rel="noreferrer">Band record</a>
        <a href={candidate.epcUrl} target="_blank" rel="noreferrer">EPC</a>
      </div>
      {isIncluded && (
        <div className="evidence-pack-candidate-note">
          <p>{comparisonDifference(candidate)}</p>
          <label htmlFor={"evidence-note-" + candidate.id}>Age, style or design notes (optional)</label>
          <textarea id={"evidence-note-" + candidate.id} rows={2} maxLength={400} value={draft.notes[candidate.id] ?? ""}
            onChange={event => onChange({ ...draft, notes: { ...draft.notes, [candidate.id]: event.target.value } })} />
        </div>
      )}
    </div>
  );
}

export default function EvidencePackPanel({ draft, onChange, onToggle, onBack, heading }: Props) {
  const selected = candidates.filter(candidate => draft.selected.includes(candidate.id));
  const letter = draft.letter ?? makeReviewLetter(selected);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");

  async function download() {
    setWorking(true);
    setStatus("");
    try {
      const { createEvidencePackPdf } = await import("./evidencePackPdf");
      const pdf = await createEvidencePackPdf(selected, draft.notes, letter);
      const url = URL.createObjectURL(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "flat-8-woolspinners-house-evidence-pack.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus("PDF download started.");
    } catch {
      setStatus("The PDF could not be created. Try downloading again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="evidence-pack" aria-labelledby="evidence-pack-title">
      <div className="evidence-pack-intro">
        <button className="evidence-pack-secondary" type="button" onClick={onBack}>← Property evidence</button>
        <h3 id="evidence-pack-title" ref={heading} tabIndex={-1}>Prepare an evidence pack</h3>
        <p>Choose up to five nearby flats to document, check the evidence gaps and edit your draft review letter.</p>
      </div>
      <div className="evidence-pack-columns">
        <div className="evidence-pack-card">
          <h4>Comparison candidates</h4>
          <p>Flat 8 is a 126 m² top-floor flat. The lower-band flats below are 54–75 m² mid-floor flats. This makes them weak comparisons on size and floor position.</p>
          <p className="evidence-pack-count" role="status">{selected.length} of {maxComparisons} selected</p>
          {Object.values(buildings).map(building => (
            <fieldset className="evidence-pack-building" key={building.id}>
              <legend>{building.name}</legend>
              {candidates.filter(candidate => candidate.building === building.id).map(candidate => (
                <CandidateRow key={candidate.id} candidate={candidate} draft={draft} onChange={onChange} onToggle={onToggle} />
              ))}
            </fieldset>
          ))}
        </div>
        <div className="evidence-pack-review">
          <div className="evidence-pack-card">
            <h4>Evidence to gather</h4>
            <ul>{evidenceChecklist.map(item => <li key={item}>{item}</li>)}</ul>
            <a href={reviewGuidanceUrl} target="_blank" rel="noreferrer">Read the official review guidance</a>
          </div>
          <div className="evidence-pack-card">
            <div className="evidence-pack-letter-heading">
              <h4><label htmlFor="evidence-pack-letter">Draft review letter</label></h4>
              <button className="evidence-pack-secondary" type="button" disabled={draft.letter === null}
                onClick={() => onChange({ ...draft, letter: null })}>Reset letter</button>
            </div>
            {draft.letter !== null && <p>Your edits are saved while you stay on the map. If your selection changes, update the letter to match.</p>}
            <textarea id="evidence-pack-letter" rows={13} value={letter}
              onChange={event => onChange({ ...draft, letter: event.target.value })} />
          </div>
        </div>
      </div>
      <footer className="evidence-pack-footer">
        <button className="flat-evidence-use" type="button" disabled={working || !letter.trim()} onClick={download}>
          {working ? "Creating PDF…" : "Download evidence pack (PDF)"}
        </button>
        <span role="status">{status || "Draft for your review."}</span>
      </footer>
    </section>
  );
}
