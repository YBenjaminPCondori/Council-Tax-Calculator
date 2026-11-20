import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  buildingGeometry, buildingIds, buildings, features, studyRadius,
} from "./data";
import type { BuildingId, Point } from "./data";

type Size = { width: number; height: number };
type MapView = { centre: Point; zoom: number };
const initialView: MapView = { centre: [0, 0], zoom: 1 };
const blockFeatures: Record<string, readonly (readonly Point[])[]> = {
  roofs: [
    [[-40, 20], [-31, 20], [-30, 69], [-39, 69]],
    [[-14, 22], [-2, 22], [0, 74], [-12, 74]],
    [[-37, 72], [-12, 71], [-11, 80], [-37, 81]],
    [[17, 19], [27, 18], [30, 73], [20, 73]],
    [[44, 17], [54, 17], [57, 73], [46, 73]],
    [[21, 73], [47, 72], [48, 80], [21, 81]],
  ],
};

function project([east, north]: Point, view: MapView, size: Size, scale: number) {
  return [
    size.width / 2 + (east - view.centre[0]) * scale,
    size.height / 2 - (north - view.centre[1]) * scale,
  ] as const;
}

function isInside([x, y]: Point, polygon: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function drawMap(canvas: HTMLCanvasElement, size: Size, view: MapView, scale: number, active: BuildingId) {
  const ctx = canvas.getContext("2d");
  if (!ctx || scale <= 0) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(size.width * ratio);
  const height = Math.round(size.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = "#e9ede7";
  ctx.fillRect(0, 0, size.width, size.height);
  const at = (point: Point) => project(point, view, size, scale);
  const path = (points: readonly Point[]) => {
    ctx.beginPath();
    points.forEach((point, index) => {
      const [x, y] = at(point);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  };
  const fill = (points: readonly Point[], colour: string, outline?: string) => {
    path(points);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    if (outline) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = outline;
      ctx.stroke();
    }
  };
  const line = (points: readonly Point[], metres: number, colour: string) => {
    path(points);
    ctx.lineWidth = metres * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colour;
    ctx.stroke();
  };
  const label = (point: Point, copy: string, angle = 0) => {
    const [x, y] = at(point);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = "600 11px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffffd9";
    ctx.strokeText(copy, 0, 0);
    ctx.fillStyle = "#566660";
    ctx.fillText(copy, 0, 0);
    ctx.restore();
  };

  for (const item of features) {
    if (item.kind === "green") fill(item.points, "#d3e4c8");
    if (item.kind === "complex") fill(item.points, "#dce5d9", "#c7d0c4");
  }
  const atlantic: Point[] = [[-138, 96], [-67, 94], [-20, 91], [31, 90], [82, 87], [136, 85]];
  line(atlantic, 12, "#d5dcd6");
  line(atlantic, 9.5, "#f9faf6");
  for (const item of features) {
    if (item.kind === "road" || item.kind === "mews") {
      const roadWidth = item.name === "Gallions Road" ? 10.5 : item.kind === "mews" ? 6 : 7.5;
      line(item.points, roadWidth + 2, "#d3dbd4");
      line(item.points, roadWidth, item.kind === "mews" ? "#f6f4ec" : "#fcfdf9");
    }
    if (item.kind === "path") line(item.points, 1.4, "#fcfbf4");
  }
  for (const item of features) {
    if (item.kind === "building") fill(item.points, "#d6ddd8", "#c1cdc4");
  }
  for (const roof of blockFeatures.roofs) fill(roof, "#cbd5cf", "#bdc9c0");

  const [cx, cy] = at([0, 0]);
  ctx.beginPath();
  ctx.arc(cx, cy, studyRadius * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#258f8013";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2a8177";
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const id of buildingIds) {
    const target = buildings[id];
    ctx.save();
    ctx.shadowColor = "#1b53435c";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    fill(target.footprint, id === active ? "#6ba99e" : "#a1c5b5", "#2b796f");
    ctx.restore();
    const [sw, se, ne, nw] = target.footprint;
    const lerp = (a: Point, b: Point, t: number): Point => [
      a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
    ];
    for (let bay = 0; bay < 7; bay++) {
      const start = 0.06 + bay * 0.125;
      const end = start + 0.11;
      fill(
        [lerp(sw, se, start), lerp(lerp(sw, se, (start + end) / 2), lerp(nw, ne, (start + end) / 2), 0.48), lerp(sw, se, end)],
        id === active ? "#427f73" : "#7ba598",
      );
    }
  }
  label([2, -31], "Gallions Road", 0.035);
  label([7.9, 23], "Carrack Mews", -Math.PI / 2 + 0.036);
  label([-52, 21], "Royal Quay Road", -Math.PI / 2 + 0.048);
  label([-3, 91], "Atlantis Avenue", 0.025);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#205e57";
  ctx.lineWidth = 2;
  ctx.stroke();
  label([0, -50], "50 m");
}

interface Props {
  active: BuildingId;
  onSelect: (id: BuildingId) => void;
}

export function SiteMap({ active, onSelect }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<{ x: number; y: number; centre: Point; moved: boolean } | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<MapView>(initialView);
  const scale = Math.min(size.width / 144, size.height / 127) * view.zoom;
  const changeZoom = (factor: number) => setView(old => ({ ...old, zoom: Math.min(2.7, Math.max(0.78, old.zoom * factor)) }));

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    const zoom = (event: WheelEvent) => {
      event.preventDefault();
      changeZoom(event.deltaY > 0 ? 1 / 1.12 : 1.12);
    };
    element.addEventListener("wheel", zoom, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", zoom);
    };
  }, []);

  useEffect(() => {
    if (canvas.current) drawMap(canvas.current, size, view, scale, active);
  }, [size, view, scale, active]);

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, centre: view.centre, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const current = gesture.current;
    if (!current || !scale) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 5) return;
    current.moved = true;
    const east = current.centre[0] - dx / scale;
    const north = current.centre[1] + dy / scale;
    const factor = Math.min(1, studyRadius / (Math.hypot(east, north) || 1));
    setView(old => ({ ...old, centre: [east * factor, north * factor] }));
  }

  function finish(event: PointerEvent<HTMLCanvasElement>) {
    const current = gesture.current;
    gesture.current = null;
    if (!current || current.moved || !scale) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point: Point = [
      view.centre[0] + (event.clientX - rect.left - size.width / 2) / scale,
      view.centre[1] - (event.clientY - rect.top - size.height / 2) / scale,
    ];
    const hit = buildingIds.find(id => isInside(point, buildings[id].footprint));
    if (hit) onSelect(hit);
  }

  return (
    <div className="map-stage" ref={stage} data-testid="map-stage">
      <canvas ref={canvas} aria-hidden="true" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; }} />
      <div className="map-compass" aria-label="North is up"><span>N</span><span aria-hidden="true">▲</span></div>
      {scale > 0 && buildingIds.map(id => {
        const { centre } = buildingGeometry(buildings[id]);
        const [x, y] = project(centre, view, size, scale);
        const small = size.width < 560;
        const bump = small && id === "woolspinners" ? 27 : -24;
        if (x < 24 || x > size.width - 24 || y < 24 || y > size.height - 25) return null;
        return (
          <button key={id} className={`map-pin ${id === active ? "map-pin--active" : ""}`}
            style={{ left: Math.max(75, Math.min(size.width - 75, x)), top: y + bump }}
            onClick={() => onSelect(id)} aria-label={`Open 3D view of ${buildings[id].name}`}>
            <span className="pin-dot" aria-hidden="true" />
            <span>{buildings[id].name}<small>{buildings[id].postcode}</small></span>
          </button>
        );
      })}
      <div className="map-zoom" aria-label="Map controls">
        <button type="button" onClick={() => changeZoom(1.22)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => changeZoom(1 / 1.22)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => setView(initialView)} aria-label="Reset map view" title="Reset map view">⌖</button>
      </div>
      {scale > 0 && <div className="scale-key" style={{ width: `${(scale > 7 ? 5 : 10) * scale}px` }}>{scale > 7 ? "5 m" : "10 m"}</div>}
      <a className="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>
  );
}
