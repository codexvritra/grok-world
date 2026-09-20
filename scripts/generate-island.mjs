// Procedurally generates a custom, hand-styled island layout (buildings, paths,
// trees) — NOT tied to real-world geometry. Saved to data/location.json so the
// rest of the app (lib/world.ts) can load it exactly like it used to load the
// real OSM export.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

if (process.argv.includes('--if-missing') && existsSync('data/location.json')) {
  console.log('data/location.json already exists, skipping generation.');
  process.exit(0);
}

const RNG_SEED = process.argv.includes('--seed') ? Number(process.argv[process.argv.indexOf('--seed') + 1]) : Date.now();
let seed = RNG_SEED;
function rand() {
  // small deterministic PRNG (mulberry32) so a given --seed reproduces the same island
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const range = (a, b) => a + rand() * (b - a);

const ISLAND_RADIUS = 200;
const CLUSTER_CENTERS = [
  { x: 0, y: 0 },
  { x: -70, y: 40 },
  { x: 60, y: -50 },
  { x: -40, y: -90 },
  { x: 90, y: 60 }
];

const WALL_COLORS = ['#f2ead9', '#eee3cf', '#f5efe1', '#f2e8d5', '#ede0c8', '#f0e6d6'];
// Warm terracotta and cool teal-green, alternating — matches the reference's
// two-tone roof palette instead of a wide scattershot of browns.
const ROOF_COLORS = ['#e0733f', '#3f7f6e', '#d9652f', '#4a8a72', '#e5793f', '#356f61'];
const KINDS = ['house', 'house', 'house', 'studio', 'farmhouse', 'workshop'];

function rectFootprint(cx, cy, w, d, angle) {
  const pts = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2]
  ];
  return pts.map(([x, y]) => {
    const rx = x * Math.cos(angle) - y * Math.sin(angle);
    const ry = x * Math.sin(angle) + y * Math.cos(angle);
    return [Math.round((cx + rx) * 100) / 100, Math.round((cy + ry) * 100) / 100];
  });
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function generateBuildings(count) {
  const buildings = [];
  const centers = [];
  let attempts = 0;
  while (buildings.length < count && attempts < count * 40) {
    attempts++;
    const cluster = pick(CLUSTER_CENTERS);
    const cx = cluster.x + range(-45, 45);
    const cy = cluster.y + range(-45, 45);
    if (Math.hypot(cx, cy) > ISLAND_RADIUS - 25) continue;
    const w = range(6, 11);
    const d = range(6, 11);
    const minSep = Math.max(w, d) * 1.15;
    if (centers.some((c) => dist(c, { x: cx, y: cy }) < minSep)) continue;
    centers.push({ x: cx, y: cy });
    const angle = range(-0.2, 0.2) + pick([0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]);
    const id = `b${buildings.length}`;
    buildings.push({
      id,
      kind: pick(KINDS),
      name: null,
      footprint: rectFootprint(cx, cy, w, d, angle),
      centerX: Math.round(cx * 100) / 100,
      centerY: Math.round(cy * 100) / 100,
      width: Math.round(w * 100) / 100,
      depth: Math.round(d * 100) / 100,
      angle,
      wallColor: pick(WALL_COLORS),
      roofColor: pick(ROOF_COLORS),
      wallHeight: range(3.5, 4.5),
      roofHeight: range(2.2, 3.4)
    });
  }
  return buildings;
}

function nearestNeighborPaths(buildings) {
  const points = buildings.map((b) => {
    const [x0, y0] = b.footprint[0];
    const [x2, y2] = b.footprint[2];
    return { x: (x0 + x2) / 2, y: (y0 + y2) / 2 };
  });
  const paths = [];
  const connected = new Set([0]);
  const remaining = points.map((_, i) => i).filter((i) => i !== 0);
  while (remaining.length) {
    let best = null;
    for (const ci of connected) {
      for (const ri of remaining) {
        const d = dist(points[ci], points[ri]);
        if (!best || d < best.d) best = { d, ci, ri };
      }
    }
    paths.push({ from: [points[best.ci].x, points[best.ci].y], to: [points[best.ri].x, points[best.ri].y] });
    connected.add(best.ri);
    remaining.splice(remaining.indexOf(best.ri), 1);
  }
  // a couple of shortcut loops so it doesn't read as a single spindly tree
  for (let i = 0; i < 3; i++) {
    const a = pick(points);
    const b = pick(points);
    if (a !== b && dist(a, b) < 90) paths.push({ from: [a.x, a.y], to: [b.x, b.y] });
  }
  return paths;
}

function pointInsideAnyBuilding(x, y, buildings, pad = 3) {
  return buildings.some((b) => {
    const cx = b.footprint.reduce((s, p) => s + p[0], 0) / 4;
    const cy = b.footprint.reduce((s, p) => s + p[1], 0) / 4;
    return Math.hypot(x - cx, y - cy) < pad + 6;
  });
}

function generateTrees(buildings) {
  const trees = [];
  let tries = 0;
  while (trees.filter((t) => t.kind === 'round').length < 45 && tries < 2000) {
    tries++;
    const angle = range(0, Math.PI * 2);
    const r = range(10, ISLAND_RADIUS * 0.85);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (pointInsideAnyBuilding(x, y, buildings)) continue;
    trees.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, kind: 'round', scale: range(0.7, 1.3) });
  }
  tries = 0;
  while (trees.filter((t) => t.kind === 'palm').length < 22 && tries < 2000) {
    tries++;
    const angle = range(0, Math.PI * 2);
    const r = range(ISLAND_RADIUS * 0.82, ISLAND_RADIUS * 0.98);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    trees.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, kind: 'palm', scale: range(0.8, 1.3) });
  }
  return trees;
}

function generateRocks(buildings) {
  const rocks = [];
  let tries = 0;
  while (rocks.length < 26 && tries < 2000) {
    tries++;
    const angle = range(0, Math.PI * 2);
    const r = range(10, ISLAND_RADIUS * 0.9);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (pointInsideAnyBuilding(x, y, buildings)) continue;
    rocks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, scale: range(0.6, 1.4) });
  }
  return rocks;
}

function generateFlowerPatches(buildings) {
  const patches = [];
  let tries = 0;
  while (patches.length < 35 && tries < 2000) {
    tries++;
    const angle = range(0, Math.PI * 2);
    const r = range(10, ISLAND_RADIUS * 0.88);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (pointInsideAnyBuilding(x, y, buildings)) continue;
    patches.push({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      color: pick(['#f2c94c', '#eb5e8d', '#f2f2f2', '#f28cb1'])
    });
  }
  return patches;
}

const buildings = generateBuildings(22);
const paths = nearestNeighborPaths(buildings);
const trees = generateTrees(buildings);
const rocks = generateRocks(buildings);
const flowers = generateFlowerPatches(buildings);

mkdirSync('data', { recursive: true });
writeFileSync(
  'data/location.json',
  JSON.stringify(
    {
      name: 'Grok Island',
      radiusMeters: ISLAND_RADIUS,
      source: 'procedurally generated (not tied to a real location)',
      fetchedAt: new Date().toISOString(),
      buildings,
      paths,
      trees,
      rocks,
      flowers
    },
    null,
    2
  )
);
console.log(
  `Generated ${buildings.length} buildings, ${paths.length} path segments, ${trees.length} trees, ${rocks.length} rocks, ${flowers.length} flower patches.`
);
