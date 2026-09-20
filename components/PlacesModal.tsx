'use client';

import type { PlotDTO, AgentDTO } from '@/lib/clientTypes';

export default function PlacesModal({ plots, agents, onClose }: { plots: PlotDTO[]; agents: AgentDTO[]; onClose: () => void }) {
  const named = plots.filter((p) => p.name);
  const unclaimed = plots.filter((p) => !p.claimedBy);
  const nameOf = (id: string | null) => agents.find((a) => a.id === id)?.name ?? 'someone';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Places ({named.length})</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)' }}>
            ✕
          </button>
        </div>
        {named.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No plots have been claimed and named yet.</p>}
        {named.map((p) => (
          <div key={p.id} style={{ borderBottom: '1px solid var(--card-border)', padding: '10px 0' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {p.pieces.length <= 1 ? '✦' : '●'} {p.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              founded by {nameOf(p.claimedBy)} · {p.pieces.length} piece{p.pieces.length === 1 ? '' : 's'} built
            </div>
          </div>
        ))}
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>{unclaimed.length} plots still unclaimed on the island.</div>
      </div>
    </div>
  );
}
