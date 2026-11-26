import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase, initDatabaseAndAdmin } from './bootstrap.js';
import { loadConfig } from './config/env.js';
import {
  createShutdownSnapshot,
  ensureCsvHealthy,
  startCsvScheduler,
} from './services/csvStore.js';
import { restoreRecordsIfEmpty } from './services/recordStore.js';

async function start() {
  const config = loadConfig();

  await connectDatabase(config);
  console.log(`Connected to MongoDB at ${config.mongodbUri}`);

  await initDatabaseAndAdmin(config, { rebuildCsvOnPurge: true });

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
