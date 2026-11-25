import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(backendRoot, '.env') });

function resolveFromBackend(value) {
  return path.isAbsolute(value) ? value : path.resolve(backendRoot, value);
}

function parseAdminUsernames(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  const usernames = [];
  for (const item of list) {
    const username = String(item || '').trim().toLowerCase();
    if (!username || seen.has(username)) continue;
    seen.add(username);
    usernames.push(username);
  }
  return usernames;
}

export function loadConfig(overrides = {}) {
  const backupDir = resolveFromBackend(
    overrides.backupDir || process.env.BACKUP_DIR || './backups'
  );
  const recordsCsvPath = resolveFromBackend(
    overrides.recordsCsvPath || process.env.CSV_FILE_PATH || './data/records.csv'
  );

  const adminUsernames = parseAdminUsernames(
    overrides.adminUsernames ??
      overrides.adminUsername ??
      process.env.ADMIN_USERNAMES ??
      process.env.ADMIN_USERNAME ??
      ''
  );

  return {
    port: Number(overrides.port ?? process.env.PORT ?? 4000),
    mongodbUri: overrides.mongodbUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/carnival_wheel',
    recordsCsvPath,
    backupDir,
    recordLogPath:
      overrides.recordLogPath ||
      process.env.RECORD_LOG_PATH ||
      path.join(backupDir, 'records.log.jsonl'),
    snapshotDir:
      overrides.snapshotDir ||
      process.env.CSV_SNAPSHOT_DIR ||
      path.join(backupDir, 'csv-snapshots'),
    sessionSecret: overrides.sessionSecret || process.env.SESSION_SECRET || 'carnival-wheel-dev-secret-2026',
    adminUsernames,
    adminPassword: overrides.adminPassword ?? process.env.ADMIN_PASSWORD ?? '',
    adminPasswordHash: overrides.adminPasswordHash ?? process.env.ADMIN_PASSWORD_HASH ?? '',
    secureCookies:
      overrides.secureCookies ??
      (process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'),
    maxSpinsPerPlayer: Math.max(
      1,
      Number(overrides.maxSpinsPerPlayer ?? process.env.MAX_SPINS_PER_PLAYER ?? 1)
    ),
    frontendOrigin: overrides.frontendOrigin || process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    adminLoginWindowMs: Number(
      overrides.adminLoginWindowMs ?? process.env.ADMIN_LOGIN_WINDOW_MS ?? 15 * 60 * 1000
    ),
    adminLoginMaxAttempts: Number(
      overrides.adminLoginMaxAttempts ?? process.env.ADMIN_LOGIN_MAX_ATTEMPTS ?? 5
    ),
  };
}
