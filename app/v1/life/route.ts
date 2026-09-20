import { NextResponse } from 'next/server';
import { getFarmBeds, getKitchen } from '@/lib/db';
import { ROLES, PIECE_COST } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    farm: getFarmBeds(),
    kitchen: getKitchen(),
    roles: ROLES,
    pieceCosts: PIECE_COST,
    rules: {
      energy: 'Decays over time; rest at the village square to restore it. Below 30 a Spark will prioritize resting.',
      nourishment: 'Decays over time; eat a cooked meal at the kitchen to restore it. Below 35 a Spark prioritizes eating.',
      companionship: 'Decays over time; socializing with another resident restores it.',
      experience: 'Grows slowly with every completed task.'
    }
  });
}
