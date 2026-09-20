import type { JournalEvent } from './types';

export interface Story {
  id: string;
  title: string;
  stat: string;
  highlights: string[];
  ts: number;
}

const BUCKET_MS = 60 * 60 * 1000; // one story chapter per hour of island time

function formatHour(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Groups the raw journal feed into hourly "chapters" and picks a handful of
 * highlight lines per chapter — a readable recap, not AI-generated prose (no
 * model call involved, so this stays free and instant).
 */
export function buildStories(events: JournalEvent[]): Story[] {
  if (events.length === 0) return [];

  const buckets = new Map<number, JournalEvent[]>();
  for (const e of events) {
    const key = Math.floor(e.ts / BUCKET_MS);
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }

  const keys = [...buckets.keys()].sort((a, b) => b - a);
  return keys.map((key) => {
    const bucketEvents = buckets.get(key)!.sort((a, b) => b.ts - a.ts);
    const first = bucketEvents[0];
    const last = bucketEvents[bucketEvents.length - 1];
    const activeAgents = new Set(bucketEvents.map((e) => e.agentName).filter(Boolean));
    return {
      id: `story-${key}`,
      title: `${formatHour(last.ts)} – ${formatHour(first.ts)}`,
      stat: `${bucketEvents.length} moment${bucketEvents.length === 1 ? '' : 's'} · ${activeAgents.size} resident${activeAgents.size === 1 ? '' : 's'} active`,
      highlights: bucketEvents.slice(0, 5).map((e) => e.description),
      ts: first.ts
    };
  });
}
