import context from "./map-context.json";

export const origin = { latitude: 51.507546, longitude: 0.073637 };
export const studyRadius = 50;
export const buildingIds = ["woolspinners", "softwood"] as const;
export type BuildingId = (typeof buildingIds)[number];
export type Floor = 2 | 3;
export type Point = readonly [east: number, north: number];

export interface Building {
  id: BuildingId;
  name: string;
  street: string;
  postcode: string;
  side: "West" | "East";
  footprint: readonly [southwest: Point, southeast: Point, northeast: Point, northwest: Point];
  brick: string;
  roof: string;
  pierWidths: readonly [west: number, east: number];
  balconyShift: number;
  tallerEnd: "west" | "east";
}

export const buildings: Record<BuildingId, Building> = {
  woolspinners: {
    id: "woolspinners",
    name: "Woolspinners House",
    street: "17 Carrack Mews",
    postcode: "E16 2EG",
    side: "West",
    footprint: [[-44.1, -6.2], [4.2, -7.7], [4.83, 11.3], [-43.47, 12.8]],
    brick: "#cead86",
    roof: "#566952",
    pierWidths: [2.7, 2.1],
    balconyShift: -0.26,
    tallerEnd: "west",
  },
  softwood: {
    id: "softwood",
    name: "Softwood House",
    street: "18 Carrack Mews",
    postcode: "E16 2EH",
    side: "East",
    footprint: [[13.3, -8.6], [58, -10.6], [58.9, 8.5], [14.2, 10.5]],
    brick: "#dfc39d",
    roof: "#65775b",
    pierWidths: [2, 2.9],
    balconyShift: 0.16,
    tallerEnd: "east",
  },
};

export const bandColours = {
  A: "#a4d393",
  B: "#77c7af",
  C: "#74afe9",
  D: "#a39cdf",
  E: "#efba62",
  F: "#ee907f",
  G: "#c78ab5",
  H: "#9f96b4",
} as const;
export type Band = keyof typeof bandColours;
export type UnitBand = Band | null;
export type BandData = Record<BuildingId, Record<number, UnitBand>>;

type LayerKind = "complex" | "building" | "green" | "road" | "mews" | "path";
export interface MapFeature {
  kind: LayerKind;
  points: Point[];
  name?: string;
}
export const features: MapFeature[] = context.map(({ kind, points, name }) => ({
  kind: kind as LayerKind,
  points: points.map(([east, north]): Point => [east, north]),
  name,
}));

export function buildingGeometry(building: Building) {
  const [sw, se, ne, nw] = building.footprint;
  return {
    centre: [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2] as Point,
    width: Math.hypot(se[0] - sw[0], se[1] - sw[1]),
    depth: Math.hypot(nw[0] - sw[0], nw[1] - sw[1]),
    rotation: Math.atan2(se[1] - sw[1], se[0] - sw[0]),
  };
}

export function flatsForFloor(floor: Floor) {
  const leftmost = floor === 2 ? 7 : 14;
  return Array.from({ length: 7 }, (_, index) => leftmost - index);
}

export const flatsFromFront = [...flatsForFloor(3), ...flatsForFloor(2)];

const exampleBedrooms: Record<BuildingId, readonly number[]> = {
  woolspinners: [1, 2, 1, 2, 2, 1, 2, 2, 2, 3, 2, 3, 2, 3],
  softwood: [2, 1, 2, 1, 2, 1, 2, 3, 2, 2, 3, 2, 3, 2],
};

export function exampleRoomCounts(building: BuildingId, flat: number) {
  const bedrooms = exampleBedrooms[building][flat - 1];
  return { bedrooms, rooms: bedrooms + 2 };
}

export function bandColour(band: UnitBand) {
  return band ? bandColours[band] : "#c9ceca";
}

export function bandLabel(band: UnitBand) {
  return band ? `Band ${band}` : "Band unknown";
}

export function flatAddress(building: Building, flat: number) {
  return `Flat ${flat}, ${building.name}, ${building.street}, Beckton, London, ${building.postcode}`;
}

export async function loadBands(signal: AbortSignal): Promise<BandData> {
  const url = new URL("council-tax-bands.json", document.baseURI);
  const response = await fetch(url, { cache: "no-cache", signal });
  if (!response.ok) throw new Error("The Council Tax data could not be loaded.");
  const values: unknown = await response.json();
  const data = {} as BandData;
  for (const id of buildingIds) {
    const entry = values && typeof values === "object" ? (values as Record<string, unknown>)[id] : undefined;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`The data file needs a flat list for ${buildings[id].name}.`);
    }
    const byFlat = entry as Record<string, unknown>;
    data[id] = {};
    for (let flat = 1; flat <= 14; flat += 1) {
      const value = byFlat[flat];
      if (value !== null && (typeof value !== "string" || !Object.hasOwn(bandColours, value))) {
        throw new Error(`Check the band for Flat ${flat}, ${buildings[id].name}. Use A–H or null.`);
      }
      data[id][flat] = value as UnitBand;
    }
  }
  return data;
}
