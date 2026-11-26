import mongoose from 'mongoose';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { Admin } from './models/Admin.js';
import { AdminAudit } from './models/AdminAudit.js';
import { Player } from './models/Player.js';
import { Record } from './models/Record.js';
import { ensureAdminSeed } from './services/adminAuth.js';
import {
  createShutdownSnapshot,
  ensureCsvHealthy,
  rebuildCsvFromMongo,
  startCsvScheduler,
} from './services/csvStore.js';
import { restoreRecordsIfEmpty } from './services/recordStore.js';
import { withRetry } from './services/retry.js';

async function start() {
  const config = loadConfig();

  await withRetry(
    () =>
      mongoose.connect(config.mongodbUri, {
        serverSelectionTimeoutMS: 5000,
      }),
    { attempts: 5, baseDelayMs: 500, label: 'connect to MongoDB' }
  );
  console.log(`Connected to MongoDB at ${config.mongodbUri}`);

  await Promise.all([Record.init(), Admin.init(), AdminAudit.init()]);
  await ensureAdminSeed(config);

  // Guest mode has been removed; clear any guest rows left by older builds.
  const removedGuests = await Record.deleteMany({ source: 'guest' });
  const removedGuestPlayers = await Player.collection.deleteMany({ isGuest: true });
  if (removedGuests.deletedCount || removedGuestPlayers.deletedCount) {
    console.log(
      `[records] Removed ${removedGuests.deletedCount} guest record(s) and ${removedGuestPlayers.deletedCount} guest player(s).`
    );
    await rebuildCsvFromMongo(config, { snapshot: true });
  }

  const restored = await restoreRecordsIfEmpty(config);
  if (restored.restored) {
    console.log(`[records] Restored ${restored.restored} records from backup log.`);
  }

  const csvState = await ensureCsvHealthy(config);
  if (csvState.rebuilt) {
    console.log(`[csv] Rebuilt CSV from MongoDB (${csvState.count} records).`);
  }

  const scheduler = startCsvScheduler(config);
  const app = createApp(config);
  const server = app.listen(config.port, () => {
    console.log(`Carnival Wheel API listening on http://localhost:${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down...`);

    scheduler.stop();

    await new Promise((resolve) => {
      server.close(() => resolve());
      setTimeout(resolve, 5000);
    });

    await createShutdownSnapshot(config);
    await mongoose.disconnect().catch((error) => {
      console.error('[server] MongoDB disconnect failed:', error);
    });

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

start().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});
