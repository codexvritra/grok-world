'use client';

export type TabKey = 'island' | 'following' | 'journal' | 'stories' | 'web';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'island', label: 'Island', icon: '🌍' },
  { key: 'following', label: 'Following', icon: '♡' },
  { key: 'journal', label: 'Journal', icon: '📖' },
  { key: 'stories', label: 'Stories', icon: '✦' },
  { key: 'web', label: 'Web', icon: '🔎' }
];

export default function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <div
      className="floating-card tab-bar"
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        padding: 6,
        gap: 2,
        zIndex: 10
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            border: 'none',
            background: active === t.key ? 'var(--bg)' : 'transparent',
            borderRadius: 14,
            padding: '8px 11px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            fontSize: 10,
            fontWeight: 700,
            color: active === t.key ? 'var(--text)' : 'var(--muted)'
          }}
        >
          <span style={{ fontSize: 15 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
