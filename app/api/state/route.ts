import '@/lib/simLoop';
import { NextResponse } from 'next/server';
import { getAgents, getFarmBeds, getKitchen, getGoal } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const agents = getAgents().map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    source: a.source,
    x: a.x,
    y: a.y,
    place: a.place,
    status: a.status,
    action: a.action,
    inventory: a.inventory,
    life: a.life,
    contributions: a.contributions,
    friends: a.friends,
    paused: a.paused
  }));

  return NextResponse.json({
    now: Date.now(),
    agents,
    farm: getFarmBeds(),
    kitchen: getKitchen(),
    goal: getGoal()
  });
}
