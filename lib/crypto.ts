import nacl from 'tweetnacl';
import crypto from 'node:crypto';

export const PROTOCOL_TAG = 'grok-world-v1';

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function randomNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * Canonical message every signed request signs:
 * tag\norigin\nmethod\npath\ntimestamp\nnonce\nsha256(body)
 */
export function buildSigningMessage(opts: {
  origin: string;
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  bodySha256: string;
}): string {
  return [PROTOCOL_TAG, opts.origin, opts.method.toUpperCase(), opts.path, opts.timestamp, opts.nonce, opts.bodySha256].join('\n');
}

export function verifySignature(publicKeyB64: string, message: string, signatureB64: string): boolean {
  try {
    const pub = b64ToBytes(publicKeyB64);
    const sig = b64ToBytes(signatureB64);
    const msg = new TextEncoder().encode(message);
    if (pub.length !== 32 || sig.length !== 64) return false;
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}
