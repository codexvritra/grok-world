'use client';

export default function ComingSoonPanel({ title, description, onClose }: { title: string; description: string; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{title}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{description}</p>
        <button
          onClick={onClose}
          style={{ marginTop: 18, border: 'none', background: '#161a24', color: '#fff', borderRadius: 999, padding: '10px 20px', fontWeight: 700, fontSize: 13 }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
