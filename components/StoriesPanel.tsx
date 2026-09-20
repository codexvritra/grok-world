'use client';

import { useEffect, useState } from 'react';

interface Story {
  id: string;
  title: string;
  stat: string;
  highlights: string[];
  ts: number;
}

export default function StoriesPanel({ onClose }: { onClose: () => void }) {
  const [stories, setStories] = useState<Story[] | null>(null);

  useEffect(() => {
    let stop = false;
    fetch('/api/stories')
      .then((r) => r.json())
      .then((d) => {
        if (!stop) setStories(d.stories ?? []);
      })
      .catch(() => {
        if (!stop) setStories([]);
      });
    return () => {
      stop = true;
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Stories</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)' }}>
            ✕
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0, marginBottom: 14 }}>
          Recaps of the island, chaptered by the hour and pulled straight from the journal.
        </p>

        {stories === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>}
        {stories?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing has happened yet — check back soon.</p>}

        {stories?.map((s) => (
          <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>✦ {s.title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, marginBottom: 6 }}>{s.stat}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
              {s.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
