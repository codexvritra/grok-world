'use client';

import { useEffect, useRef, useState } from 'react';
import { thumbnailUrl } from '@/lib/uiConstants';

const MAX_ATTEMPTS = 10;
const POLL_MS = 3000;

/**
 * mshots (the free screenshot service we use for thumbnails) doesn't render
 * a fresh URL synchronously — the first request kicks off the render job and
 * returns a placeholder GIF; only once it's done does the same URL start
 * returning the real JPEG. We poll a few times, swapping in whatever's
 * current each attempt, until we see a non-GIF response or run out of tries.
 */
export default function WebThumbnail({ pageUrl, style }: { pageUrl: string; style?: React.CSSProperties }) {
  const [src, setSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const base = thumbnailUrl(pageUrl);

    const revokePrev = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`${base}&_try=${attempt}`, { cache: 'no-store' });
        const blob = await res.blob();
        if (cancelled) return;
        revokePrev();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setSrc(objectUrl);
        if (blob.type === 'image/gif' && attempt < MAX_ATTEMPTS) {
          attempt++;
          setTimeout(poll, POLL_MS);
        }
      } catch {
        // leave whatever we already have showing; a network blip isn't worth retrying forever
      }
    }
    poll();

    return () => {
      cancelled = true;
      revokePrev();
    };
  }, [pageUrl]);

  if (!src) {
    return <div style={{ background: 'var(--bg)', ...style }} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={style} />;
}
