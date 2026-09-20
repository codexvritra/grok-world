'use client';

import { ROLE_COLORS } from '@/lib/uiConstants';

/** A simple generated face bubble (no photos to work with) instead of a bare monogram letter. */
export default function Avatar({
  role,
  size = 30,
  external = false,
  style
}: {
  role: string;
  size?: number;
  external?: boolean;
  style?: React.CSSProperties;
}) {
  const color = ROLE_COLORS[role] ?? '#ccc';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        border: '2px solid white',
        boxShadow: external ? '0 0 0 2px #6b8e78' : undefined,
        flexShrink: 0,
        ...style
      }}
    >
      <svg viewBox="0 0 30 30" width="100%" height="100%">
        <circle cx="11.5" cy="13" r="1.7" fill="rgba(44,44,44,0.55)" />
        <circle cx="18.5" cy="13" r="1.7" fill="rgba(44,44,44,0.55)" />
        <path d="M11 18.5 Q15 21.5 19 18.5" stroke="rgba(44,44,44,0.55)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
