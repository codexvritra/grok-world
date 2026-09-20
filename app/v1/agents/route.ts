import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { verifySignature } from '@/lib/crypto';
import { consumeChallengeNonce, insertAgent, insertEvent, defaultInventory, defaultLife, getAgents } from '@/lib/db';
import { ROLES } from '@/lib/types';
import type { Agent } from '@/lib/types';
import { LANDMARKS } from '@/lib/sim';

export const dynamic = 'force-dynamic';

const MAX_EXTERNAL_AGENTS = 200;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { name, role, publicKey, challengeNonce, signature } = body ?? {};

  if (typeof name !== 'string' || name.trim().length < 1 || name.length > 40) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  if (typeof role !== 'string' || !ROLES.includes(role as any)) {
    return NextResponse.json({ error: 'invalid_role', allowed: ROLES }, { status: 400 });
  }
  if (typeof publicKey !== 'string' || typeof challengeNonce !== 'string' || typeof signature !== 'string') {
    return NextResponse.json({ error: 'missing_fields', required: ['name', 'role', 'publicKey', 'challengeNonce', 'signature'] }, { status: 400 });
  }
  const existing = await getAgents();
  if (existing.filter((a) => a.source === 'external').length >= MAX_EXTERNAL_AGENTS) {
    return NextResponse.json({ error: 'registration_closed' }, { status: 503 });
  }
  if (!(await consumeChallengeNonce(challengeNonce))) {
    return NextResponse.json({ error: 'invalid_or_expired_challenge' }, { status: 400 });
  }
  // Registration signs the raw challenge nonce with the Spark's Ed25519 key.
  if (!verifySignature(publicKey, challengeNonce, signature)) {
    return NextResponse.json({ error: 'signature_verification_failed' }, { status: 401 });
  }

  const id = randomUUID();
  const agent: Agent = {
    id,
    name: name.trim(),
    role,
    publicKey,
    source: 'external',
    x: LANDMARKS.square.x,
    y: LANDMARKS.square.y,
    place: 'the village square',
    status: 'idle',
    action: 'just arrived on the island',
    intent: '',
    targetX: null,
    targetY: null,
    waypoints: [],
    inventory: defaultInventory(),
    life: defaultLife(),
    contributions: 0,
    friends: [],
    paused: false,
    lastActionAt: 0,
    createdAt: Date.now()
  };
  await insertAgent(agent);
  await insertEvent(id, agent.name, 'arrival', `${agent.name} arrived on the island as a new Spark, ready to work as a ${role}.`);

  return NextResponse.json({ agentId: id, watchUrl: '/', protocol: 'grok-world-v1' }, { status: 201 });
}
