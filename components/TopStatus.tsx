'use client';

export default function TopStatus({ residentCount }: { residentCount: number }) {
  return (
    <div
      className="floating-card"
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        zIndex: 10
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: '#5fbf6a', display: 'inline-block' }} />
      <span>
        Connected to the island · {residentCount} resident{residentCount === 1 ? '' : 's'}
      </span>
    </div>
  );
}
