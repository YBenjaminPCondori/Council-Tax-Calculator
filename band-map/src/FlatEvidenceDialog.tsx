import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { bandColour, buildings } from "./data";
import { flatEightEvidence as evidence } from "./flatEightEvidence";
import { createEvidenceModel, outline } from "./flatEvidenceModel";
import "./flat-evidence.css";

const building = buildings[evidence.building];
const effectiveDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" })
  .format(new Date(evidence.effectiveFrom));

function OutlinePlan() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "#254665";
      ctx.beginPath();
      for (let x = (width / 2) % 22; x < width; x += 22) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = (height / 2) % 22; y < height; y += 22) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      const scale = Math.min(width / 13, height / 10);
      ctx.beginPath();
      outline.forEach(([x, z], index) => {
        const point = [width / 2 + x * scale, height / 2 + z * scale] as const;
        if (index === 0) ctx.moveTo(...point);
        else ctx.lineTo(...point);
      });
      ctx.closePath();
      ctx.fillStyle = "#b9d6ed36";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#b9e7ff";
      ctx.shadowColor = "#6cbaff";
      ctx.shadowBlur = 13;
      ctx.stroke();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <canvas className="flat-evidence-plan" ref={canvas} role="img" aria-label="Illustrative top-down outline of Flat 8" />;
}

export default function FlatEvidenceDialog({ onDismiss, onUseBand }: { onDismiss: () => void; onUseBand: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const model = useRef<ReturnType<typeof createEvidenceModel> | null>(null);
  const [view, setView] = useState<"model" | "plan">("model");
  const [canShowModel, setCanShowModel] = useState(true);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    if (!host.current) return;
    try {
      const instance = createEvidenceModel(host.current);
      model.current = instance;
      return () => {
        model.current = null;
        instance.dispose();
      };
    } catch {
      setCanShowModel(false);
      setView("plan");
    }
  }, []);

  return (
    <dialog className="flat-evidence" ref={dialog} aria-labelledby="flat-evidence-title"
      onCancel={event => { event.preventDefault(); onDismiss(); }}>
      <header className="flat-evidence-header">
        <div>
          <h2 id="flat-evidence-title">Flat {evidence.flat} · {building.name}</h2>
          <p>{building.street}, Beckton, London {building.postcode}</p>
        </div>
        <button type="button" className="flat-evidence-close" aria-label="Close property evidence" onClick={onDismiss}>×</button>
      </header>
      <div className="flat-evidence-body">
        <section className="flat-evidence-preview" aria-label="Flat 8 outline">
          <div className="flat-evidence-switch" role="group" aria-label="Outline view">
            <button type="button" disabled={!canShowModel} aria-pressed={view === "model"}
              title={canShowModel ? undefined : "3D requires WebGL"} onClick={() => setView("model")}>3D view</button>
            <button type="button" aria-pressed={view === "plan"} onClick={() => setView("plan")}>Floor plan</button>
          </div>
          <div className="flat-evidence-model" ref={host} hidden={view !== "model"}
            aria-label="Illustrative 3D shell of Flat 8" role="img" />
          {view === "plan" && <OutlinePlan />}
          <span className="flat-evidence-caption">Illustrative outline</span>
          {view === "model" && (
            <div className="flat-evidence-controls" role="group" aria-label="3D model controls">
              <button type="button" aria-label="Rotate model left" onClick={() => model.current?.rotate(-Math.PI / 8)}>↶</button>
              <button type="button" aria-label="Rotate model right" onClick={() => model.current?.rotate(Math.PI / 8)}>↷</button>
              <button type="button" aria-label="Zoom model in" onClick={() => model.current?.zoom(1.2)}>+</button>
              <button type="button" aria-label="Zoom model out" onClick={() => model.current?.zoom(1 / 1.2)}>−</button>
              <button type="button" onClick={() => model.current?.reset()}>Reset</button>
            </div>
          )}
        </section>
        <section className="flat-evidence-record" aria-labelledby="flat-evidence-record-title">
          <h3 id="flat-evidence-record-title">Property evidence</h3>
          <div className="flat-evidence-status">
            <span className="flat-evidence-band" style={{ "--evidence-band": bandColour(evidence.band) } as CSSProperties}>
              Band {evidence.band}
            </span>
            <span>Effective <time dateTime={evidence.effectiveFrom}>{effectiveDate}</time></span>
          </div>
          <dl>
            <div><dt>EPC property type</dt><dd>{evidence.propertyType}</dd></div>
            <div><dt>EPC total floor area</dt><dd>{evidence.epcFloorArea} m²</dd></div>
            <div><dt>Effective Floor Area</dt><dd className="flat-evidence-pending">Awaiting measured plan</dd></div>
          </dl>
          <div className="flat-evidence-sources">
            <a href={evidence.valuationUrl} target="_blank" rel="noreferrer">Official band record</a>
            <a href={evidence.epcUrl} target="_blank" rel="noreferrer">Energy certificate</a>
          </div>
          <button className="flat-evidence-use" type="button" onClick={onUseBand}>Use Band {evidence.band} in calculator</button>
        </section>
      </div>
    </dialog>
  );
}
