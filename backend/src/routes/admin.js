import express from 'express';
import { AdminAudit } from '../models/AdminAudit.js';
import { Player } from '../models/Player.js';
import { Record, RECORD_SOURCES } from '../models/Record.js';
import { Spin } from '../models/Spin.js';
import { requireAdmin, clearAdminCookie } from '../services/adminAuth.js';
import { logAdminAction, serializeAuditEntry } from '../services/audit.js';
import { importRecordsFromCsv } from '../services/csvImport.js';
import {
  isCsvContentValid,
  readRecordsCsv,
  rebuildCsvFromMongo,
} from '../services/csvStore.js';
import {
  RecordValidationError,
  deleteRecordByRecordId,
  persistRecord,
  restoreRecordsIfEmpty,
  serializeRecord,
  updateRecord,
} from '../services/recordStore.js';

function parseLimit(value, fallback = 100, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function handleRecordError(error, res, next) {
  if (error instanceof RecordValidationError) {
    return res.status(400).json({ error: error.message, field: error.field });
  }
  return next(error);
}

function requireDartName(name) {
  const clean = String(name || '').trim();
  if (clean.length < 2 || clean.length > 80) {
    throw new RecordValidationError('Player name must be 2-80 characters.', 'name');
  }
  return clean;
}

function requireGame(game) {
  const clean = String(game || '').trim();
  if (clean.length < 1 || clean.length > 80) {
    throw new RecordValidationError('Game is required (1-80 characters).', 'game');
  }
  return clean;
}

export function createAdminRouter(config) {
  const router = express.Router();
  router.use(requireAdmin(config));

  router.get('/session', (req, res) => {
    res.json({ admin: req.admin });
  });

  router.post('/logout', async (req, res, next) => {
    try {
      clearAdminCookie(res);
      await logAdminAction(req.admin.id, 'logout', {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/records', async (req, res, next) => {
    try {
      const source = String(req.query.source || '').trim().toLowerCase();
      const filter = source && RECORD_SOURCES.includes(source) ? { source } : {};
      const limit = parseLimit(req.query.limit);
      const skip = Math.max(0, Number(req.query.skip) || 0);

      const [records, total] = await Promise.all([
        Record.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        Record.countDocuments(filter),
      ]);

      res.json({ total, records: records.map(serializeRecord) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/stats', async (_req, res, next) => {
    try {
      const [totalRecords, grouped, recentRecords, recentAudit, totalPlayers, totalSpins] =
        await Promise.all([
          Record.countDocuments(),
          Record.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
          Record.find().sort({ timestamp: -1 }).limit(10).lean(),
          AdminAudit.find().sort({ timestamp: -1 }).limit(15).lean(),
          Player.countDocuments(),
          Spin.countDocuments(),
        ]);

      const sourceCounts = Object.fromEntries(RECORD_SOURCES.map((source) => [source, 0]));
      for (const item of grouped) {
        if (item._id in sourceCounts) sourceCounts[item._id] = item.count;
      }

      res.json({
        totalRecords,
        sourceCounts,
        totalPlayers,
        totalSpins,
        recentRecords: recentRecords.map(serializeRecord),
        recentAudit: recentAudit.map(serializeAuditEntry),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/dart', async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit, 50, 200);
      const records = await Record.find({ source: 'dart' })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      res.json({ records: records.map(serializeRecord) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/dart', async (req, res, next) => {
    try {
      const body = req.body || {};
      const name = requireDartName(body.name);
      const game = requireGame(body.game);
      const record = await persistRecord(
        {
          name,
          phone: body.phone,
          email: body.email,
          reward: body.reward,
          result: body.result ?? body.score,
          game,
          timestamp: body.timestamp,
          source: 'dart',
        },
        config
      );

      await logAdminAction(req.admin.id, 'dart.create', {
        recordId: record.recordId,
        name: record.name,
        game: record.game,
      });
      res.status(201).json({ record });
    } catch (error) {
      handleRecordError(error, res, next);
    }
  });

  router.patch('/dart/:recordId', async (req, res, next) => {
    try {
      const existing = await Record.findOne({
        recordId: req.params.recordId,
        source: 'dart',
      }).lean();
      if (!existing) {
        return res.status(404).json({ error: 'Dart entry not found.' });
      }

      const body = req.body || {};
      const name = body.name === undefined ? existing.name : requireDartName(body.name);
      const game = body.game === undefined ? existing.game : requireGame(body.game);
      const updated = await updateRecord(
        req.params.recordId,
        {
          name,
          game,
          phone: body.phone === undefined ? existing.phone : body.phone,
          email: body.email === undefined ? existing.email : body.email,
          reward: body.reward === undefined ? existing.reward : body.reward,
          result:
            body.result === undefined
              ? body.score === undefined
                ? existing.result
                : body.score
              : body.result,
          timestamp: body.timestamp === undefined ? existing.timestamp : body.timestamp,
          source: 'dart',
        },
        config
      );

      if (!updated) {
        return res.status(404).json({ error: 'Dart entry not found.' });
      }

      await logAdminAction(req.admin.id, 'dart.update', {
        recordId: updated.recordId,
        name: updated.name,
        game: updated.game,
      });
      res.json({ record: updated });
    } catch (error) {
      handleRecordError(error, res, next);
    }
  });

  router.delete('/dart/:recordId', async (req, res, next) => {
    try {
      const existing = await Record.findOne({
        recordId: req.params.recordId,
        source: 'dart',
      }).lean();
      if (!existing) {
        return res.status(404).json({ error: 'Dart entry not found.' });
      }

      await deleteRecordByRecordId(req.params.recordId);
      await logAdminAction(req.admin.id, 'dart.delete', {
        recordId: req.params.recordId,
        name: existing.name,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/records/:recordId', async (req, res, next) => {
    try {
      const existing = await Record.findOne({ recordId: req.params.recordId }).lean();
      if (!existing) {
        return res.status(404).json({ error: 'Record not found.' });
      }

      await deleteRecordByRecordId(req.params.recordId);
      await logAdminAction(req.admin.id, 'record.delete', {
        recordId: req.params.recordId,
        source: existing.source,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/csv', async (_req, res, next) => {
    try {
      let csv = await readRecordsCsv(config);
      if (!csv || !isCsvContentValid(csv)) {
        await rebuildCsvFromMongo(config, { snapshot: false });
        csv = await readRecordsCsv(config);
      }
      res.type('text/plain').send(csv);
    } catch (error) {
      next(error);
    }
  });

  router.post('/csv/rebuild', async (req, res, next) => {
    try {
      const restored = await restoreRecordsIfEmpty(config);
      const result = await rebuildCsvFromMongo(config, { snapshot: true });
      await logAdminAction(req.admin.id, 'csv.rebuild', {
        count: result.count,
        restoredFromLog: restored.restored || 0,
        snapshotPath: result.snapshotPath,
      });
      res.json({ ...result, restoredFromLog: restored.restored || 0 });
    } catch (error) {
      next(error);
    }
  });

  router.get('/csv/download', async (req, res, next) => {
    try {
      await rebuildCsvFromMongo(config, { snapshot: false });
      const csv = await readRecordsCsv(config);
      await logAdminAction(req.admin.id, 'csv.download', {
        bytes: Buffer.byteLength(csv, 'utf8'),
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="biai-records.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/import',
    express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }),
    async (req, res, next) => {
      try {
        const csv = typeof req.body === 'string' ? req.body : '';
        if (!csv.trim()) {
          return res.status(400).json({ error: 'Upload or paste a CSV file first.' });
        }

        const result = await importRecordsFromCsv(csv, config);
        await logAdminAction(req.admin.id, 'csv.import', result);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/audit', async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit, 100, 500);
      const entries = await AdminAudit.find().sort({ timestamp: -1 }).limit(limit).lean();
      res.json({ entries: entries.map(serializeAuditEntry) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
