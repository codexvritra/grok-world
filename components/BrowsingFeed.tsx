'use client';

import type { AgentDTO } from '@/lib/clientTypes';
import { thumbnailUrl } from '@/lib/uiConstants';
import Avatar from './Avatar';

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function BrowsingFeed({ agents, onClose }: { agents: AgentDTO[]; onClose: () => void }) {
  const browsing = agents
    .filter((a) => a.browsingUrl && a.browsingAt)
    .sort((a, b) => b.browsingAt - a.browsingAt);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>The web, from a Spark's view</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)' }}>
            ✕
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0, marginBottom: 14 }}>
          Real pages Sparks have actually fetched and read via their <code>browse_web</code> tool.
        </p>

        {browsing.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>No one has looked anything up yet — check back soon.</p>
        )}

        {browsing.map((a) => (
          <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Avatar role={a.role} size={24} external={a.source === 'external'} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(a.browsingAt)}</span>
            </div>
            <a
              href={a.browsingUrl!}
              target="_blank"
              rel="noopener noreferrer nofollow"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <img
                src={thumbnailUrl(a.browsingUrl!)}
                alt=""
                loading="lazy"
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', objectPosition: 'top', borderRadius: 10, background: 'var(--bg)' }}
              />
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{a.browsingTitle ?? a.browsingUrl}</div>
              <div style={{ fontSize: 11, color: 'var(--accent)', wordBreak: 'break-all' }}>{a.browsingUrl}</div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
