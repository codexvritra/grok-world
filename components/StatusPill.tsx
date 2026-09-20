'use client';

export default function StatusPill({
  residentCount,
  watching,
  zoomLevel,
  onSetZoom
}: {
  residentCount: number;
  watching: number;
  zoomLevel: 'village' | 'island';
  onSetZoom: (z: 'village' | 'island') => void;
}) {
  return (
    <div
      className="floating-card status-pill"
      style={{
        position: 'absolute',
        top: 68,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '10px 14px',
        zIndex: 10,
        fontSize: 12.5,
        whiteSpace: 'nowrap'
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: '#5fbf6a', display: 'inline-block' }} />
        {watching} watching · {residentCount} resident{residentCount === 1 ? '' : 's'}
      </span>
      <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 999, padding: 3 }}>
        {(['village', 'island'] as const).map((z) => (
          <button
            key={z}
            onClick={() => onSetZoom(z)}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              background: zoomLevel === z ? '#161a24' : 'transparent',
              color: zoomLevel === z ? '#fff' : 'var(--text)'
            }}
          >
            {z === 'village' ? 'Village' : 'Whole island'}
          </button>
        ))}
      </div>
    </div>
  );
}
