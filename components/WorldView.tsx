'use client';

import { useEffect, useRef, useState } from 'react';
import WorldCanvas from './WorldCanvas';
import TopStatus from './TopStatus';
import ControlCluster from './ControlCluster';
import IslandMomentToast from './IslandMomentToast';
import BottomBar from './BottomBar';
import ResidentsModal from './ResidentsModal';
import PlacesModal from './PlacesModal';
import JournalModal from './JournalModal';
import type { StateResponse, JournalEventDTO, LocationDTO, PlotDTO } from '@/lib/clientTypes';

export default function WorldView() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [events, setEvents] = useState<JournalEventDTO[]>([]);
  const [location, setLocation] = useState<LocationDTO | null>(null);
  const [plots, setPlots] = useState<PlotDTO[]>([]);
  const [dayNight, setDayNight] = useState<'day' | 'night'>('day');
  const [zoomLevel, setZoomLevel] = useState<'village' | 'island'>('village');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [modal, setModal] = useState<'residents' | 'places' | 'journal' | null>(null);
  const startedAt = useRef(Date.now());

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

  const selectedAgent = state?.agents.find((a) => a.id === selectedAgentId) ?? null;
  const selectedPlot = plots.find((p) => p.id === selectedPlotId) ?? null;
  const founderName = selectedPlot ? state?.agents.find((a) => a.id === selectedPlot.claimedBy)?.name : undefined;

  return (
    <div className="app-shell">
      <div className="canvas-pane">
        <WorldCanvas
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

        <TopStatus residentCount={state?.agents.length ?? 0} />
        <ControlCluster
          dayNight={dayNight}
          onToggleDayNight={() => setDayNight((d) => (d === 'day' ? 'night' : 'day'))}
          zoomLevel={zoomLevel}
          onToggleZoom={() => setZoomLevel((z) => (z === 'village' ? 'island' : 'village'))}
        />
        <IslandMomentToast event={events[0] ?? null} onOpenJournal={() => setModal('journal')} />
        <BottomBar agents={state?.agents ?? []} onOpenResidents={() => setModal('residents')} onOpenPlaces={() => setModal('places')} />

        <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: 'rgba(44,44,44,0.55)', zIndex: 10 }}>
          Drag to wander · Scroll to zoom
        </div>

        {selectedAgent && (
          <div className="floating-card" style={{ position: 'absolute', top: 68, left: 16, padding: 14, width: 220, zIndex: 10 }}>
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
          </div>
        )}

        {selectedPlot && (
          <div className="floating-card" style={{ position: 'absolute', top: 68, left: 16, padding: 14, width: 240, zIndex: 10 }}>
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

      {modal === 'residents' && <ResidentsModal agents={state?.agents ?? []} onClose={() => setModal(null)} />}
      {modal === 'places' && <PlacesModal plots={plots} agents={state?.agents ?? []} onClose={() => setModal(null)} />}
      {modal === 'journal' && <JournalModal events={events} onClose={() => setModal(null)} />}
    </div>
  );
}
