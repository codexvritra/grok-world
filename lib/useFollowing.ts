'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'grok-world-following';

/**
 * Following is a per-viewer preference, not shared world state, and there's
 * no account system to hang it off — so it lives in this browser's
 * localStorage rather than the database.
 */
export function useFollowing() {
  const [following, setFollowing] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFollowing(JSON.parse(raw));
    } catch {
      // localStorage unavailable (private browsing, blocked site data, etc.) — fine, just start empty
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setFollowing((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // best-effort persistence only
      }
      return next;
    });
  }, []);

  const isFollowing = useCallback((id: string) => following.includes(id), [following]);

  return { following, isFollowing, toggle };
}
