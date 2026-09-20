'use client';

import { useState } from 'react';
import type { AgentDTO } from '@/lib/clientTypes';
import Avatar from './Avatar';

function LifeBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div style={{ height: 5, background: '#eee5cf', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
    </div>
  );
}

export default function ResidentsModal({
  agents,
  following,
  onToggleFollow,
  onClose
}: {
  agents: AgentDTO[];
  following: string[];
  onToggleFollow: (id: string) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Residents ({agents.length})</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)' }}>
            ✕
          </button>
        </div>
        {agents.map((a) => (
          <div key={a.id} style={{ borderBottom: '1px solid var(--card-border)', padding: '10px 0' }}>
            <button
              onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, background: 'none', border: 'none', textAlign: 'left' }}
            >
              <Avatar role={a.role} size={30} external={a.source === 'external'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {a.source === 'external' ? '✦ ' : ''}
                  {a.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.role}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.status}</div>
            </button>
            {expanded === a.id && (
              <div style={{ marginTop: 8, paddingLeft: 40 }}>
                <div style={{ fontSize: 12, marginBottom: 6 }}>{a.action}</div>
                <LifeBar label="energy" value={a.life.energy} />
                <LifeBar label="nourishment" value={a.life.nourishment} />
                <LifeBar label="companionship" value={a.life.companionship} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, marginBottom: 10 }}>
                  timber {a.inventory.timber} · pollen {a.inventory.pollen} · sand {a.inventory.sand} · produce {a.inventory.produce}
                </div>
                <button
                  onClick={() => onToggleFollow(a.id)}
                  style={{
                    border: '1px solid var(--card-border)',
                    background: following.includes(a.id) ? 'var(--bg)' : 'none',
                    borderRadius: 999,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text)'
                  }}
                >
                  {following.includes(a.id) ? '♥ Following' : '♡ Follow'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
