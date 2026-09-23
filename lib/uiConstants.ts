export const ROLE_COLORS: Record<string, string> = {
  farmer: '#8fbf7a',
  gatherer: '#f2b95a',
  builder: '#e08e6d',
  cook: '#b79ae8',
  wanderer: '#7fb8d9'
};

export const BUILDING_ICONS: Record<string, string> = {
  house: '⌂',
  studio: '✳',
  farmhouse: '✿',
  workshop: '⚒'
};

/** Free, keyless screenshot thumbnail service (WordPress mshots) — client-safe (no server-only deps). */
export function thumbnailUrl(pageUrl: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(pageUrl)}?w=600`;
}
