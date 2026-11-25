import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import cron from 'node-cron';
import { Record } from '../models/Record.js';

export const RECORD_CSV_HEADER = 'name,phone,email,reward,timestamp,source';
const SNAPSHOT_LIMIT = 96;
const SNAPSHOT_PREFIX = 'records-';

function csvEscapeCell(value) {
  let str = value == null ? '' : String(value);
  str = str.replace(/\r\n/g, '\n');

  // Defuse spreadsheet formula injection for any provided cell.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

export function serializeRecordsToCsv(records) {
  const rows = records.map((record) => {
    const timestamp = record.timestamp ? new Date(record.timestamp) : null;
    const cells = [
      record.name,
      record.phone,
      record.email,
      record.reward,
      timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : '',
      record.source,
    ];
    return cells.map(csvEscapeCell).join(',');
  });

  return `${RECORD_CSV_HEADER}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

const atomicWriteQueues = new Map();

function enqueueAtomicWrite(filePath, task) {
  const previous = atomicWriteQueues.get(filePath) || Promise.resolve();
  const next = previous.then(task, task);
  atomicWriteQueues.set(filePath, next);
  return next;
}

async function performAtomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  let handle = null;

  try {
    handle = await fs.open(tempPath, 'w');
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(tempPath, filePath);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

export function atomicWriteFile(filePath, content) {
  // Windows rejects concurrent renames onto the same destination, so writes to
  // one path are serialized. Each write is still a single atomic rename.
  return enqueueAtomicWrite(filePath, () => performAtomicWrite(filePath, content));
}

export function isCsvContentValid(content) {
  if (typeof content !== 'string' || content.includes('\u0000')) {
    return false;
  }

  const rows = parseCsv(content);
  if (!rows.length) return false;

  const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, '').trim());
  if (header.join(',') !== RECORD_CSV_HEADER) return false;

  return rows.slice(1).every((row) => row.length === 6);
}

export async function readRecordsCsv(config) {
  try {
    return await fs.readFile(config.recordsCsvPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

const rebuildQueues = new Map();

function enqueueRebuild(filePath, task) {
  const previous = rebuildQueues.get(filePath) || Promise.resolve();
  const next = previous.then(task, task);
  rebuildQueues.set(filePath, next);
  return next;
}

async function pruneSnapshots(snapshotDir, keep = SNAPSHOT_LIMIT) {
  let entries = [];
  try {
    entries = await fs.readdir(snapshotDir);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  const snapshots = entries
    .filter((name) => name.startsWith(SNAPSHOT_PREFIX) && name.endsWith('.csv'))
    .sort();

  const excess = snapshots.slice(0, Math.max(0, snapshots.length - keep));
  await Promise.all(
    excess.map((name) => fs.rm(path.join(snapshotDir, name), { force: true }))
  );
}

export async function writeCsvSnapshot(config, content, date = new Date()) {
  await fs.mkdir(config.snapshotDir, { recursive: true });
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(config.snapshotDir, `${SNAPSHOT_PREFIX}${stamp}.csv`);
  await atomicWriteFile(snapshotPath, content);
  await pruneSnapshots(config.snapshotDir);
  return snapshotPath;
}

export async function rebuildCsvFromMongo(config, { snapshot = true } = {}) {
  return enqueueRebuild(config.recordsCsvPath, async () => {
    const records = await Record.find().sort({ timestamp: 1, createdAt: 1 }).lean();
    const content = serializeRecordsToCsv(records);
    await atomicWriteFile(config.recordsCsvPath, content);

    let snapshotPath = null;
    if (snapshot) {
      snapshotPath = await writeCsvSnapshot(config, content);
    }

    return {
      count: records.length,
      path: config.recordsCsvPath,
      snapshotPath,
      bytes: Buffer.byteLength(content, 'utf8'),
    };
  });
}

export async function ensureCsvHealthy(config) {
  const existing = await readRecordsCsv(config);
  if (existing && isCsvContentValid(existing)) {
    return { rebuilt: false, count: parseCsv(existing).length - 1 };
  }
  const result = await rebuildCsvFromMongo(config);
  return { rebuilt: true, ...result };
}

export function startCsvScheduler(config, logger = console) {
  const task = cron.schedule(
    '*/15 * * * *',
    async () => {
      try {
        const result = await rebuildCsvFromMongo(config);
        logger.log(`[csv] Scheduled rebuild complete (${result.count} records).`);
      } catch (error) {
        logger.error('[csv] Scheduled rebuild failed:', error);
      }
    },
    { timezone: 'UTC' }
  );

  return task;
}

export async function createShutdownSnapshot(config, logger = console) {
  try {
    const result = await rebuildCsvFromMongo(config, { snapshot: true });
    logger.log(`[csv] Shutdown snapshot written (${result.count} records).`);
    return result;
  } catch (error) {
    logger.error('[csv] Shutdown snapshot failed:', error);
    return null;
  }
}

export { csvEscapeCell, SNAPSHOT_LIMIT };
