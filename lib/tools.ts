import type { Agent } from './types';
import { PIECE_COST, ROLES } from './types';
import {
  saveAgent,
  insertEvent,
  getFarmBeds,
  saveFarmBed,
  getKitchen,
  saveKitchen,
  getPlotById,
  savePlot,
  getPlots,
  getAgentJournal,
  getAgents
} from './db';
import { LANDMARKS } from './sim';
import { generatePlaceName } from './names';

export class ToolError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const READ_ONLY_TOOLS = new Set(['read_my_journal', 'inspect_my_observation']);

export const TOOL_NAMES = [
  'choose_occupation',
  'work_garden_bed',
  'take_island_action',
  'claim_plot',
  'build_piece',
  'release_empty_plot',
  'read_my_journal',
  'inspect_my_observation'
] as const;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export async function runTool(agent: Agent, tool: string, params: any): Promise<any> {
  switch (tool) {
    case 'choose_occupation': {
      const role = params?.role;
      if (typeof role !== 'string' || !ROLES.includes(role as any)) {
        throw new ToolError('invalid_params', `role must be one of: ${ROLES.join(', ')}`);
      }
      agent.role = role;
      agent.action = `took up work as a ${role}`;
      agent.status = 'idle';
      await insertEvent(agent.id, agent.name, 'occupation', `${agent.name} chose to work as a ${role}.`);
      return { ok: true, role };
    }

    case 'work_garden_bed': {
      const bedId = params?.bedId;
      const op = params?.op; // plant | tend | harvest
      const beds = await getFarmBeds();
      const bed = beds.find((b) => b.id === bedId);
      if (!bed) throw new ToolError('not_found', 'unknown bedId');
      if (op === 'plant' && bed.stage === 'empty') {
        bed.stage = 'planted';
        bed.plantedBy = agent.id;
        bed.plantedAt = Date.now();
        await saveFarmBed(bed);
        await insertEvent(agent.id, agent.name, 'farm', `${agent.name} planted seeds in a garden bed.`);
      } else if (op === 'tend' && (bed.stage === 'planted' || bed.stage === 'growing')) {
        await insertEvent(agent.id, agent.name, 'farm', `${agent.name} tended a garden bed.`);
      } else if (op === 'harvest' && bed.stage === 'ready') {
        bed.stage = 'empty';
        bed.plantedBy = null;
        bed.plantedAt = null;
        await saveFarmBed(bed);
        const kitchen = await getKitchen();
        kitchen.produce += 3;
        kitchen.harvestedTotal += 3;
        await saveKitchen(kitchen);
        agent.contributions += 1;
        await insertEvent(agent.id, agent.name, 'harvest', `${agent.name} harvested a garden bed.`);
      } else {
        throw new ToolError('invalid_state', `cannot ${op} a bed in stage ${bed.stage}`);
      }
      agent.life.experience += 1;
      agent.x = bed.x;
      agent.y = bed.y;
      agent.place = 'the farm';
      return { ok: true, bed };
    }

    case 'take_island_action': {
      const action = params?.action;
      const place = agent.place;
      switch (action) {
        case 'gather': {
          const resource = params?.resource ?? 'timber';
          if (!['timber', 'pollen', 'sand'].includes(resource)) throw new ToolError('invalid_params', 'unknown resource');
          agent.inventory[resource as 'timber' | 'pollen' | 'sand'] += 2;
          await insertEvent(agent.id, agent.name, 'gather', `${agent.name} gathered ${resource}.`);
          break;
        }
        case 'explore': {
          const angle = Math.random() * Math.PI * 2;
          const r = 40 + Math.random() * 150;
          agent.x = clamp(Math.cos(angle) * r, -300, 300);
          agent.y = clamp(Math.sin(angle) * r, -300, 300);
          await insertEvent(agent.id, agent.name, 'explore', `${agent.name} explored a new corner of the village.`);
          break;
        }
        case 'craft':
          await insertEvent(agent.id, agent.name, 'craft', `${agent.name} crafted something small from raw materials.`);
          break;
        case 'deliver':
          agent.contributions += 0.5;
          await insertEvent(agent.id, agent.name, 'deliver', `${agent.name} delivered supplies to a neighbor.`);
          break;
        case 'restore':
          agent.contributions += 1;
          await insertEvent(agent.id, agent.name, 'restore', `${agent.name} restored a weathered piece of the village.`);
          break;
        case 'socialize': {
          agent.life.companionship = clamp(agent.life.companionship + 25, 0, 100);
          await insertEvent(agent.id, agent.name, 'socialize', `${agent.name} socialized near ${place}.`);
          break;
        }
        case 'rest':
          agent.life.energy = clamp(agent.life.energy + 35, 0, 100);
          agent.x = LANDMARKS.square.x;
          agent.y = LANDMARKS.square.y;
          await insertEvent(agent.id, agent.name, 'rest', `${agent.name} rested in the village square.`);
          break;
        case 'collect_produce': {
          const kitchen = await getKitchen();
          const amt = Math.min(3, kitchen.produce);
          kitchen.produce -= amt;
          await saveKitchen(kitchen);
          agent.inventory.produce += amt;
          await insertEvent(agent.id, agent.name, 'collect_produce', `${agent.name} collected produce from the kitchen store.`);
          break;
        }
        case 'deliver_produce': {
          const amt = Math.min(agent.inventory.produce, params?.quantity ?? agent.inventory.produce);
          agent.inventory.produce -= amt;
          const kitchen = await getKitchen();
          kitchen.produce += amt;
          kitchen.deliveredTotal += amt;
          await saveKitchen(kitchen);
          await insertEvent(agent.id, agent.name, 'deliver_produce', `${agent.name} delivered produce to the kitchen.`);
          break;
        }
        case 'cook': {
          const kitchen = await getKitchen();
          if (kitchen.produce < 2) throw new ToolError('invalid_state', 'not enough produce to cook');
          kitchen.produce -= 2;
          kitchen.meals += 1;
          kitchen.cookedTotal += 1;
          await saveKitchen(kitchen);
          agent.contributions += 1;
          await insertEvent(agent.id, agent.name, 'cook', `${agent.name} cooked a meal.`);
          break;
        }
        case 'eat': {
          const kitchen = await getKitchen();
          if (kitchen.meals < 1) throw new ToolError('invalid_state', 'no meals available');
          kitchen.meals -= 1;
          await saveKitchen(kitchen);
          agent.life.nourishment = clamp(agent.life.nourishment + 40, 0, 100);
          await insertEvent(agent.id, agent.name, 'eat', `${agent.name} ate a meal.`);
          break;
        }
        default:
          throw new ToolError('invalid_params', `unknown island action: ${action}`);
      }
      agent.life.experience += 1;
      return { ok: true };
    }

    case 'claim_plot': {
      const plotId = params?.plotId;
      const plot = await getPlotById(plotId);
      if (!plot) throw new ToolError('not_found', 'unknown plotId');
      if (plot.claimedBy && plot.claimedBy !== agent.id) throw new ToolError('conflict', 'plot already claimed');
      plot.claimedBy = agent.id;
      if (!plot.name) plot.name = generatePlaceName();
      await savePlot(plot);
      await insertEvent(agent.id, agent.name, 'claim_plot', `${agent.name} claimed a plot and named it "${plot.name}".`);
      return { ok: true, plot };
    }

    case 'build_piece': {
      const plotId = params?.plotId;
      const col = params?.col;
      const row = params?.row;
      const type = params?.type;
      const plot = await getPlotById(plotId);
      if (!plot) throw new ToolError('not_found', 'unknown plotId');
      if (plot.claimedBy !== agent.id) throw new ToolError('forbidden', 'you have not claimed this plot');
      if (!(type in PIECE_COST)) throw new ToolError('invalid_params', 'unknown piece type');
      if (typeof col !== 'number' || typeof row !== 'number' || col < 0 || row < 0 || col >= plot.gridCols || row >= plot.gridRows) {
        throw new ToolError('invalid_params', 'col/row out of bounds');
      }
      if (plot.pieces.some((p) => p.col === col && p.row === row)) throw new ToolError('conflict', 'cell already occupied');
      const cost = PIECE_COST[type as keyof typeof PIECE_COST];
      for (const [res, amt] of Object.entries(cost)) {
        if ((agent.inventory as any)[res] < (amt as number)) throw new ToolError('insufficient_resources', `not enough ${res}`);
      }
      for (const [res, amt] of Object.entries(cost)) {
        (agent.inventory as any)[res] -= amt as number;
      }
      plot.pieces.push({ col, row, type, builtBy: agent.id });
      await savePlot(plot);
      agent.contributions += 1;
      await insertEvent(agent.id, agent.name, 'build_piece', `${agent.name} built a ${type} on a claimed plot.`);
      return { ok: true, plot };
    }

    case 'release_empty_plot': {
      const plotId = params?.plotId;
      const plot = await getPlotById(plotId);
      if (!plot) throw new ToolError('not_found', 'unknown plotId');
      if (plot.claimedBy !== agent.id) throw new ToolError('forbidden', 'you have not claimed this plot');
      if (plot.pieces.length > 0) throw new ToolError('invalid_state', 'plot is not empty');
      plot.claimedBy = null;
      plot.name = null;
      await savePlot(plot);
      await insertEvent(agent.id, agent.name, 'release_plot', `${agent.name} released a claimed plot.`);
      return { ok: true };
    }

    case 'read_my_journal': {
      return { ok: true, journal: await getAgentJournal(agent.id, params?.limit ?? 40) };
    }

    case 'inspect_my_observation': {
      const allAgents = await getAgents();
      const others = allAgents
        .filter((a) => a.id !== agent.id)
        .map((a) => ({ id: a.id, name: a.name, role: a.role, x: a.x, y: a.y, status: a.status, place: a.place }));
      return {
        ok: true,
        self: { x: agent.x, y: agent.y, place: agent.place, life: agent.life, inventory: agent.inventory, role: agent.role },
        nearby: others
          .map((o) => ({ ...o, distance: Math.hypot(o.x - agent.x, o.y - agent.y) }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 8),
        plots: await getPlots()
      };
    }

    default:
      throw new ToolError('unknown_tool', `no such tool: ${tool}`);
  }
}
