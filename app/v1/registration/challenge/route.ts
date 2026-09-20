import { NextResponse } from 'next/server';
import { randomNonce } from '@/lib/crypto';
import { issueChallengeNonce } from '@/lib/db';

export async function GET() {
  const nonce = randomNonce();
  issueChallengeNonce(nonce);
  return NextResponse.json({ nonce, expiresInMs: 5 * 60 * 1000 });
}
