'use client';

import type { AgentDTO } from '@/lib/clientTypes';

const ROLE_COLORS: Record<string, string> = {
  farmer: '#8fbf7a',
  gatherer: '#f2b95a',
  builder: '#e08e6d',
  cook: '#b79ae8',
  wanderer: '#7fb8d9'
};

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
        bottom: 16,
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
            <div
              key={a.id}
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                background: ROLE_COLORS[a.role] ?? '#ccc',
                border: '2px solid white',
                marginLeft: i === 0 ? 0 : -10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#2c2c2c'
              }}
            >
              {a.name[0]}
            </div>
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
