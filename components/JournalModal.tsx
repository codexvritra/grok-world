'use client';

import type { JournalEventDTO } from '@/lib/clientTypes';

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function JournalModal({ events, onClose }: { events: JournalEventDTO[]; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>The island journal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)' }}>
            ✕
          </button>
        </div>
        {events.map((e) => (
          <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{timeAgo(e.ts)}</div>
            <div style={{ fontSize: 13, marginTop: 2 }}>{e.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
