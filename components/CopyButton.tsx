'use client';

import { useState } from 'react';

export default function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      style={{
        padding: small ? '4px 9px' : '6px 12px',
        borderRadius: 6,
        border: '1px solid var(--panel-border, rgba(255,255,255,0.15))',
        background: copied ? '#2e7d4f' : '#1a2338',
        color: '#fff',
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        whiteSpace: 'nowrap'
      }}
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}
