'use client';

import type { JournalEventDTO } from '@/lib/clientTypes';

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function IslandMomentToast({ event, onOpenJournal }: { event: JournalEventDTO | null; onOpenJournal: () => void }) {
  if (!event) return null;
  return (
    <div
      className="floating-card"
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        maxWidth: 340,
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        zIndex: 10
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>✨</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: 'var(--muted)', textTransform: 'uppercase' }}>
          An island moment
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, lineHeight: 1.35 }}>{event.description}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
          <span>{timeAgo(event.ts)}</span>
          <button
            onClick={onOpenJournal}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 11, padding: 0 }}
          >
            Read the story ↗
          </button>
        </div>
      </div>
    </div>
  );
}
