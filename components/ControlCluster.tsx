'use client';

export default function ControlCluster({
  dayNight,
  onToggleDayNight,
  onZoomIn,
  onZoomOut,
  onResetView
}: {
  dayNight: 'day' | 'night';
  onToggleDayNight: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}) {
  return (
    <div
      className="control-cluster"
      style={{
        position: 'absolute',
        top: '50%',
        right: 16,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10
      }}
    >
      <button className="icon-btn" onClick={onResetView} title="Reset view">
        🧭
      </button>
      <button className="icon-btn" onClick={onZoomIn} title="Zoom in">
        +
      </button>
      <button className="icon-btn" onClick={onZoomOut} title="Zoom out">
        −
      </button>
      <button className="icon-btn" onClick={onToggleDayNight} title="Toggle day/night">
        {dayNight === 'day' ? '☀️' : '🌙'}
      </button>
    </div>
  );
}
