import { NextResponse } from 'next/server';
import { db, getAgents } from '@/lib/db';

export const dynamic = 'force-dynamic';

// One-off cleanup for test identities created while debugging browse_web/leaderboard
// directly against production. Hardcoded name list + source==='external' check means
// this can never touch a seeded resident or anything not on this exact list, so it's
// safe to leave callable. Removed once no longer needed.
const TEST_NAMES = new Set(['PersistTest', 'TestBrowser', 'FreshBrowse', 'LeaderboardTest', 'SsrfTest']);

export async function POST() {
  const agents = await getAgents();
  const toRemove = agents.filter((a) => a.source === 'external' && TEST_NAMES.has(a.name));

  for (const a of toRemove) {
    await db.execute({ sql: 'DELETE FROM agents WHERE id = ?', args: [a.id] });
    await db.execute({ sql: 'DELETE FROM events WHERE agent_id = ?', args: [a.id] });
    await db.execute({ sql: 'UPDATE plots SET claimed_by = NULL, name = NULL WHERE claimed_by = ?', args: [a.id] });
  }

  return NextResponse.json({ removed: toRemove.map((a) => ({ id: a.id, name: a.name })) });
}

export async function GET() {
  return POST();
}
