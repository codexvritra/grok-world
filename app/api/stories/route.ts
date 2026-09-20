import { NextResponse } from 'next/server';
import { getRecentEvents } from '@/lib/db';
import { buildStories } from '@/lib/stories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const events = await getRecentEvents(300);
  return NextResponse.json({ stories: buildStories(events) });
}
