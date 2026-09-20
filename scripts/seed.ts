import { getAgents } from '../lib/db';
import { seedWorld, resetWorldTables } from '../lib/seedWorld';

const FORCE = process.argv.includes('--reset');

async function main() {
  const existing = await getAgents();
  if (existing.length > 0 && !FORCE) {
    console.log('World already seeded. Re-run with --reset to wipe and reseed.');
    return;
  }
  if (FORCE) await resetWorldTables();
  const { residents, plots, claimed, roles } = await seedWorld();
  console.log(`Seeded ${residents} residents, ${plots} plots (${claimed} pre-claimed), 6 garden beds, 1 shared goal.`);
  console.log('Roles available:', roles.join(', '));
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
