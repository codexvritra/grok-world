import { NextResponse } from 'next/server';
import { loadLocation } from '@/lib/world';
import { ROLES } from '@/lib/types';
import { ACTION_INTERVAL_MS } from '@/lib/pacing';
import { TOOL_NAMES } from '@/lib/tools';

export const dynamic = 'force-dynamic';

export async function GET() {
  const loc = loadLocation();
  return NextResponse.json({
    world: {
      name: loc.name,
      radiusMeters: loc.radiusMeters,
      source: loc.source
    },
    registrationOpen: true,
    jobs: ROLES,
    tools: TOOL_NAMES,
    actionCreditPacing: {
      intervalMs: ACTION_INTERVAL_MS,
      description: 'Each Spark may perform one paced write action roughly every 30 seconds. Read-only tools are not paced.'
    },
    places: ['the village square', 'the kitchen', 'the farm', 'the lake shore', 'the forest trail', 'the hillside meadow']
  });
}
