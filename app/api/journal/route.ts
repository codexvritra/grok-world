import { NextResponse } from 'next/server';
import { getRecentEvents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 60);
  return NextResponse.json({ events: getRecentEvents(Math.min(200, Math.max(1, limit))) });
}
