import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Record, RECORD_SOURCES } from '../models/Record.js';
import { withRetry } from './retry.js';

const writeQueues = new Map();

export class RecordValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'RecordValidationError';
    this.field = field;
  }
}

export class RecordPersistenceError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'RecordPersistenceError';
    this.cause = cause;
  }
}

function optionalText(value, { field, maxLength }) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) {
    throw new RecordValidationError(`${field} is too long.`, field);
  }
  return text;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidPhone(phone) {
  if (!/^\+?[0-9\s().-]{6,24}$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

function normalizeRecordInput(input) {
  const source = String(input?.source || '').trim().toLowerCase();
  if (!RECORD_SOURCES.includes(source)) {
    throw new RecordValidationError('Unknown record source.', 'source');
  }

  const name = optionalText(input?.name, { field: 'Name', maxLength: 80 });
  const phone = optionalText(input?.phone, { field: 'Phone', maxLength: 32 });
  const email = optionalText(input?.email, { field: 'Email', maxLength: 120 });
  const reward = optionalText(input?.reward, { field: 'Reward', maxLength: 200 });
  const result = optionalText(input?.result, { field: 'Result', maxLength: 120 });
  const game = optionalText(input?.game, { field: 'Game', maxLength: 80 });

  if (phone && !isValidPhone(phone)) {
    throw new RecordValidationError('Enter a valid phone number.', 'phone');
  }
  if (email && !isValidEmail(email)) {
    throw new RecordValidationError('Enter a valid email address.', 'email');
  }

  const timestamp = input?.timestamp == null ? new Date() : new Date(input.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new RecordValidationError('Timestamp is not a valid date.', 'timestamp');
  }

  const score = input?.score == null ? null : Number(input.score);
  if (score != null && (!Number.isFinite(score) || score < 0)) {
    throw new RecordValidationError('Score must be a non-negative number.', 'score');
  }

  return {
    recordId: input?.recordId ? String(input.recordId) : crypto.randomUUID(),
    name,
    phone,
    email,
    reward,
    timestamp,
    source,
    createdAt: input?.createdAt ? new Date(input.createdAt) : new Date(),
    playerId: input?.playerId || null,
    result,
    game,
    score,
  };
}

export function serializeRecord(record) {
  const timestamp = record.timestamp ? new Date(record.timestamp) : null;
  const createdAt = record.createdAt ? new Date(record.createdAt) : null;

  return {
    id: record._id ? String(record._id) : null,
    recordId: record.recordId,
    name: record.name ?? null,
    phone: record.phone ?? null,
    email: record.email ?? null,
    reward: record.reward ?? null,
    timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : null,
    source: record.source,
    createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : null,
    playerId: record.playerId ? String(record.playerId) : null,
    result: record.result ?? null,
    game: record.game ?? null,
    score: record.score ?? null,
  };
}

function enqueueFileWrite(filePath, task) {
  const previous = writeQueues.get(filePath) || Promise.resolve();
  const next = previous.then(task, task);
  writeQueues.set(filePath, next);
  return next;
}

function toLogLine(record) {
  return `${JSON.stringify({
    recordId: record.recordId,
    name: record.name,
    phone: record.phone,
    email: record.email,
    reward: record.reward,
    timestamp: record.timestamp.toISOString(),
    source: record.source,
    createdAt: record.createdAt.toISOString(),
    playerId: record.playerId ? String(record.playerId) : null,
    result: record.result,
    game: record.game,
    score: record.score,
  })}\n`;
}

async function appendRecordToLog(record, config, logger) {
  const line = toLogLine(record);

  await enqueueFileWrite(config.recordLogPath, async () => {
    await fs.mkdir(path.dirname(config.recordLogPath), { recursive: true });
    await withRetry(
      () => fs.appendFile(config.recordLogPath, line, { encoding: 'utf8', flag: 'a' }),
      { attempts: 3, label: 'append record backup log', logger }
    );
  });
}

async function saveRecordToMongo(record, logger) {
  try {
    return await withRetry(() => Record.create(record), {
      attempts: 4,
      baseDelayMs: 100,
      label: 'save record to MongoDB',
      logger,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Record.findOne({ recordId: record.recordId });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function persistRecord(input, config, { logger = console, dedupe = true } = {}) {
  const normalized = normalizeRecordInput(input);

  if (dedupe && input?.recordId) {
    try {
      const existing = await Record.findOne({ recordId: normalized.recordId });
      if (existing) return serializeRecord(existing);
    } catch (error) {
      logger.error('[records] Dedupe lookup failed, continuing with save:', error);
    }
  }

  try {
    await appendRecordToLog(normalized, config, logger);
  } catch (error) {
    // The MongoDB write below is still attempted so a single backup-file issue
    // does not lose the interaction.
    logger.error('[records] Backup log append failed:', error);
  }

  try {
    const saved = await saveRecordToMongo(normalized, logger);
    return serializeRecord(saved);
  } catch (error) {
    logger.error('[records] MongoDB save failed after retries:', error);
    throw new RecordPersistenceError(
      'Could not save this record. Please try again.',
      error
    );
  }
}

export async function updateRecord(recordId, patch, config) {
  const normalized = normalizeRecordInput({ ...patch, recordId });
  const updated = await Record.findOneAndUpdate(
    { recordId },
    {
      $set: {
        name: normalized.name,
        phone: normalized.phone,
        email: normalized.email,
        reward: normalized.reward,
        timestamp: normalized.timestamp,
        source: normalized.source,
        result: normalized.result,
        game: normalized.game,
        score: normalized.score,
      },
    },
    { new: true }
  );
  return updated ? serializeRecord(updated) : null;
}

export async function deleteRecordByRecordId(recordId) {
  const result = await Record.deleteOne({ recordId });
  return result.deletedCount > 0;
}

export async function restoreRecordsFromLog(config, { logger = console } = {}) {
  let content = '';
  try {
    content = await fs.readFile(config.recordLogPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { restored: 0, skipped: 0 };
    throw error;
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  let restored = 0;
  let skipped = 0;
  let batch = [];

  async function flush() {
    if (!batch.length) return;
    const operations = batch.map((record) => ({
      updateOne: {
        filter: { recordId: record.recordId },
        update: {
          $setOnInsert: {
            recordId: record.recordId,
            name: record.name,
            phone: record.phone,
            email: record.email,
            reward: record.reward,
            timestamp: record.timestamp,
            source: record.source,
            createdAt: record.createdAt,
            playerId: record.playerId,
            result: record.result,
            game: record.game,
            score: record.score,
          },
        },
        upsert: true,
      },
    }));

    const result = await Record.bulkWrite(operations, { ordered: false });
    restored += result.upsertedCount || 0;
    batch = [];
  }

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      normalizedRestoreRecord(parsed);
      batch.push(parsed);
      if (batch.length >= 500) await flush();
    } catch (error) {
      skipped += 1;
      logger.error(`[records] Skipping corrupt backup line: ${error.message}`);
    }
  }

  await flush();
  return { restored, skipped };
}

function normalizedRestoreRecord(input) {
  if (!input?.recordId || !RECORD_SOURCES.includes(input.source)) {
    throw new Error('invalid record');
  }
  if (!input.timestamp || Number.isNaN(new Date(input.timestamp).getTime())) {
    throw new Error('invalid timestamp');
  }
  input.timestamp = new Date(input.timestamp);
  input.createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  return input;
}

export async function restoreRecordsIfEmpty(config, { logger = console } = {}) {
  const count = await Record.countDocuments();
  if (count > 0) return { restored: 0, skipped: 0, skippedBecauseNotEmpty: true };
  return restoreRecordsFromLog(config, { logger });
}
