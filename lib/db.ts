import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import type { Agent, FarmBed, Kitchen, Plot, GoalState, JournalEvent, Inventory, Life } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const g = globalThis as unknown as { __grokDb?: DatabaseSync };

export const db = g.__grokDb ?? new DatabaseSync(path.join(DATA_DIR, 'world.db'));
if (!g.__grokDb) g.__grokDb = db;

db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  public_key TEXT,
  source TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  place TEXT NOT NULL,
  status TEXT NOT NULL,
  action TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT '',
  target_x REAL,
  target_y REAL,
  inventory TEXT NOT NULL,
  life TEXT NOT NULL,
  contributions REAL NOT NULL DEFAULT 0,
  friends TEXT NOT NULL DEFAULT '[]',
  paused INTEGER NOT NULL DEFAULT 0,
  last_action_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS farm_beds (
  id TEXT PRIMARY KEY,
  x REAL NOT NULL,
  y REAL NOT NULL,
  stage TEXT NOT NULL DEFAULT 'empty',
  planted_by TEXT,
  planted_at INTEGER
);

CREATE TABLE IF NOT EXISTS kitchen (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  produce INTEGER NOT NULL DEFAULT 0,
  meals INTEGER NOT NULL DEFAULT 0,
  harvested_total INTEGER NOT NULL DEFAULT 0,
  delivered_total INTEGER NOT NULL DEFAULT 0,
  cooked_total INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plots (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL,
  centroid_x REAL NOT NULL,
  centroid_y REAL NOT NULL,
  claimed_by TEXT,
  name TEXT,
  grid_cols INTEGER NOT NULL,
  grid_rows INTEGER NOT NULL,
  cell_size REAL NOT NULL,
  pieces TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS goal (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target REAL NOT NULL,
  progress REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  agent_id TEXT,
  agent_name TEXT,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency (
  agent_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  result TEXT NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (agent_id, action_id)
);
`);

// --- row <-> domain mapping ---

function rowToAgent(r: any): Agent {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    publicKey: r.public_key,
    source: r.source,
    x: r.x,
    y: r.y,
    place: r.place,
    status: r.status,
    action: r.action,
    intent: r.intent,
    targetX: r.target_x,
    targetY: r.target_y,
    inventory: JSON.parse(r.inventory),
    life: JSON.parse(r.life),
    contributions: r.contributions,
    friends: JSON.parse(r.friends),
    paused: !!r.paused,
    lastActionAt: r.last_action_at,
    createdAt: r.created_at
  };
}

export function getAgents(): Agent[] {
  return (db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all() as any[]).map(rowToAgent);
}

export function getAgentById(id: string): Agent | undefined {
  const r = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
  return r ? rowToAgent(r) : undefined;
}

export function insertAgent(a: Agent) {
  db.prepare(
    `INSERT INTO agents (id,name,role,public_key,source,x,y,place,status,action,intent,target_x,target_y,inventory,life,contributions,friends,paused,last_action_at,created_at)
     VALUES (@id,@name,@role,@publicKey,@source,@x,@y,@place,@status,@action,@intent,@targetX,@targetY,@inventory,@life,@contributions,@friends,@paused,@lastActionAt,@createdAt)`
  ).run({
    ...a,
    inventory: JSON.stringify(a.inventory),
    life: JSON.stringify(a.life),
    friends: JSON.stringify(a.friends),
    paused: a.paused ? 1 : 0
  });
}

export function saveAgent(a: Agent) {
  db.prepare(
    `UPDATE agents SET name=@name, role=@role, x=@x, y=@y, place=@place, status=@status, action=@action, intent=@intent,
     target_x=@targetX, target_y=@targetY, inventory=@inventory, life=@life, contributions=@contributions,
     friends=@friends, paused=@paused, last_action_at=@lastActionAt WHERE id=@id`
  ).run({
    id: a.id,
    name: a.name,
    role: a.role,
    x: a.x,
    y: a.y,
    place: a.place,
    status: a.status,
    action: a.action,
    intent: a.intent,
    targetX: a.targetX,
    targetY: a.targetY,
    inventory: JSON.stringify(a.inventory),
    life: JSON.stringify(a.life),
    contributions: a.contributions,
    friends: JSON.stringify(a.friends),
    paused: a.paused ? 1 : 0,
    lastActionAt: a.lastActionAt
  });
}

export function insertEvent(agentId: string | null, agentName: string | null, actionType: string, description: string) {
  db.prepare('INSERT INTO events (ts, agent_id, agent_name, action_type, description) VALUES (?,?,?,?,?)').run(
    Date.now(),
    agentId,
    agentName,
    actionType,
    description
  );
}

export function getRecentEvents(limit = 60): JournalEvent[] {
  const rows = db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit) as any[];
  return rows.map((r) => ({
    id: r.id,
    ts: r.ts,
    agentId: r.agent_id,
    agentName: r.agent_name,
    actionType: r.action_type,
    description: r.description
  }));
}

export function getAgentJournal(agentId: string, limit = 40): JournalEvent[] {
  const rows = db.prepare('SELECT * FROM events WHERE agent_id = ? ORDER BY id DESC LIMIT ?').all(agentId, limit) as any[];
  return rows.map((r) => ({
    id: r.id,
    ts: r.ts,
    agentId: r.agent_id,
    agentName: r.agent_name,
    actionType: r.action_type,
    description: r.description
  }));
}

function rowToBed(r: any): FarmBed {
  return { id: r.id, x: r.x, y: r.y, stage: r.stage, plantedBy: r.planted_by, plantedAt: r.planted_at };
}

export function getFarmBeds(): FarmBed[] {
  return (db.prepare('SELECT * FROM farm_beds').all() as any[]).map(rowToBed);
}

export function saveFarmBed(b: FarmBed) {
  db.prepare('UPDATE farm_beds SET stage=?, planted_by=?, planted_at=? WHERE id=?').run(b.stage, b.plantedBy, b.plantedAt, b.id);
}

export function getKitchen(): Kitchen {
  const r = db.prepare('SELECT * FROM kitchen WHERE id = 1').get() as any;
  return {
    produce: r.produce,
    meals: r.meals,
    harvestedTotal: r.harvested_total,
    deliveredTotal: r.delivered_total,
    cookedTotal: r.cooked_total
  };
}

export function saveKitchen(k: Kitchen) {
  db.prepare('UPDATE kitchen SET produce=?, meals=?, harvested_total=?, delivered_total=?, cooked_total=? WHERE id=1').run(
    k.produce,
    k.meals,
    k.harvestedTotal,
    k.deliveredTotal,
    k.cookedTotal
  );
}

function rowToPlot(r: any): Plot {
  return {
    id: r.id,
    buildingId: r.building_id,
    centroid: [r.centroid_x, r.centroid_y],
    claimedBy: r.claimed_by,
    name: r.name,
    gridCols: r.grid_cols,
    gridRows: r.grid_rows,
    cellSize: r.cell_size,
    pieces: JSON.parse(r.pieces)
  };
}

export function getPlots(): Plot[] {
  return (db.prepare('SELECT * FROM plots').all() as any[]).map(rowToPlot);
}

export function getPlotById(id: string): Plot | undefined {
  const r = db.prepare('SELECT * FROM plots WHERE id = ?').get(id) as any;
  return r ? rowToPlot(r) : undefined;
}

export function savePlot(p: Plot) {
  db.prepare('UPDATE plots SET claimed_by=?, name=?, pieces=? WHERE id=?').run(p.claimedBy, p.name, JSON.stringify(p.pieces), p.id);
}

export function getGoal(): GoalState {
  return db.prepare('SELECT * FROM goal LIMIT 1').get() as GoalState;
}

export function saveGoalProgress(progress: number) {
  db.prepare('UPDATE goal SET progress = ?').run(progress);
}

export function issueChallengeNonce(nonce: string) {
  db.prepare('INSERT INTO nonces (nonce, agent_id, ts) VALUES (?, ?, ?)').run(nonce, '__challenge__', Date.now());
}

export function consumeChallengeNonce(nonce: string, maxAgeMs = 5 * 60 * 1000): boolean {
  const r = db.prepare('SELECT * FROM nonces WHERE nonce = ? AND agent_id = ?').get(nonce, '__challenge__') as any;
  if (!r) return false;
  if (Date.now() - r.ts > maxAgeMs) return false;
  db.prepare('DELETE FROM nonces WHERE nonce = ?').run(nonce);
  return true;
}

export function isNonceUsed(nonce: string): boolean {
  return !!db.prepare('SELECT 1 FROM nonces WHERE nonce = ?').get(nonce);
}

export function recordNonce(nonce: string, agentId: string) {
  db.prepare('INSERT OR IGNORE INTO nonces (nonce, agent_id, ts) VALUES (?,?,?)').run(nonce, agentId, Date.now());
  // opportunistic cleanup of nonces older than 10 minutes
  db.prepare('DELETE FROM nonces WHERE ts < ?').run(Date.now() - 10 * 60 * 1000);
}

export function getIdempotentResult(agentId: string, actionId: string): any | undefined {
  const r = db.prepare('SELECT result FROM idempotency WHERE agent_id = ? AND action_id = ?').get(agentId, actionId) as any;
  return r ? JSON.parse(r.result) : undefined;
}

export function saveIdempotentResult(agentId: string, actionId: string, result: any) {
  db.prepare('INSERT OR REPLACE INTO idempotency (agent_id, action_id, result, ts) VALUES (?,?,?,?)').run(
    agentId,
    actionId,
    JSON.stringify(result),
    Date.now()
  );
}

export const defaultInventory = (): Inventory => ({ timber: 0, pollen: 0, sand: 0, produce: 0 });
export const defaultLife = (): Life => ({ energy: 80, nourishment: 80, companionship: 60, experience: 0 });
