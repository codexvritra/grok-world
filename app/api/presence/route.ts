import { NextResponse } from 'next/server';
import { touchPresence, countActivePresence } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine, we'll just report the count
  }
  if (typeof body.sessionId === 'string' && body.sessionId.length > 0 && body.sessionId.length <= 64) {
    await touchPresence(body.sessionId);
  }
  const watching = await countActivePresence();
  return NextResponse.json({ watching });
}
