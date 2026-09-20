import fs from 'node:fs';
import path from 'node:path';

export interface RawBuilding {
  id: string;
  kind: string;
  name: string | null;
  footprint: [number, number][];
  centerX: number;
  centerY: number;
  width: number;
  depth: number;
  angle: number;
  wallColor: string;
  roofColor: string;
  wallHeight: number;
  roofHeight: number;
  roofStyle: string;
}

export interface PathSegment {
  from: [number, number];
  to: [number, number];
}

export interface TreePoint {
  x: number;
  y: number;
  kind: 'round' | 'palm';
  scale: number;
}

export interface RockPoint {
  x: number;
  y: number;
  scale: number;
}

export interface FlowerPatch {
  x: number;
  y: number;
  color: string;
}

export interface Lamppost {
  x: number;
  y: number;
}

export interface LocationData {
  name: string;
  radiusMeters: number;
  source: string;
  fetchedAt: string;
  buildings: RawBuilding[];
  paths: PathSegment[];
  trees: TreePoint[];
  rocks: RockPoint[];
  flowers: FlowerPatch[];
  lampposts: Lamppost[];
}

let cached: LocationData | null = null;

export function loadLocation(): LocationData {
  if (cached) return cached;
  const p = path.join(process.cwd(), 'data', 'location.json');
  cached = JSON.parse(fs.readFileSync(p, 'utf8'));
  return cached!;
}

export function polygonArea(pts: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

export function centroid(pts: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of pts) {
    x += px;
    y += py;
  }
  return [x / pts.length, y / pts.length];
}

/** All generated buildings become claimable plots (there are only ~22 of them). */
export function pickPlotBuildings(count: number): RawBuilding[] {
  const loc = loadLocation();
  return [...loc.buildings]
    .filter((b) => b.footprint.length >= 4)
    .sort((a, b) => polygonArea(b.footprint) - polygonArea(a.footprint))
    .slice(0, count);
}
