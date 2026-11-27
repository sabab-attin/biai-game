import mongoose from 'mongoose';
import { Admin } from './models/Admin.js';
import { AdminAudit } from './models/AdminAudit.js';
import { PendingPlay } from './models/PendingPlay.js';
import { Player } from './models/Player.js';
import { QuizConfig } from './models/QuizConfig.js';
import { Record } from './models/Record.js';
import { Spin } from './models/Spin.js';
import { WheelConfig } from './models/WheelConfig.js';
import { WinnerPhoto } from './models/WinnerPhoto.js';
import { setQuizSettings, setWheelWeightOverrides } from './config/prizes.js';
import { QUIZ_QUESTIONS } from './config/quiz.js';
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
    WheelConfig.init(),
    QuizConfig.init(),
    WinnerPhoto.init(),
  ]);
  await ensureAdminSeed(config);

  const savedWheelConfig = await WheelConfig.findOne({ key: 'wheel-weights' }).lean();
  if (savedWheelConfig?.weights) {
    try {
      setWheelWeightOverrides(savedWheelConfig.weights);
    } catch (error) {
      console.warn('[wheel] Ignoring invalid saved wheel weights:', error.message);
    }
  }

  const savedQuizConfig = await QuizConfig.findOne({ key: 'quiz-settings' }).lean();
  if (savedQuizConfig) {
    try {
      setQuizSettings(
        {
          questionCount: savedQuizConfig.questionCount,
          rewardsByScore: savedQuizConfig.rewardsByScore,
        },
        QUIZ_QUESTIONS.length
      );
    } catch (error) {
      console.warn('[quiz] Ignoring invalid saved quiz settings:', error.message);
    }
  }

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
