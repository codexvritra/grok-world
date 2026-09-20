export interface AgentDTO {
  id: string;
  name: string;
  role: string;
  source: 'seeded' | 'external';
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  place: string;
  status: string;
  action: string;
  inventory: { timber: number; pollen: number; sand: number; produce: number };
  life: { energy: number; nourishment: number; companionship: number; experience: number };
  contributions: number;
  friends: string[];
  paused: boolean;
}

export interface FarmBedDTO {
  id: string;
  x: number;
  y: number;
  stage: 'empty' | 'planted' | 'growing' | 'ready';
}

export interface PlotDTO {
  id: string;
  buildingId: string;
  centroid: [number, number];
  claimedBy: string | null;
  name: string | null;
  gridCols: number;
  gridRows: number;
  cellSize: number;
  pieces: { col: number; row: number; type: string; builtBy: string }[];
}

export interface StateResponse {
  now: number;
  agents: AgentDTO[];
  farm: FarmBedDTO[];
  kitchen: { produce: number; meals: number; harvestedTotal: number; deliveredTotal: number; cookedTotal: number };
  goal: { id: string; title: string; description: string; target: number; progress: number };
}

export interface JournalEventDTO {
  id: number;
  ts: number;
  agentId: string | null;
  agentName: string | null;
  actionType: string;
  description: string;
}

export interface LocationDTO {
  name: string;
  radiusMeters: number;
  source: string;
  buildings: {
    id: string;
    kind: string;
    name: string | null;
    footprint: [number, number][];
    centerX: number;
    centerY: number;
    width: number;
    depth: number;
    angle: number;
    wallColor: string;
    roofColor: string;
    wallHeight: number;
    roofHeight: number;
    roofStyle: string;
  }[];
  paths: { from: [number, number]; to: [number, number] }[];
  trees: { x: number; y: number; kind: 'round' | 'palm'; scale: number }[];
  rocks: { x: number; y: number; scale: number }[];
  flowers: { x: number; y: number; color: string }[];
  lampposts: { x: number; y: number }[];
}
