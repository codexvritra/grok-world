'use client';

import Link from 'next/link';

export default function ControlCluster({
  dayNight,
  onToggleDayNight,
  zoomLevel,
  onToggleZoom
}: {
  dayNight: 'day' | 'night';
  onToggleDayNight: () => void;
  zoomLevel: 'village' | 'island';
  onToggleZoom: () => void;
}) {
  return (
    <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 10 }}>
      <button className="icon-btn" onClick={onToggleDayNight} title="Toggle day/night">
        {dayNight === 'day' ? '☀️' : '🌙'}
      </button>
      <button className="icon-btn" onClick={onToggleZoom} title="Toggle zoom">
        {zoomLevel === 'village' ? '🔍' : '🗺️'}
      </button>
      <Link
        href="/register"
        className="icon-btn"
        style={{ width: 'auto', padding: '0 16px', background: 'var(--accent)', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
      >
        + Bring your Spark
      </Link>
    </div>
  );
}
