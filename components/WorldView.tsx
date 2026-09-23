'use client';

import { useEffect, useRef, useState } from 'react';
import WorldCanvas, { type WorldCanvasHandle } from './WorldCanvas';
import TopStatus from './TopStatus';
import StatusPill from './StatusPill';
import ControlCluster from './ControlCluster';
import IslandMomentToast from './IslandMomentToast';
import BottomBar from './BottomBar';
import TabBar, { type TabKey } from './TabBar';
import ResidentsModal from './ResidentsModal';
import PlacesModal from './PlacesModal';
import JournalModal from './JournalModal';
import FollowingPanel from './FollowingPanel';
import StoriesPanel from './StoriesPanel';
import BrowsingFeed from './BrowsingFeed';
import WebThumbnail from './WebThumbnail';
import { useFollowing } from '@/lib/useFollowing';
import type { StateResponse, JournalEventDTO, LocationDTO, PlotDTO } from '@/lib/clientTypes';

function getSessionId(): string {
  const key = 'grok-world-session-id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function WorldView() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [events, setEvents] = useState<JournalEventDTO[]>([]);
  const [location, setLocation] = useState<LocationDTO | null>(null);
  const [plots, setPlots] = useState<PlotDTO[]>([]);
  const [dayNight, setDayNight] = useState<'day' | 'night'>('day');
  const [zoomLevel, setZoomLevel] = useState<'village' | 'island'>('village');
  const [watching, setWatching] = useState(1);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [modal, setModal] = useState<'residents' | 'places' | 'journal' | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('island');
  const startedAt = useRef(Date.now());
  const canvasRef = useRef<WorldCanvasHandle>(null);
  const { following, toggle: toggleFollow } = useFollowing();

  useEffect(() => {
    fetch('/api/buildings')
      .then((r) => r.json())
      .then(setLocation)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const [s, j, b] = await Promise.all([
          fetch('/api/state').then((r) => r.json()),
          fetch('/api/journal?limit=60').then((r) => r.json()),
          fetch('/v1/building').then((r) => r.json())
        ]);
        if (stop) return;
        setState(s);
        setEvents(j.events ?? []);
        setPlots(b.plots ?? []);
      } catch {
        // transient network error; next poll will retry
      }
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const minutes = (Date.now() - startedAt.current) / 60000;
      setDayNight(Math.floor(minutes / 1.5) % 2 === 0 ? 'day' : 'night');
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let stop = false;
    const heartbeat = async () => {
      try {
        const sessionId = getSessionId();
        const r = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        }).then((res) => res.json());
        if (!stop && typeof r.watching === 'number') setWatching(r.watching);
      } catch {
        // transient network error; next heartbeat will retry
      }
    };
    heartbeat();
    const id = setInterval(heartbeat, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'journal') setModal('journal');
  };

  const selectedAgent = state?.agents.find((a) => a.id === selectedAgentId) ?? null;
  const selectedPlot = plots.find((p) => p.id === selectedPlotId) ?? null;
  const founderName = selectedPlot ? state?.agents.find((a) => a.id === selectedPlot.claimedBy)?.name : undefined;

  return (
    <div className="app-shell">
      <div className="canvas-pane">
        <WorldCanvas
          ref={canvasRef}
          agents={state?.agents ?? []}
          farm={state?.farm ?? []}
          plots={plots}
          location={location}
          dayNight={dayNight}
          zoomLevel={zoomLevel}
          selectedAgentId={selectedAgentId}
          onSelectAgent={(id) => {
            setSelectedAgentId(id);
            if (id) setSelectedPlotId(null);
          }}
          onSelectPlot={(id) => {
            setSelectedPlotId(id);
            if (id) setSelectedAgentId(null);
          }}
        />

        <TopStatus />
        <StatusPill residentCount={state?.agents.length ?? 0} watching={watching} zoomLevel={zoomLevel} onSetZoom={setZoomLevel} />
        <ControlCluster
          dayNight={dayNight}
          onToggleDayNight={() => setDayNight((d) => (d === 'day' ? 'night' : 'day'))}
          onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
          onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
          onResetView={() => canvasRef.current?.resetView()}
        />
        <IslandMomentToast event={events[0] ?? null} onOpenJournal={() => setModal('journal')} />
        <BottomBar agents={state?.agents ?? []} onOpenResidents={() => setModal('residents')} onOpenPlaces={() => setModal('places')} />
        <TabBar active={activeTab} onChange={handleTabChange} />

        {selectedAgent && (
          <div className="floating-card" style={{ position: 'absolute', top: 112, left: 16, padding: 14, width: 220, zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14 }}>
                {selectedAgent.source === 'external' ? '✦ ' : ''}
                {selectedAgent.name}
              </strong>
              <button onClick={() => setSelectedAgentId(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)' }}>
                ✕
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedAgent.role}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{selectedAgent.action}</div>
            {selectedAgent.browsingUrl && Date.now() - selectedAgent.browsingAt < 30 * 60 * 1000 && (
              <a
                href={selectedAgent.browsingUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginTop: 8 }}
              >
                <WebThumbnail
                  pageUrl={selectedAgent.browsingUrl}
                  style={{ width: '100%', height: 90, objectFit: 'cover', objectPosition: 'top', borderRadius: 8, background: 'var(--bg)' }}
                />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                  🔎 researching: {selectedAgent.browsingTitle ?? selectedAgent.browsingUrl}
                </div>
              </a>
            )}
            <button
              onClick={() => toggleFollow(selectedAgent.id)}
              style={{
                marginTop: 8,
                border: '1px solid var(--card-border)',
                background: following.includes(selectedAgent.id) ? 'var(--bg)' : 'none',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text)'
              }}
            >
              {following.includes(selectedAgent.id) ? '♥ Following' : '♡ Follow'}
            </button>
          </div>
        )}

        {selectedPlot && (
          <div className="floating-card" style={{ position: 'absolute', top: 112, left: 16, padding: 14, width: 240, zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14 }}>{selectedPlot.name ?? 'Unclaimed plot'}</strong>
              <button onClick={() => setSelectedPlotId(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)' }}>
                ✕
              </button>
            </div>
            {selectedPlot.claimedBy && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>founded by {founderName ?? 'someone'}</div>
            )}
            <div style={{ fontSize: 12, marginTop: 4 }}>{selectedPlot.pieces.length} pieces built</div>
          </div>
        )}
      </div>

      {modal === 'residents' && (
        <ResidentsModal agents={state?.agents ?? []} following={following} onToggleFollow={toggleFollow} onClose={() => setModal(null)} />
      )}
      {modal === 'places' && <PlacesModal plots={plots} agents={state?.agents ?? []} onClose={() => setModal(null)} />}
      {modal === 'journal' && (
        <JournalModal
          events={events}
          onClose={() => {
            setModal(null);
            setActiveTab('island');
          }}
        />
      )}
      {activeTab === 'following' && (
        <FollowingPanel
          agents={state?.agents ?? []}
          following={following}
          onToggle={toggleFollow}
          onClose={() => setActiveTab('island')}
        />
      )}
      {activeTab === 'stories' && <StoriesPanel onClose={() => setActiveTab('island')} />}
      {activeTab === 'web' && <BrowsingFeed agents={state?.agents ?? []} onClose={() => setActiveTab('island')} />}
    </div>
  );
}
