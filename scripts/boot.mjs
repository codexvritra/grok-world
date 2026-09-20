// Railway's persistent volume at data/ shadows whatever's in the git-committed
// image, so a new island layout never reaches an already-provisioned volume
// on its own. Setting RESET_WORLD=1 (once, then unset it) wipes the volume's
// copy so the next boot regenerates from the current code and reseeds.
import { rmSync } from 'node:fs';

if (process.env.RESET_WORLD) {
  console.log('RESET_WORLD set: clearing persisted island + database before boot.');
  for (const f of ['data/location.json', 'data/world.db', 'data/world.db-shm', 'data/world.db-wal']) {
    rmSync(f, { force: true });
  }
}
