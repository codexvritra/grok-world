import { tick, TICK_MS } from './sim';

const g = globalThis as unknown as { __grokSimStarted?: boolean };

// `next build` loads route modules to trace/analyze them, which would otherwise
// start this interval (and hit the database) from several build workers at
// once. Only run the live tick when actually serving (`next dev` / `next start`).
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
// Vercel (and other serverless hosts) never keep a process alive between
// requests, so a setInterval here would do nothing useful — those hosts
// advance the world via catchUpTicks() called from request handlers instead.
const isServerless = !!process.env.VERCEL;

if (!isBuildPhase && !isServerless && !g.__grokSimStarted) {
  g.__grokSimStarted = true;
  setInterval(() => {
    tick().catch((err) => {
      console.error('[sim] tick failed', err);
    });
  }, TICK_MS);
}
