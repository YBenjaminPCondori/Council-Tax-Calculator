import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { bandColour, bandLabel, buildings, flatsForFloor, flatsFromFront } from "./data";
import type { BandData, BuildingId } from "./data";
import { createBuildingScene } from "./buildingScene";
import type { BuildingScene } from "./buildingScene";

interface Props {
  data: BandData;
  active: BuildingId;
  hovered: number | null;
  flat: number | null;
  onHover: (flat: number | null) => void;
  onFlat: (flat: number) => void;
}

export function BuildingView({ data, active, hovered, flat, onHover, onFlat }: Props) {
  const target = useRef<HTMLDivElement>(null);
  const service = useRef<BuildingScene | null>(null);
  const pins = useRef(new Map<number, HTMLButtonElement>());
  const handlers = useRef({ onHover, onFlat });
  const [available, setAvailable] = useState(true);
  const building = buildings[active];
  const hoverBand = hovered === null ? null : data[active][hovered];

  useEffect(() => {
    handlers.current = { onHover, onFlat };
  }, [onHover, onFlat]);

  useEffect(() => {
    const host = target.current;
    if (!host) return;
    try {
      const instance = createBuildingScene(host, data, {
        projectFlat(unit, x, y, visible) {
          const pin = pins.current.get(unit);
          if (!pin) return;
          pin.style.left = `${x}px`;
          pin.style.top = `${y}px`;
          pin.style.visibility = visible && x >= 13 && x < host.clientWidth - 13 && y > 12 && y < host.clientHeight - 12 ? "visible" : "hidden";
        },
        hoverFlat: unit => handlers.current.onHover(unit),
        selectFlat: unit => handlers.current.onFlat(unit),
      });
      service.current = instance;
      return () => {
        service.current = null;
        instance.dispose();
      };
    } catch (error) {
      console.warn("WebGL building view could not start.", error);
      setAvailable(false);
    }
  }, [data]);

  useEffect(() => {
    service.current?.show(active, hovered);
  }, [active, hovered]);

  function flatButton(unit: number, className: string, projected = false) {
    const band = data[active][unit];
    return (
      <button type="button" key={`${active}-${unit}`}
        ref={projected ? node => {
          if (node) pins.current.set(unit, node);
          else pins.current.delete(unit);
        } : undefined}
        className={className} aria-pressed={flat === unit} data-highlighted={hovered === unit}
        aria-label={`Flat ${unit}, ${bandLabel(band)}`}
        style={{ "--flat-band": bandColour(band) } as CSSProperties}
        onPointerEnter={event => { if (event.pointerType !== "touch") onHover(unit); }}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(unit)}
        onBlur={() => onHover(null)}
        onClick={() => onFlat(unit)}>
        {unit}
      </button>
    );
  }

  return (
    <div className="building-stage" data-testid="building-stage" data-hovered-flat={hovered ?? undefined}>
      <div className="model-host" ref={target} />
      <div className="scene-title">
        <strong>{building.name}</strong>
        <span>Approximate flat positions</span>
      </div>
      {available ? (
        <>
          <div className="flat-pins" aria-label="Flats in the 3D building">
            {flatsFromFront.map(unit => flatButton(unit, "flat-pin", true))}
          </div>
          <div className="map-zoom" aria-label="3D controls">
            <button type="button" aria-label="Zoom 3D view in" onClick={() => service.current?.zoom(1 / 1.2)}>+</button>
            <button type="button" aria-label="Zoom 3D view out" onClick={() => service.current?.zoom(1.2)}>−</button>
          </div>
          <div className="scene-caption">
            {hovered === null ? "Drag to orbit · Scroll to zoom" : (
              <span className="hover-readout"><i style={{ background: bandColour(hoverBand) }} /> Flat {hovered} · {bandLabel(hoverBand)}</span>
            )}
          </div>
          <button className="front-button" type="button" aria-label="Front view" onClick={() => service.current?.front()}>
            <span aria-hidden="true">⌖</span> Front view
          </button>
        </>
      ) : (
        <div className="model-fallback">
          <p>3D requires WebGL. You can still inspect both floors in the front elevation.</p>
          <div className="elevation" aria-label="Front elevation">
            {([3, 2] as const).map(level => (
              <div className="elevation-floor" key={level}>
                <span>{level === 3 ? "Third" : "Second"}</span>
                <div>
                  {flatsForFloor(level).map(unit => flatButton(unit, "elevation-flat"))}
                </div>
              </div>
            ))}
            <div className="elevation-floor"><span>First</span><div className="elevation-neutral" /></div>
            <div className="elevation-floor"><span>Ground</span><div className="elevation-neutral" /></div>
          </div>
        </div>
      )}
    </div>
  );
}
