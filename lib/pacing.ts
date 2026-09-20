export const ACTION_INTERVAL_MS = 30_000;

export function canAct(lastActionAt: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const elapsed = now - lastActionAt;
  if (elapsed >= ACTION_INTERVAL_MS) return { ok: true, retryAfterMs: 0 };
  return { ok: false, retryAfterMs: ACTION_INTERVAL_MS - elapsed };
}
