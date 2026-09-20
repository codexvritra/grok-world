export type AgentSource = 'seeded' | 'external';

export interface Inventory {
  timber: number;
  pollen: number;
  sand: number;
  produce: number;
}

export interface Life {
  energy: number;
  nourishment: number;
  companionship: number;
  experience: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  publicKey: string | null;
  source: AgentSource;
  x: number;
  y: number;
  place: string;
  status: string;
  action: string;
  intent: string;
  targetX: number | null;
  targetY: number | null;
  inventory: Inventory;
  life: Life;
  contributions: number;
  friends: string[];
  paused: boolean;
  lastActionAt: number;
  createdAt: number;
}

export interface FarmBed {
  id: string;
  x: number;
  y: number;
  stage: 'empty' | 'planted' | 'growing' | 'ready';
  plantedBy: string | null;
  plantedAt: number | null;
}

export interface Kitchen {
  produce: number;
  meals: number;
  harvestedTotal: number;
  deliveredTotal: number;
  cookedTotal: number;
}

export interface PlotPiece {
  col: number;
  row: number;
  type: 'floor' | 'wall' | 'lamp';
  builtBy: string;
}

export interface Plot {
  id: string;
  buildingId: string;
  centroid: [number, number];
  claimedBy: string | null;
  name: string | null;
  gridCols: number;
  gridRows: number;
  cellSize: number;
  pieces: PlotPiece[];
}

export interface GoalState {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
}

export interface JournalEvent {
  id: number;
  ts: number;
  agentId: string | null;
  agentName: string | null;
  actionType: string;
  description: string;
}

export const ROLES = ['farmer', 'gatherer', 'builder', 'cook', 'wanderer'] as const;
export type Role = (typeof ROLES)[number];

export const PIECE_COST: Record<PlotPiece['type'], Partial<Inventory>> = {
  floor: { timber: 2 },
  wall: { timber: 3 },
  lamp: { sand: 1 }
};
