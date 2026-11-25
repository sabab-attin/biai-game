import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(backendRoot, '.env') });

export function loadConfig(overrides = {}) {
  const rawCsvPath = overrides.csvFilePath || process.env.CSV_FILE_PATH || './data/entries.csv';
  const csvFilePath = path.isAbsolute(rawCsvPath)
    ? rawCsvPath
    : path.resolve(backendRoot, rawCsvPath);

  return {
    port: Number(overrides.port ?? process.env.PORT ?? 4000),
    mongodbUri: overrides.mongodbUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/carnival_wheel',
    csvFilePath,
    sessionSecret: overrides.sessionSecret || process.env.SESSION_SECRET || 'carnival-wheel-dev-secret-2026',
    adminPasskey: overrides.adminPasskey || process.env.ADMIN_PASSKEY || 'biai2026',
    maxSpinsPerPlayer: Math.max(1, Number(overrides.maxSpinsPerPlayer ?? process.env.MAX_SPINS_PER_PLAYER ?? 1)),
    frontendOrigin: overrides.frontendOrigin || process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  };
}
