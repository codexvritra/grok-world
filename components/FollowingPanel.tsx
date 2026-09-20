'use client';

import type { AgentDTO } from '@/lib/clientTypes';
import Avatar from './Avatar';

export default function FollowingPanel({
  agents,
  following,
  onToggle,
  onClose
}: {
  agents: AgentDTO[];
  following: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const followedAgents = agents.filter((a) => following.includes(a.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Following ({followedAgents.length})</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)' }}>
            ✕
          </button>
        </div>

        {followedAgents.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            You're not following anyone yet. Open a resident from the island or the Residents list and tap "Follow"
            to keep a closer eye on their story.
          </p>
        )}

        {followedAgents.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--card-border)' }}>
            <Avatar role={a.role} size={30} external={a.source === 'external'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {a.source === 'external' ? '✦ ' : ''}
                {a.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.action}</div>
            </div>
            <button
              onClick={() => onToggle(a.id)}
              style={{ border: '1px solid var(--card-border)', background: 'none', borderRadius: 999, padding: '5px 12px', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}
            >
              Unfollow
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
