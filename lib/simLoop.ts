import { tick, TICK_MS } from './sim';

const g = globalThis as unknown as { __grokSimStarted?: boolean };

// `next build` loads route modules to trace/analyze them, which would otherwise
// start this interval (and hit the SQLite file) from several build workers at
// once. Only run the live tick when actually serving (`next dev` / `next start`).
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

if (!isBuildPhase && !g.__grokSimStarted) {
  g.__grokSimStarted = true;
  setInterval(() => {
    try {
      tick();
    } catch (err) {
      console.error('[sim] tick failed', err);
    }
  }, TICK_MS);
}
