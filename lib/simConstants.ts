// Shared between the server sim (lib/sim.ts) and the client renderer
// (components/WorldCanvas.tsx, which can't import lib/sim.ts directly since
// that pulls in the server-only DB client). Keep these two in sync.
export const TICK_MS = 3000;
export const WALK_SPEED = 2.2; // meters per tick
