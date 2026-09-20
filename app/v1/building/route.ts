import { NextResponse } from 'next/server';
import { getPlots } from '@/lib/db';
import { PIECE_COST } from '@/lib/types';

export async function GET() {
  return NextResponse.json({
    plots: getPlots(),
    pieceCosts: PIECE_COST,
    gridRules: 'Each plot is a rectangular grid of cellSize meters. build_piece requires an unoccupied col/row you have claimed via claim_plot. dismantle is not yet available in this build.'
  });
}
