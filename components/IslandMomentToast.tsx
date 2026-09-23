'use client';

import type { AgentDTO, JournalEventDTO } from '@/lib/clientTypes';
import WebThumbnail from './WebThumbnail';

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function IslandMomentToast({
  event,
  agents,
  onOpenJournal,
  onOpenWeb
}: {
  event: JournalEventDTO | null;
  agents: AgentDTO[];
  onOpenJournal: () => void;
  onOpenWeb: () => void;
}) {
  if (!event) return null;
  // Live preview: when the freshest island moment is a web lookup, show the
  // actual page it's about instead of just the text, so watching the toast
  // feels like watching the bot browse in real time rather than reading a log.
  const browsingAgent =
    event.actionType === 'browse_web' ? agents.find((a) => a.id === event.agentId && a.browsingUrl) : undefined;

  return (
    <div
      className="floating-card"
      style={{
        position: 'absolute',
        left: 16,
        bottom: 148,
        maxWidth: 'min(340px, calc(100vw - 32px))',
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        zIndex: 10
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>{browsingAgent ? '🔎' : '✨'}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: 'var(--muted)', textTransform: 'uppercase' }}>
          {browsingAgent ? 'Live: researching now' : 'An island moment'}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, lineHeight: 1.35 }}>{event.description}</div>
        {browsingAgent && (
          <WebThumbnail
            pageUrl={browsingAgent.browsingUrl!}
            style={{ width: '100%', height: 100, objectFit: 'cover', objectPosition: 'top', borderRadius: 8, marginTop: 8, background: 'var(--bg)' }}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
          <span>{timeAgo(event.ts)}</span>
          <button
            onClick={browsingAgent ? onOpenWeb : onOpenJournal}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 11, padding: 0 }}
          >
            {browsingAgent ? 'See the web feed ↗' : 'Read the story ↗'}
          </button>
        </div>
      </div>
    </div>
  );
}
