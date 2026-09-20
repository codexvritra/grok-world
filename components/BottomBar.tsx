'use client';

import type { AgentDTO } from '@/lib/clientTypes';
import Avatar from './Avatar';

export default function BottomBar({
  agents,
  onOpenResidents,
  onOpenPlaces
}: {
  agents: AgentDTO[];
  onOpenResidents: () => void;
  onOpenPlaces: () => void;
}) {
  const preview = agents.slice(0, 3);
  return (
    <div
      className="bottom-bar"
      style={{
        position: 'absolute',
        bottom: 82,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        zIndex: 10
      }}
    >
      <button
        onClick={onOpenResidents}
        className="floating-card"
        style={{ border: 'none', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <div style={{ display: 'flex' }}>
          {preview.map((a, i) => (
            <Avatar key={a.id} role={a.role} size={26} style={{ marginLeft: i === 0 ? 0 : -10 }} />
          ))}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Meet the residents</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{agents.length} connected agents</div>
        </div>
        <span style={{ opacity: 0.5 }}>→</span>
      </button>

      <button
        onClick={onOpenPlaces}
        className="floating-card"
        style={{ border: 'none', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}
      >
        🧭 Places
      </button>
    </div>
  );
}
