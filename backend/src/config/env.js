import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(backendRoot, '.env') });

function resolveFromBackend(value) {
  return path.isAbsolute(value) ? value : path.resolve(backendRoot, value);
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAdminUsernames(value) {
  const list = Array.isArray(value) ? value : parseList(value);
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

function buildAllowedOrigins(overrides) {
  const list = [
    ...parseList(overrides.frontendOrigin ?? process.env.FRONTEND_ORIGIN ?? ''),
    ...parseList(overrides.frontendUrl ?? process.env.FRONTEND_URL ?? ''),
  ];

  for (const host of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    const clean = String(host || '').trim().replace(/^https?:\/\//i, '');
    if (clean) list.push(`https://${clean}`);
  }

  return Array.from(new Set(list));
}

export function loadConfig(overrides = {}) {
  const isVercel = Boolean(overrides.isVercel ?? process.env.VERCEL);

  const defaultBackupDir = isVercel
    ? path.join(os.tmpdir(), 'biai-backups')
    : './backups';
  const defaultCsvPath = isVercel
    ? path.join(os.tmpdir(), 'biai-data', 'records.csv')
    : './data/records.csv';

  const backupDir = resolveFromBackend(
    overrides.backupDir || process.env.BACKUP_DIR || defaultBackupDir
  );
  const recordsCsvPath = resolveFromBackend(
    overrides.recordsCsvPath || process.env.CSV_FILE_PATH || defaultCsvPath
  );

  const adminUsernames = parseAdminUsernames(
    overrides.adminUsernames ??
      overrides.adminUsername ??
      process.env.ADMIN_USERNAMES ??
      process.env.ADMIN_USERNAME ??
      ''
  );

  const allowedOrigins = buildAllowedOrigins(overrides);
  const mongodbUri =
    overrides.mongodbUri ??
    process.env.MONGODB_URI ??
    (isVercel ? '' : 'mongodb://127.0.0.1:27017/carnival_wheel');

  const secureCookies =
    overrides.secureCookies ??
    (process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production' ||
        (isVercel && process.env.VERCEL_ENV !== 'development'));

  return {
    isVercel,
    port: Number(overrides.port ?? process.env.PORT ?? 4000),
    mongodbUri,
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
    secureCookies,
    maxSpinsPerPlayer: Math.max(
      1,
      Number(overrides.maxSpinsPerPlayer ?? process.env.MAX_SPINS_PER_PLAYER ?? 1)
    ),
    frontendOrigin:
      overrides.frontendOrigin ||
      process.env.FRONTEND_ORIGIN ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173',
    allowedOrigins,
    adminLoginWindowMs: Number(
      overrides.adminLoginWindowMs ?? process.env.ADMIN_LOGIN_WINDOW_MS ?? 15 * 60 * 1000
    ),
    adminLoginMaxAttempts: Number(
      overrides.adminLoginMaxAttempts ?? process.env.ADMIN_LOGIN_MAX_ATTEMPTS ?? 5
    ),
  };
}
