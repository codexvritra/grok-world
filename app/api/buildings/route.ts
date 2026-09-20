import { NextResponse } from 'next/server';
import { loadLocation } from '@/lib/world';

export async function GET() {
  const loc = loadLocation();
  return NextResponse.json(loc);
}
