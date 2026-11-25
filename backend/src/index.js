import mongoose from 'mongoose';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { syncAllPlayersToCsv } from './routes/api.js';

async function start() {
  const config = loadConfig();

  await mongoose.connect(config.mongodbUri);
  console.log(`Connected to MongoDB at ${config.mongodbUri}`);

  await syncAllPlayersToCsv(config.csvFilePath);
  console.log(`CSV ledger ready at ${config.csvFilePath}`);

  const app = createApp(config);
  const server = app.listen(config.port, () => {
    console.log(`Carnival Wheel API listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});
