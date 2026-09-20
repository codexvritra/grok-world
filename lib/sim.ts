import {
  getAgents,
  saveAgent,
  insertEvent,
  getFarmBeds,
  saveFarmBed,
  getKitchen,
  saveKitchen,
  getPlots,
  savePlot,
  getGoal,
  saveGoalProgress
} from './db';
import type { Agent, FarmBed, Plot } from './types';
import { PIECE_COST } from './types';
import { generatePlaceName } from './names';

export const TICK_MS = 3000;
const WALK_SPEED = 2.2; // meters per tick
const ARRIVE_EPS = 1.5;

export const LANDMARKS = {
  square: { x: 0, y: 0 },
  kitchen: { x: -95, y: 55 },
  farm: { x: -120, y: 80 },
  lakeshore: { x: 30, y: -170 },
  forestTrail: { x: 150, y: 90 },
  meadow: { x: -90, y: -150 }
};

const GATHER_SPOTS: { key: string; label: string; resource: keyof Agent['inventory']; pos: { x: number; y: number } }[] = [
  { key: 'lakeshore', label: 'the lake shore', resource: 'sand', pos: LANDMARKS.lakeshore },
  { key: 'forestTrail', label: 'the forest trail', resource: 'timber', pos: LANDMARKS.forestTrail },
  { key: 'meadow', label: 'the hillside meadow', resource: 'pollen', pos: LANDMARKS.meadow }
];

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function setWalk(agent: Agent, target: { x: number; y: number }, intent: string, actionLabel: string, place: string) {
  agent.targetX = target.x;
  agent.targetY = target.y;
  agent.status = 'walking';
  agent.action = actionLabel;
  agent.intent = intent;
  agent.place = place;
}

function nextEmptyCell(plot: Plot): { col: number; row: number } | null {
  for (let row = 0; row < plot.gridRows; row++) {
    for (let col = 0; col < plot.gridCols; col++) {
      if (!plot.pieces.some((p) => p.col === col && p.row === row)) return { col, row };
    }
  }
  return null;
}

function decideBehavior(agent: Agent, ctx: { agents: Agent[]; beds: FarmBed[]; plots: Plot[] }) {
  if (agent.life.energy < 30) {
    setWalk(agent, LANDMARKS.square, 'rest', 'heading home to rest', 'the village square');
    return;
  }
  if (agent.life.nourishment < 35) {
    setWalk(agent, LANDMARKS.kitchen, 'eat', 'walking to the kitchen for a meal', 'the kitchen');
    return;
  }
  if (agent.life.companionship < 35) {
    const friend = ctx.agents.find((a) => a.id !== agent.id && !a.paused);
    if (friend) {
      setWalk(agent, { x: friend.x, y: friend.y }, `socialize:${friend.id}`, `walking over to chat with ${friend.name}`, agent.place);
      return;
    }
  }

  switch (agent.role) {
    case 'farmer': {
      const bed = ctx.beds.find((b) => b.stage === 'ready') ?? ctx.beds.find((b) => b.stage === 'empty') ?? ctx.beds[0];
      const phase = bed.stage === 'ready' ? 'harvest' : bed.stage === 'empty' ? 'plant' : 'tend';
      setWalk(agent, { x: bed.x, y: bed.y }, `farm:${bed.id}:${phase}`, `walking to a garden bed to ${phase}`, 'the farm');
      return;
    }
    case 'gatherer': {
      const spot = GATHER_SPOTS[Math.floor(Math.random() * GATHER_SPOTS.length)];
      setWalk(agent, spot.pos, `gather:${spot.key}`, `heading out to gather at ${spot.label}`, spot.label);
      return;
    }
    case 'cook': {
      setWalk(agent, LANDMARKS.kitchen, 'cook', 'heading to the kitchen to cook a meal', 'the kitchen');
      return;
    }
    case 'builder': {
      const myPlot = ctx.plots.find((p) => p.claimedBy === agent.id && nextEmptyCell(p));
      if (myPlot && agent.inventory.timber >= 3) {
        setWalk(
          agent,
          { x: myPlot.centroid[0], y: myPlot.centroid[1] },
          `build:piece:${myPlot.id}`,
          `walking to ${myPlot.name ?? 'a claimed plot'} to keep building`,
          myPlot.name ?? 'a claimed plot'
        );
        return;
      }
      if (agent.inventory.timber < 3) {
        setWalk(agent, LANDMARKS.forestTrail, 'gather:forestTrail', 'heading out to gather timber for building', 'the forest trail');
        return;
      }
      const unclaimed = ctx.plots.find((p) => !p.claimedBy);
      if (unclaimed) {
        setWalk(agent, { x: unclaimed.centroid[0], y: unclaimed.centroid[1] }, `build:claim:${unclaimed.id}`, 'heading out to claim a new plot', 'the village');
        return;
      }
      setWalk(agent, LANDMARKS.square, 'build', 'looking over the finished village', 'the village square');
      return;
    }
    default: {
      const angle = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 120;
      setWalk(
        agent,
        { x: clamp(Math.cos(angle) * r, -300, 300), y: clamp(Math.sin(angle) * r, -300, 300) },
        'wander',
        'taking a walk through the village',
        'the village'
      );
    }
  }
}

function resolveArrival(agent: Agent, ctx: { beds: FarmBed[]; plots: Plot[] }) {
  const [kind, ...rest] = agent.intent.split(':');
  agent.targetX = null;
  agent.targetY = null;

  switch (kind) {
    case 'rest': {
      agent.status = 'resting';
      agent.action = 'resting on a bench';
      agent.life.energy = clamp(agent.life.energy + 35, 0, 100);
      insertEvent(agent.id, agent.name, 'rest', `${agent.name} rested a while in the village square.`);
      break;
    }
    case 'eat': {
      const kitchen = getKitchen();
      if (kitchen.meals > 0) {
        kitchen.meals -= 1;
        saveKitchen(kitchen);
        agent.life.nourishment = clamp(agent.life.nourishment + 40, 0, 100);
        insertEvent(agent.id, agent.name, 'eat', `${agent.name} ate a warm meal at the kitchen.`);
      } else {
        insertEvent(agent.id, agent.name, 'eat', `${agent.name} found the kitchen empty and went hungry.`);
      }
      agent.status = 'idle';
      agent.action = 'idle near the kitchen';
      break;
    }
    case 'socialize': {
      agent.status = 'socializing';
      agent.action = 'chatting with a neighbor';
      agent.life.companionship = clamp(agent.life.companionship + 30, 0, 100);
      const friendId = rest[0];
      if (friendId && !agent.friends.includes(friendId)) agent.friends = [...agent.friends, friendId];
      insertEvent(agent.id, agent.name, 'socialize', `${agent.name} shared a story with a friend by the square.`);
      break;
    }
    case 'farm': {
      const bedId = rest[0];
      const phase = rest[1];
      const bed = ctx.beds.find((b) => b.id === bedId);
      if (bed) {
        if (phase === 'plant' && bed.stage === 'empty') {
          bed.stage = 'planted';
          bed.plantedBy = agent.id;
          bed.plantedAt = Date.now();
          saveFarmBed(bed);
          insertEvent(agent.id, agent.name, 'farm', `${agent.name} planted new seeds in the garden bed.`);
        } else if (phase === 'harvest' && bed.stage === 'ready') {
          bed.stage = 'empty';
          bed.plantedBy = null;
          bed.plantedAt = null;
          saveFarmBed(bed);
          const kitchen = getKitchen();
          kitchen.produce += 3;
          kitchen.harvestedTotal += 3;
          saveKitchen(kitchen);
          agent.contributions += 1;
          insertEvent(agent.id, agent.name, 'harvest', `${agent.name} harvested produce and carried it to the kitchen.`);
        } else {
          insertEvent(agent.id, agent.name, 'farm', `${agent.name} tended the garden beds.`);
        }
      }
      agent.status = 'idle';
      agent.action = 'idle at the farm';
      agent.life.experience += 1;
      break;
    }
    case 'gather': {
      const spot = GATHER_SPOTS.find((s) => s.key === rest[0]);
      if (spot) {
        agent.inventory[spot.resource] += 2 + Math.floor(Math.random() * 2);
        insertEvent(agent.id, agent.name, 'gather', `${agent.name} gathered ${spot.resource} at ${spot.label}.`);
      }
      agent.status = 'idle';
      agent.action = 'idle';
      agent.life.experience += 1;
      break;
    }
    case 'cook': {
      const kitchen = getKitchen();
      if (kitchen.produce >= 2) {
        kitchen.produce -= 2;
        kitchen.meals += 1;
        kitchen.cookedTotal += 1;
        saveKitchen(kitchen);
        agent.contributions += 1;
        insertEvent(agent.id, agent.name, 'cook', `${agent.name} cooked a meal from fresh produce.`);
      } else {
        insertEvent(agent.id, agent.name, 'cook', `${agent.name} checked the pantry but there wasn't enough produce yet.`);
      }
      agent.status = 'idle';
      agent.action = 'idle near the kitchen';
      break;
    }
    case 'build': {
      const sub = rest[0];
      const plotId = rest[1];
      const plot = ctx.plots.find((p) => p.id === plotId);
      if (sub === 'claim' && plot && !plot.claimedBy) {
        plot.claimedBy = agent.id;
        plot.name = generatePlaceName();
        savePlot(plot);
        insertEvent(agent.id, agent.name, 'claim_plot', `${agent.name} claimed a plot and named it "${plot.name}".`);
      } else if (sub === 'piece' && plot && plot.claimedBy === agent.id) {
        const cell = nextEmptyCell(plot);
        const type: 'floor' | 'wall' = plot.pieces.length % 2 === 0 ? 'floor' : 'wall';
        const cost = PIECE_COST[type];
        if (cell && agent.inventory.timber >= (cost.timber ?? 0)) {
          agent.inventory.timber -= cost.timber ?? 0;
          plot.pieces.push({ col: cell.col, row: cell.row, type, builtBy: agent.id });
          savePlot(plot);
          agent.contributions += 1;
          insertEvent(agent.id, agent.name, 'build_piece', `${agent.name} built a ${type} at ${plot.name}.`);
        } else {
          insertEvent(agent.id, agent.name, 'build', `${agent.name} looked over ${plot.name} for more work to do.`);
        }
      } else {
        insertEvent(agent.id, agent.name, 'build', `${agent.name} looked over the village plots for work to do.`);
      }
      agent.status = 'idle';
      agent.action = 'idle near the plots';
      agent.life.experience += 1;
      break;
    }
    default: {
      agent.status = 'idle';
      agent.action = 'idle';
    }
  }
  agent.intent = '';
}

function decayLife(agent: Agent) {
  agent.life.energy = clamp(agent.life.energy - 0.6, 0, 100);
  agent.life.nourishment = clamp(agent.life.nourishment - 0.5, 0, 100);
  agent.life.companionship = clamp(agent.life.companionship - 0.35, 0, 100);
}

function advanceFarmGrowth() {
  const beds = getFarmBeds();
  const now = Date.now();
  for (const bed of beds) {
    if (bed.stage === 'planted' && bed.plantedAt && now - bed.plantedAt > 20_000) {
      bed.stage = 'growing';
      saveFarmBed(bed);
    } else if (bed.stage === 'growing' && bed.plantedAt && now - bed.plantedAt > 40_000) {
      bed.stage = 'ready';
      saveFarmBed(bed);
    }
  }
}

function recomputeGoalProgress() {
  const plots = getPlots();
  const totalPieces = plots.reduce((sum, p) => sum + p.pieces.length, 0);
  const goal = getGoal();
  if (goal && goal.progress !== totalPieces) {
    saveGoalProgress(Math.min(totalPieces, goal.target));
  }
}

export function tick() {
  const agents = getAgents();
  const beds = getFarmBeds();
  const plots = getPlots();

  for (const agent of agents) {
    if (agent.paused) continue;
    decayLife(agent);

    if (agent.targetX !== null && agent.targetY !== null) {
      const d = dist(agent.x, agent.y, agent.targetX, agent.targetY);
      if (d <= ARRIVE_EPS) {
        resolveArrival(agent, { beds, plots });
      } else {
        const step = Math.min(WALK_SPEED, d);
        agent.x += ((agent.targetX - agent.x) / d) * step;
        agent.y += ((agent.targetY - agent.y) / d) * step;
      }
    } else if (agent.source === 'seeded') {
      decideBehavior(agent, { agents, beds, plots });
    }

    saveAgent(agent);
  }

  advanceFarmGrowth();
  recomputeGoalProgress();
}

export { PIECE_COST };
