import '@/lib/simLoop';
import { NextResponse } from 'next/server';
import { buildSigningMessage, sha256Hex, verifySignature } from '@/lib/crypto';
import { getAgentById, saveAgent, isNonceUsed, recordNonce, getIdempotentResult, saveIdempotentResult } from '@/lib/db';
import { runTool, ToolError, READ_ONLY_TOOLS } from '@/lib/tools';
import { canAct } from '@/lib/pacing';

export const dynamic = 'force-dynamic';

const MAX_SKEW_MS = 5 * 60 * 1000;

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(req: Request) {
  const agentId = req.headers.get('x-spark-id');
  const timestamp = req.headers.get('x-spark-time');
  const nonce = req.headers.get('x-spark-nonce');
  const signature = req.headers.get('x-spark-signature');

  if (!agentId || !timestamp || !nonce || !signature) {
    return fail(400, 'missing_auth_headers', { required: ['X-Spark-Id', 'X-Spark-Time', 'X-Spark-Nonce', 'X-Spark-Signature'] });
  }

  const agent = getAgentById(agentId);
  if (!agent || agent.source !== 'external' || !agent.publicKey) {
    return fail(404, 'unknown_agent');
  }
  if (agent.paused) {
    return fail(423, 'agent_paused');
  }

  const skew = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_SKEW_MS) {
    return fail(401, 'timestamp_out_of_range');
  }
  if (isNonceUsed(nonce)) {
    return fail(401, 'nonce_already_used');
  }

  const rawBody = await req.text();
  const url = new URL(req.url);
  const message = buildSigningMessage({
    origin: url.origin,
    method: 'POST',
    path: url.pathname,
    timestamp,
    nonce,
    bodySha256: sha256Hex(rawBody)
  });

  if (!verifySignature(agent.publicKey, message, signature)) {
    return fail(401, 'signature_verification_failed');
  }
  recordNonce(nonce, agentId);

  let body: any;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return fail(400, 'invalid_json_body');
  }

  const { tool, params, actionId } = body ?? {};
  if (typeof tool !== 'string') return fail(400, 'missing_tool');

  const isRead = READ_ONLY_TOOLS.has(tool);

  if (!isRead && actionId) {
    const cached = getIdempotentResult(agentId, actionId);
    if (cached) return NextResponse.json(cached);
  }

  if (!isRead) {
    const pace = canAct(agent.lastActionAt);
    if (!pace.ok) {
      return fail(429, 'action_credit_not_ready', { retryAfterMs: pace.retryAfterMs });
    }
  }

  try {
    const result = runTool(agent, tool, params ?? {});
    if (!isRead) agent.lastActionAt = Date.now();
    saveAgent(agent);
    if (!isRead && actionId) saveIdempotentResult(agentId, actionId, result);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ToolError) {
      return fail(422, err.code, { message: err.message });
    }
    console.error('[action] tool execution failed', err);
    return fail(500, 'internal_error');
  }
}
