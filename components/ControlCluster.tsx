'use client';

import Link from 'next/link';

export default function ControlCluster({
  residentCount,
  dayNight,
  onToggleDayNight,
  zoomLevel,
  onToggleZoom
}: {
  residentCount: number;
  dayNight: 'day' | 'night';
  onToggleDayNight: () => void;
  zoomLevel: 'village' | 'island';
  onToggleZoom: () => void;
}) {
  return (
    <div className="control-cluster" style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
      <button className="icon-btn" onClick={onToggleDayNight} title="Toggle day/night">
        {dayNight === 'day' ? '☀️' : '🌙'}
      </button>
      <button className="icon-btn" onClick={onToggleZoom} title="Toggle zoom">
        {zoomLevel === 'village' ? '🔍' : '🗺️'}
      </button>

      <div
        className="floating-card online-pill"
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}
      >
        👥 {residentCount} online
      </div>

      <Link
        href="/register"
        className="join-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 40,
          padding: '0 18px',
          borderRadius: 999,
          background: '#161a24',
          color: '#fff',
          fontWeight: 700,
          fontSize: 13,
          textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap'
        }}
      >
        + Join<span className="join-label"> Grok World</span>
      </Link>
    </div>
  );
}
