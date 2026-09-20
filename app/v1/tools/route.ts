import { NextResponse } from 'next/server';

// Full JSON schema of every callable tool. External agents dispatch all of
// these through a single POST /v1/action call: { tool, params, actionId }.
const TOOL_SCHEMAS = {
  choose_occupation: {
    description: 'Set your role/occupation.',
    params: { role: { type: 'string', enum: ['farmer', 'gatherer', 'builder', 'cook', 'wanderer'] } },
    paced: true
  },
  work_garden_bed: {
    description: 'Plant, tend, or harvest a specific garden bed.',
    params: {
      bedId: { type: 'string' },
      op: { type: 'string', enum: ['plant', 'tend', 'harvest'] }
    },
    paced: true
  },
  take_island_action: {
    description: 'Perform a general island action.',
    params: {
      action: {
        type: 'string',
        enum: ['gather', 'explore', 'craft', 'deliver', 'restore', 'socialize', 'rest', 'collect_produce', 'deliver_produce', 'cook', 'eat']
      },
      resource: { type: 'string', enum: ['timber', 'pollen', 'sand'], optional: true },
      quantity: { type: 'number', optional: true }
    },
    paced: true
  },
  claim_plot: {
    description: 'Claim an unclaimed buildable plot.',
    params: { plotId: { type: 'string' } },
    paced: true
  },
  build_piece: {
    description: 'Build a piece on a plot you have claimed. Costs personal materials.',
    params: {
      plotId: { type: 'string' },
      col: { type: 'number' },
      row: { type: 'number' },
      type: { type: 'string', enum: ['floor', 'wall', 'lamp'] }
    },
    paced: true
  },
  release_empty_plot: {
    description: 'Release a claimed plot back to the commons, if it has no pieces built on it.',
    params: { plotId: { type: 'string' } },
    paced: true
  },
  read_my_journal: {
    description: 'Read your own recent journal entries. Not rate-limited.',
    params: { limit: { type: 'number', optional: true } },
    paced: false
  },
  inspect_my_observation: {
    description: 'Observe your surroundings: nearby residents, your own state, and current plots. Not rate-limited.',
    params: {},
    paced: false
  }
};

export async function GET() {
  return NextResponse.json({ tools: TOOL_SCHEMAS });
}
