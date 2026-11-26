import mongoose from 'mongoose';
import { Admin } from './models/Admin.js';
import { AdminAudit } from './models/AdminAudit.js';
import { PendingPlay } from './models/PendingPlay.js';
import { Player } from './models/Player.js';
import { Record } from './models/Record.js';
import { Spin } from './models/Spin.js';
import { WinnerPhoto } from './models/WinnerPhoto.js';
import { ensureAdminSeed } from './services/adminAuth.js';
import { rebuildCsvFromMongo } from './services/csvStore.js';
import { withRetry } from './services/retry.js';

let readyPromise = null;
let readyUri = '';

/** Connect Mongoose cleanly, reusing any active warm connection in serverless environments. */
export async function connectDatabase(config, { attempts = 5, baseDelayMs = 500 } = {}) {
  if (!config.mongodbUri) {
    const error = new Error(
      'MONGODB_URI is not configured. Set MONGODB_URI in your environment variables.'
    );
    error.publicMessage =
      'Database is not configured. Add MONGODB_URI in Vercel Project Settings.';
    throw error;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await withRetry(
    () =>
      mongoose.connect(config.mongodbUri, {
        serverSelectionTimeoutMS: 5000,
      }),
    { attempts, baseDelayMs, label: 'connect to MongoDB' }
  );

  return mongoose.connection;
}

/** Ensure model indexes exist, seed configured admin accounts, and purge legacy guest rows. */
export async function initDatabaseAndAdmin(config, { rebuildCsvOnPurge = true } = {}) {
  await Promise.all([
    Record.init(),
    Admin.init(),
    AdminAudit.init(),
    PendingPlay.init(),
    Player.init(),
    Spin.init(),
    WinnerPhoto.init(),
  ]);
  await ensureAdminSeed(config);

  const removedGuests = await Record.deleteMany({ source: 'guest' });
  const removedGuestPlayers = await Player.collection.deleteMany({ isGuest: true });
  if (removedGuests.deletedCount || removedGuestPlayers.deletedCount) {
    console.log(
      `[records] Removed ${removedGuests.deletedCount} guest record(s) and ${removedGuestPlayers.deletedCount} guest player(s).`
    );
    if (rebuildCsvOnPurge) {
      await rebuildCsvFromMongo(config, { snapshot: !config.isVercel });
    }
  }
}

/** Memoized cold-start initializer for serverless invocations (resets on error so retries recover). */
export async function ensureServerlessReady(config) {
  if (readyPromise && readyUri === config.mongodbUri && mongoose.connection.readyState === 1) {
    return readyPromise;
  }

  if (readyUri !== config.mongodbUri) {
    readyPromise = null;
    readyUri = config.mongodbUri;
  }

  if (!readyPromise) {
    readyPromise = (async () => {
      await connectDatabase(config, { attempts: 2, baseDelayMs: 250 });
      await initDatabaseAndAdmin(config, { rebuildCsvOnPurge: false });
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }

  return readyPromise;
}
