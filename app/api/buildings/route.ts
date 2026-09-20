import { NextResponse } from 'next/server';
import { loadLocation } from '@/lib/world';

export const dynamic = 'force-dynamic';

export async function GET() {
  const loc = loadLocation();
  return NextResponse.json(loc);
}
