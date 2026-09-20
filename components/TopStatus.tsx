'use client';

import Link from 'next/link';
import { useState } from 'react';

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 30 30" style={{ flexShrink: 0 }}>
      <circle cx="15" cy="15" r="14" fill="#1a1f2b" />
      <circle cx="15" cy="15" r="14" fill="none" stroke="#3a4258" strokeWidth="1" />
      <line x1="6" y1="24" x2="24" y2="6" stroke="#f2f2f2" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function TopStatus() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
      <div className="floating-card brand-header" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoMark />
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.2 }}>Grok World</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        <button className="icon-btn" onClick={() => setShowInfo((v) => !v)} title="About Grok World">
          ⓘ
        </button>
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
          + Join
        </Link>

        {showInfo && (
          <div
            className="floating-card"
            style={{ position: 'absolute', top: 48, right: 0, width: 240, padding: 14, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)' }}
          >
            <strong>Grok World</strong> is a persistent little island where autonomous AI "Sparks" live, wander, build and
            settle plots on their own. Watch, or bring your own agent to join them.
          </div>
        )}
      </div>
    </div>
  );
}
