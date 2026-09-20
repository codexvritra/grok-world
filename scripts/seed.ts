import { randomUUID } from 'node:crypto';
import {
  db,
  getAgents,
  insertAgent,
  insertEvent,
  defaultInventory,
  defaultLife
} from '../lib/db';
import { pickPlotBuildings, centroid } from '../lib/world';
import { LANDMARKS } from '../lib/sim';
import { generatePlaceName } from '../lib/names';
import type { Agent, Role, PlotPiece } from '../lib/types';
import { ROLES } from '../lib/types';

const SEEDED: { name: string; role: Role }[] = [
  { name: 'Sunny', role: 'gatherer' },
  { name: 'Marek', role: 'farmer' },
  { name: 'Ilse', role: 'cook' },
  { name: 'Torvald', role: 'builder' },
  { name: 'Petra', role: 'gatherer' },
  { name: 'Anselm', role: 'farmer' },
  { name: 'Rosalind', role: 'builder' },
  { name: 'Kip', role: 'wanderer' }
];

const FORCE = process.argv.includes('--reset');

async function resetAll() {
  await db.executeMultiple(`
    DELETE FROM agents;
    DELETE FROM farm_beds;
    DELETE FROM kitchen;
    DELETE FROM plots;
    DELETE FROM goal;
    DELETE FROM events;
    DELETE FROM nonces;
    DELETE FROM idempotency;
  `);
}

async function seedFarm() {
  const cols = 3;
  const rows = 2;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `bed-${i++}`;
      const x = LANDMARKS.farm.x + c * 6;
      const y = LANDMARKS.farm.y + r * 6;
      await db.execute({
        sql: 'INSERT INTO farm_beds (id, x, y, stage, planted_by, planted_at) VALUES (?,?,?,?,?,?)',
        args: [id, x, y, 'empty', null, null]
      });
    }
  }
}

async function seedKitchen() {
  await db.execute(
    'INSERT OR IGNORE INTO kitchen (id, produce, meals, harvested_total, delivered_total, cooked_total) VALUES (1,4,3,0,0,0)'
  );
}

async function seedGoal() {
  await db.execute({
    sql: 'INSERT INTO goal (id, title, description, target, progress) VALUES (?,?,?,?,0)',
    args: [
      'settle-the-island',
      'Settle the island',
      'Working together, the Sparks are claiming plots and building them up piece by piece into a living shared village.',
      120
    ]
  });
}

async function seedPlots(agentIds: string[]) {
  const buildings = pickPlotBuildings(24);
  let claimedCount = 0;
  for (const b of buildings) {
    const [cx, cy] = centroid(b.footprint);
    // pre-claim and lightly build ~1 in 3 plots so the island opens already lived-in
    const shouldClaim = claimedCount < 8 && Math.random() < 0.4;
    let claimedBy: string | null = null;
    let name: string | null = null;
    const pieces: PlotPiece[] = [];
    if (shouldClaim) {
      claimedBy = agentIds[Math.floor(Math.random() * agentIds.length)];
      name = generatePlaceName();
      const pieceCount = Math.floor(Math.random() * 4);
      for (let i = 0; i < pieceCount; i++) {
        pieces.push({ col: i % 4, row: Math.floor(i / 4), type: i % 2 === 0 ? 'floor' : 'wall', builtBy: claimedBy });
      }
      claimedCount++;
    }
    await db.execute({
      sql: 'INSERT INTO plots (id, building_id, centroid_x, centroid_y, claimed_by, name, grid_cols, grid_rows, cell_size, pieces) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [`plot-${b.id}`, b.id, cx, cy, claimedBy, name, 4, 4, 2.5, JSON.stringify(pieces)]
    });
  }
  return { total: buildings.length, claimed: claimedCount };
}

async function seedAgents(): Promise<string[]> {
  const ids: string[] = [];
  for (const s of SEEDED) {
    const angle = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 60;
    const agent: Agent = {
      id: randomUUID(),
      name: s.name,
      role: s.role,
      publicKey: null,
      source: 'seeded',
      x: LANDMARKS.square.x + Math.cos(angle) * r,
      y: LANDMARKS.square.y + Math.sin(angle) * r,
      place: 'the village square',
      status: 'idle',
      action: 'settling into the village',
      intent: '',
      targetX: null,
      targetY: null,
      inventory: defaultInventory(),
      life: defaultLife(),
      contributions: 0,
      friends: [],
      paused: false,
      lastActionAt: 0,
      createdAt: Date.now()
    };
    await insertAgent(agent);
    await insertEvent(agent.id, agent.name, 'arrival', `${agent.name} settled into the village as a ${s.role}.`);
    ids.push(agent.id);
  }
  return ids;
}

async function main() {
  const existing = await getAgents();
  if (existing.length > 0 && !FORCE) {
    console.log('World already seeded. Re-run with --reset to wipe and reseed.');
    return;
  }
  if (FORCE) await resetAll();
  await seedFarm();
  await seedKitchen();
  await seedGoal();
  const agentIds = await seedAgents();
  const { total, claimed } = await seedPlots(agentIds);
  console.log(`Seeded ${SEEDED.length} residents, ${total} plots (${claimed} pre-claimed), 6 garden beds, 1 shared goal.`);
  console.log('Roles available:', ROLES.join(', '));
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
