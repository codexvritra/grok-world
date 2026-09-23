import { createClient, type Client } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import type { Agent, FarmBed, Kitchen, Plot, GoalState, JournalEvent, Inventory, Life } from './types';

// `next build` traces every route handler (even ones marked force-dynamic) by
// actually invoking it, from several concurrent build workers/invocations. An
// in-memory DB during the build phase means nothing ever touches the real
// database during that trace.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

function resolveUrl(): string {
  if (isBuildPhase) return ':memory:';
  // A real libSQL/Turso database (works from Vercel's read-only serverless
  // filesystem) when configured; otherwise a local SQLite file, exactly like
  // before, for local dev and any host with a persistent filesystem (Railway).
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return `file:${path.join(dataDir, 'world.db')}`;
}

// A remote libSQL/Turso server manages its own storage engine and rejects
// client-issued PRAGMAs like journal_mode as disallowed statements — that
// pragma only makes sense (and is only needed) for a local file.
const isRemote = !isBuildPhase && !!process.env.TURSO_DATABASE_URL;

const g = globalThis as unknown as { __grokDb?: Client; __grokDbInit?: Promise<void> };

export const db: Client =
  g.__grokDb ??
  createClient({
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN
  });
if (!g.__grokDb) g.__grokDb = db;

function ensureInit(): Promise<void> {
  if (!g.__grokDbInit) {
    g.__grokDbInit = (isRemote ? Promise.resolve() : db.execute('PRAGMA journal_mode = WAL').then(() => undefined))
      .then(() =>
        db.executeMultiple(
          `
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
  waypoints TEXT NOT NULL DEFAULT '[]',
  inventory TEXT NOT NULL,
  life TEXT NOT NULL,
  contributions REAL NOT NULL DEFAULT 0,
  friends TEXT NOT NULL DEFAULT '[]',
  paused INTEGER NOT NULL DEFAULT 0,
  last_action_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  browsing_url TEXT,
  browsing_title TEXT,
  browsing_at INTEGER NOT NULL DEFAULT 0
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
  progress REAL NOT NULL DEFAULT 0,
  last_tick_at INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS presence (
  session_id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);
`
        )
      )
      .then(() =>
        // CREATE TABLE IF NOT EXISTS doesn't add columns to a table that
        // already existed (e.g. a pre-existing database on a persistent
        // volume) — patch those in by hand, ignoring "already there".
        db.execute('ALTER TABLE goal ADD COLUMN last_tick_at INTEGER NOT NULL DEFAULT 0').catch(() => undefined)
      )
      .then(() => db.execute("ALTER TABLE agents ADD COLUMN waypoints TEXT NOT NULL DEFAULT '[]'").catch(() => undefined))
      .then(() => db.execute('ALTER TABLE agents ADD COLUMN browsing_url TEXT').catch(() => undefined))
      .then(() => db.execute('ALTER TABLE agents ADD COLUMN browsing_title TEXT').catch(() => undefined))
      .then(() => db.execute('ALTER TABLE agents ADD COLUMN browsing_at INTEGER NOT NULL DEFAULT 0').catch(() => undefined))
      .then(() => undefined);
  }
  return g.__grokDbInit;
}

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
    waypoints: r.waypoints ? JSON.parse(r.waypoints) : [],
    inventory: JSON.parse(r.inventory),
    life: JSON.parse(r.life),
    contributions: r.contributions,
    friends: JSON.parse(r.friends),
    paused: !!r.paused,
    lastActionAt: r.last_action_at,
    createdAt: r.created_at,
    browsingUrl: r.browsing_url ?? null,
    browsingTitle: r.browsing_title ?? null,
    browsingAt: r.browsing_at ?? 0
  };
}

export async function getAgents(): Promise<Agent[]> {
  await ensureInit();
  const r = await db.execute('SELECT * FROM agents ORDER BY created_at ASC');
  return r.rows.map(rowToAgent);
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
  await ensureInit();
  const r = await db.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [id] });
  return r.rows[0] ? rowToAgent(r.rows[0]) : undefined;
}

export async function insertAgent(a: Agent): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `INSERT INTO agents (id,name,role,public_key,source,x,y,place,status,action,intent,target_x,target_y,waypoints,inventory,life,contributions,friends,paused,last_action_at,created_at,browsing_url,browsing_title,browsing_at)
     VALUES (@id,@name,@role,@publicKey,@source,@x,@y,@place,@status,@action,@intent,@targetX,@targetY,@waypoints,@inventory,@life,@contributions,@friends,@paused,@lastActionAt,@createdAt,@browsingUrl,@browsingTitle,@browsingAt)`,
    args: {
      ...a,
      waypoints: JSON.stringify(a.waypoints),
      inventory: JSON.stringify(a.inventory),
      life: JSON.stringify(a.life),
      friends: JSON.stringify(a.friends),
      paused: a.paused ? 1 : 0
    } as any
  });
}

// Deliberately does NOT touch browsing_url/browsing_title/browsing_at — see
// updateAgentBrowsing() below for why.
export async function saveAgent(a: Agent): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: `UPDATE agents SET name=@name, role=@role, x=@x, y=@y, place=@place, status=@status, action=@action, intent=@intent,
     target_x=@targetX, target_y=@targetY, waypoints=@waypoints, inventory=@inventory, life=@life, contributions=@contributions,
     friends=@friends, paused=@paused, last_action_at=@lastActionAt WHERE id=@id`,
    args: {
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
      waypoints: JSON.stringify(a.waypoints),
      inventory: JSON.stringify(a.inventory),
      life: JSON.stringify(a.life),
      contributions: a.contributions,
      friends: JSON.stringify(a.friends),
      paused: a.paused ? 1 : 0,
      lastActionAt: a.lastActionAt
    }
  });
}

// A narrow, standalone UPDATE (not folded into saveAgent's full-row write)
// because sim.tick() runs concurrently with /v1/action requests — both do a
// read-full-agent -> mutate -> write-full-agent cycle, so whichever finishes
// last wins and silently discards the other's changes. tick() never touches
// browsing state, so keeping browsing_url/title/at out of its blanket
// saveAgent() writes means only this function ever sets them, closing that
// race for these three columns without a larger rework of how agent state
// gets persisted.
export async function updateAgentBrowsing(agentId: string, url: string, title: string, at: number): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: 'UPDATE agents SET browsing_url=?, browsing_title=?, browsing_at=? WHERE id=?',
    args: [url, title, at, agentId]
  });
}

export async function insertEvent(agentId: string | null, agentName: string | null, actionType: string, description: string): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: 'INSERT INTO events (ts, agent_id, agent_name, action_type, description) VALUES (?,?,?,?,?)',
    args: [Date.now(), agentId, agentName, actionType, description]
  });
}

export async function getRecentEvents(limit = 60): Promise<JournalEvent[]> {
  await ensureInit();
  const r = await db.execute({ sql: 'SELECT * FROM events ORDER BY id DESC LIMIT ?', args: [limit] });
  return r.rows.map((row: any) => ({
    id: row.id,
    ts: row.ts,
    agentId: row.agent_id,
    agentName: row.agent_name,
    actionType: row.action_type,
    description: row.description
  }));
}

export async function getAgentJournal(agentId: string, limit = 40): Promise<JournalEvent[]> {
  await ensureInit();
  const r = await db.execute({ sql: 'SELECT * FROM events WHERE agent_id = ? ORDER BY id DESC LIMIT ?', args: [agentId, limit] });
  return r.rows.map((row: any) => ({
    id: row.id,
    ts: row.ts,
    agentId: row.agent_id,
    agentName: row.agent_name,
    actionType: row.action_type,
    description: row.description
  }));
}

function rowToBed(r: any): FarmBed {
  return { id: r.id, x: r.x, y: r.y, stage: r.stage, plantedBy: r.planted_by, plantedAt: r.planted_at };
}

export async function getFarmBeds(): Promise<FarmBed[]> {
  await ensureInit();
  const r = await db.execute('SELECT * FROM farm_beds');
  return r.rows.map(rowToBed);
}

export async function saveFarmBed(b: FarmBed): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: 'UPDATE farm_beds SET stage=?, planted_by=?, planted_at=? WHERE id=?',
    args: [b.stage, b.plantedBy, b.plantedAt, b.id]
  });
}

export async function getKitchen(): Promise<Kitchen> {
  await ensureInit();
  const r = await db.execute('SELECT * FROM kitchen WHERE id = 1');
  const row: any = r.rows[0];
  return {
    produce: row.produce,
    meals: row.meals,
    harvestedTotal: row.harvested_total,
    deliveredTotal: row.delivered_total,
    cookedTotal: row.cooked_total
  };
}

export async function saveKitchen(k: Kitchen): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: 'UPDATE kitchen SET produce=?, meals=?, harvested_total=?, delivered_total=?, cooked_total=? WHERE id=1',
    args: [k.produce, k.meals, k.harvestedTotal, k.deliveredTotal, k.cookedTotal]
  });
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

export async function getPlots(): Promise<Plot[]> {
  await ensureInit();
  const r = await db.execute('SELECT * FROM plots');
  return r.rows.map(rowToPlot);
}

export async function getPlotById(id: string): Promise<Plot | undefined> {
  await ensureInit();
  const r = await db.execute({ sql: 'SELECT * FROM plots WHERE id = ?', args: [id] });
  return r.rows[0] ? rowToPlot(r.rows[0]) : undefined;
}

export async function savePlot(p: Plot): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: 'UPDATE plots SET claimed_by=?, name=?, pieces=? WHERE id=?',
    args: [p.claimedBy, p.name, JSON.stringify(p.pieces), p.id]
  });
}

export async function getGoal(): Promise<GoalState> {
  await ensureInit();
  const r = await db.execute('SELECT id, title, description, target, progress FROM goal LIMIT 1');
  return r.rows[0] as unknown as GoalState;
}

export async function saveGoalProgress(progress: number): Promise<void> {
  await ensureInit();
  await db.execute({ sql: 'UPDATE goal SET progress = ?', args: [progress] });
}

export async function getLastTickAt(): Promise<number> {
  await ensureInit();
  const r = await db.execute('SELECT last_tick_at FROM goal LIMIT 1');
  return Number((r.rows[0] as any)?.last_tick_at ?? 0);
}

export async function setLastTickAt(ts: number): Promise<void> {
  await ensureInit();
  await db.execute({ sql: 'UPDATE goal SET last_tick_at = ?', args: [ts] });
}

const PRESENCE_WINDOW_MS = 30_000;

export async function touchPresence(sessionId: string): Promise<void> {
  await ensureInit();
  const now = Date.now();
  await db.execute({
    sql: 'INSERT INTO presence (session_id, last_seen) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET last_seen = excluded.last_seen',
    args: [sessionId, now]
  });
  // opportunistic cleanup so the table doesn't grow forever
  await db.execute({ sql: 'DELETE FROM presence WHERE last_seen < ?', args: [now - PRESENCE_WINDOW_MS * 4] });
}

export async function countActivePresence(): Promise<number> {
  await ensureInit();
  const r = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM presence WHERE last_seen > ?', args: [Date.now() - PRESENCE_WINDOW_MS] });
  return Number((r.rows[0] as any)?.c ?? 0);
}

export async function issueChallengeNonce(nonce: string): Promise<void> {
  await ensureInit();
  await db.execute({ sql: 'INSERT INTO nonces (nonce, agent_id, ts) VALUES (?, ?, ?)', args: [nonce, '__challenge__', Date.now()] });
}

export async function consumeChallengeNonce(nonce: string, maxAgeMs = 5 * 60 * 1000): Promise<boolean> {
  await ensureInit();
  const r = await db.execute({ sql: 'SELECT * FROM nonces WHERE nonce = ? AND agent_id = ?', args: [nonce, '__challenge__'] });
  const row: any = r.rows[0];
  if (!row) return false;
  if (Date.now() - row.ts > maxAgeMs) return false;
  await db.execute({ sql: 'DELETE FROM nonces WHERE nonce = ?', args: [nonce] });
  return true;
}

export async function isNonceUsed(nonce: string): Promise<boolean> {
  await ensureInit();
  const r = await db.execute({ sql: 'SELECT 1 FROM nonces WHERE nonce = ?', args: [nonce] });
  return r.rows.length > 0;
}

export async function recordNonce(nonce: string, agentId: string): Promise<void> {
  await ensureInit();
  await db.execute({ sql: 'INSERT OR IGNORE INTO nonces (nonce, agent_id, ts) VALUES (?,?,?)', args: [nonce, agentId, Date.now()] });
  // opportunistic cleanup of nonces older than 10 minutes
  await db.execute({ sql: 'DELETE FROM nonces WHERE ts < ?', args: [Date.now() - 10 * 60 * 1000] });
}

export async function getIdempotentResult(agentId: string, actionId: string): Promise<any | undefined> {
  await ensureInit();
  const r = await db.execute({ sql: 'SELECT result FROM idempotency WHERE agent_id = ? AND action_id = ?', args: [agentId, actionId] });
  const row: any = r.rows[0];
  return row ? JSON.parse(row.result) : undefined;
}

export async function saveIdempotentResult(agentId: string, actionId: string, result: any): Promise<void> {
  await ensureInit();
  await db.execute({
    sql: 'INSERT OR REPLACE INTO idempotency (agent_id, action_id, result, ts) VALUES (?,?,?,?)',
    args: [agentId, actionId, JSON.stringify(result), Date.now()]
  });
}

export const defaultInventory = (): Inventory => ({ timber: 0, pollen: 0, sand: 0, produce: 0 });
export const defaultLife = (): Life => ({ energy: 80, nourishment: 80, companionship: 60, experience: 0 });
