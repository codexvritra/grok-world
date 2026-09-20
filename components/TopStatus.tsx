'use client';

function LogoMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" style={{ flexShrink: 0 }}>
      <circle cx="15" cy="15" r="14" fill="#1a1f2b" />
      <circle cx="15" cy="15" r="14" fill="none" stroke="#3a4258" strokeWidth="1" />
      <line x1="6" y1="24" x2="24" y2="6" stroke="#f2f2f2" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function TopStatus({ residentCount }: { residentCount: number }) {
  return (
    <div
      className="floating-card brand-header"
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        padding: '10px 18px 10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        zIndex: 10
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LogoMark />
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.2 }}>Grok World</div>
          <div className="brand-tagline" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.3 }}>
            Explore · Connect · Build
          </div>
        </div>
      </div>
      <div className="brand-status" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: '#5fbf6a', display: 'inline-block' }} />
        Connected to the island · {residentCount} resident{residentCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}
