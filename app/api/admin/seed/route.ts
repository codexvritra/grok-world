import { NextResponse } from 'next/server';
import { seedWorldIfEmpty } from '@/lib/seedWorld';

export const dynamic = 'force-dynamic';

// Serverless hosts (Vercel) never run scripts/seed.ts, so a fresh remote
// database (e.g. a new Turso DB, or credentials that only just started
// working) stays permanently empty until something populates it. This only
// ever inserts when the world has zero agents, so hitting it repeatedly or
// without authorization can't reset or duplicate an already-living world.
export async function POST() {
  const result = await seedWorldIfEmpty();
  return NextResponse.json(result);
}

export async function GET() {
  return POST();
}
