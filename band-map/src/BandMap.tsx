import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SiteMap } from "./SiteMap";
import { flatEightEvidence } from "./flatEightEvidence";
import {
  bandColour, bandColours, bandLabel, buildingIds, buildings, exampleRoomCounts, flatAddress, flatsFromFront, loadBands,
} from "./data";
import type { Band, BandData, BuildingId } from "./data";
import "./styles.css";

type Mode = "map" | "building";
const BuildingView = lazy(() => import("./BuildingView").then(({ BuildingView }) => ({ default: BuildingView })));

const FlatEvidenceDialog = lazy(() => import("./FlatEvidenceDialog"));

function Icon({ name, size = 17 }: { name: "map" | "building" | "pin" | "levels" | "cube"; size?: number }) {
  const paths = {
    map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15",
    building: "M4 21V5l8-2 8 2v16H4zm4-12h1m6 0h1m-8 4h1m6 0h1m-7 8v-4h4v4",
    pin: "M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0zm-7 2.1a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2z",
    levels: "M3 8l9-5 9 5-9 5-9-5zm0 4.5 9 5 9-5m-18 4.5 9 5 9-5",
    cube: "M12 2 3.5 7v10l8.5 5 8.5-5V7L12 2zm0 10v10M3.5 7 12 12l8.5-5",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}

function Legend({ counts }: { counts: Readonly<Record<string, number>> }) {
  return (
    <section className="band-legend" aria-label="Council Tax band key">
      <h2>Band key</h2>
      <div className="legend-swatches">
        {(Object.keys(bandColours) as Band[]).map(band => (
          <span className="legend-chip" key={band} style={{ "--chip": bandColour(band) } as CSSProperties}
            title={`Band ${band}: ${counts[band] ?? 0} flats in this building`}>
            <span>{band}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

export default function BandMap({ onUseBand }: { onUseBand: (band: Band) => void }) {
  const [mode, setMode] = useState<Mode>("map");
  const [active, setActive] = useState<BuildingId>("woolspinners");
  const [hovered, setHovered] = useState<number | null>(null);
  const [flat, setFlat] = useState<number | null>(null);
  const [data, setData] = useState<BandData | null>(null);
  const [error, setError] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const map = useRef<HTMLDivElement>(null);
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null);
  const building = buildings[active];

  useEffect(() => {
    const request = new AbortController();
    loadBands(request.signal).then(setData).catch((failure: unknown) => {
      if (request.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : "The band data could not be loaded.");
    });
    return () => request.abort();
  }, []);

  const counts: Record<string, number> = {};
  if (data) {
    Object.values(data[active]).forEach(band => {
      const key = band ?? "Unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    });
  }

  function changeBuilding(id: BuildingId) {
    if (id !== active || mode !== "building") {
      setFlat(null);
      setHovered(null);
    }
    setActive(id);
    setMode("building");
  }

  function selectFlat(unit: number, trigger?: HTMLButtonElement) {
    setFlat(unit);
    if (active !== flatEightEvidence.building || unit !== flatEightEvidence.flat) return;
    const pin = map.current?.querySelector<HTMLButtonElement>('.flat-pin[data-flat-number="8"]');
    evidenceTrigger.current = trigger ?? (pin?.style.visibility === "visible" ? pin : null)
      ?? map.current?.querySelector<HTMLButtonElement>('.unit-chip[data-flat-number="8"]') ?? null;
    setHovered(null);
    setEvidenceOpen(true);
  }

  function closeEvidence() {
    setEvidenceOpen(false);
    const trigger = evidenceTrigger.current;
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
  }

  const selectedHasEvidence = active === flatEightEvidence.building && flat === flatEightEvidence.flat;
  const selectedBand = selectedHasEvidence ? flatEightEvidence.band : data && flat !== null ? data[active][flat] : null;
  const roomCounts = flat !== null && !selectedHasEvidence ? exampleRoomCounts(active, flat) : null;
  return (
    <div className="band-map" ref={map}>
      {error && <p className="load-error" role="alert">{error}</p>}
      <div className="map-layout">
        <section className="viewer" aria-label="Building and map viewer">
          <div className="viewer-toolbar">
            <div className="view-switch" role="group" aria-label="View mode">
              <button type="button" aria-pressed={mode === "map"} onClick={() => { setHovered(null); setMode("map"); }}><Icon name="map" /> Map</button>
              <button type="button" aria-pressed={mode === "building"} onClick={() => setMode("building")}><Icon name="cube" /> 3D view</button>
            </div>
            <span className="view-context">{mode === "map" ? "50 m study area" : "Approximate building model"}</span>
          </div>
          {mode === "map" ? <SiteMap active={active} onSelect={changeBuilding} /> : data ? (
            <Suspense fallback={<div className="building-stage loading-state" role="status">Loading the 3D view…</div>}>
              <BuildingView data={data} active={active} hovered={hovered} flat={flat} onHover={setHovered} onFlat={selectFlat} />
            </Suspense>
          ) : (
            <div className="building-stage loading-state" role="status">{error ? "Check the band data file to open the building." : "Loading the band data…"}</div>
          )}
          <div className="viewer-footer">
            <Icon name={mode === "map" ? "pin" : "levels"} size={16} />
            <span>{mode === "map" ? "Centred on the E16 2EG postcode reference point" : "Hover to see a flat’s band. Click or tap for details."}</span>
          </div>
        </section>

        <aside className="sidebar" aria-label="Buildings and flats">
          <section>
            <h2>Buildings</h2>
            <div className="building-list">
              {buildingIds.map(id => (
                <button key={id} type="button" className="building-card"
                  aria-pressed={active === id} onClick={() => changeBuilding(id)}>
                  <span className="building-icon"><Icon name="building" size={21} /></span>
                  <span>
                    <strong>{buildings[id].name}</strong>
                    <small>{buildings[id].street} · {buildings[id].postcode}</small>
                  </span>
                  <span className="building-side">{buildings[id].side}</span>
                </button>
              ))}
            </div>
          </section>

          {mode === "building" && data ? (
            <section className="flat-controls">
              <h2>Flats</h2>
              <div className="unit-strip" role="group" aria-label="Select a flat">
                {flatsFromFront.map(unit => (
                  <button className="unit-chip" type="button" key={unit} aria-pressed={flat === unit}
                    aria-label={`Select flat ${unit}, ${bandLabel(data[active][unit])}`}
                    data-highlighted={hovered === unit} data-flat-number={unit}
                    aria-haspopup={active === flatEightEvidence.building && unit === flatEightEvidence.flat ? "dialog" : undefined}
                    style={{ "--flat-band": bandColour(data[active][unit]) } as CSSProperties}
                    onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(unit); }}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(unit)}
                    onBlur={() => setHovered(null)}
                    onClick={event => selectFlat(unit, event.currentTarget)}>
                    {unit}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="area-card">
              <h2>{building.name}</h2>
              <div className="summary-bands" aria-label="Band distribution">
                {Object.entries(counts).map(([band, count]) => (
                  <span key={band}><i style={{ background: bandColour(band === "Unknown" ? null : band as Band) }} /> {count} {band === "Unknown" ? "unknown" : `in ${band}`}</span>
                ))}
              </div>
            </section>
          )}

          {data && flat !== null && mode === "building" && (
            <section className="flat-details" aria-label="Selected flat details" aria-live="polite">
              <div className="detail-heading">
                <h2>Flat {flat}</h2>
                <span style={{ background: bandColour(selectedBand) }}>{bandLabel(selectedBand)}</span>
              </div>
              <p>{flatAddress(building, flat)}</p>
              {roomCounts && (
                <>
                  <p className="example-label">Example room counts</p>
                  <dl>
                    <div><dt>Rooms</dt><dd>{roomCounts.rooms}</dd></div>
                    <div><dt>Bedrooms</dt><dd>{roomCounts.bedrooms}</dd></div>
                  </dl>
                </>
              )}
              {selectedHasEvidence ? (
                <button className="primary use-band-button" type="button" onClick={event => selectFlat(flat, event.currentTarget)}>
                  View property evidence
                </button>
              ) : selectedBand && (
                <button className="primary use-band-button" type="button" onClick={() => onUseBand(selectedBand)}>
                  Use Band {selectedBand} in calculator
                </button>
              )}
            </section>
          )}
          <Legend counts={counts} />
        </aside>
      </div>
      {evidenceOpen && (
        <Suspense fallback={null}>
          <FlatEvidenceDialog onDismiss={closeEvidence} onUseBand={() => {
            setEvidenceOpen(false);
            onUseBand(flatEightEvidence.band);
          }} />
        </Suspense>
      )}
    </div>
  );
}
