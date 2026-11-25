import express from 'express';
import { PRIZES, generateClaimCode, pickWeightedPrize } from '../config/prizes.js';
import { Player } from '../models/Player.js';
import { Spin } from '../models/Spin.js';
import { readCsvFile, syncCsvFromPlayers } from '../services/csvStore.js';
import { createPlayerToken, verifyPasskey, verifyPlayerToken } from '../services/token.js';

function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.trim().replace(/[\s().-]/g, '');
  if (!cleaned) return '';
  if (!/^\+?\d{7,15}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function normalizeEmail(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function maskContact(phone, email) {
  if (phone) {
    const tail = phone.slice(-4);
    return `Phone ending ${tail}`;
  }
  if (email) {
    const [local, domain] = email.split('@');
    const head = local.slice(0, 2);
    return `${head}***@${domain}`;
  }
  return '';
}

function serializePlayerPublic(player) {
  const spinsRemaining = Math.max(0, player.maxSpins - player.spinsUsed);
  return {
    id: String(player._id),
    name: player.name,
    phone: player.phone || '',
    email: player.email || '',
    contactLabel: maskContact(player.phone, player.email),
    spinsUsed: player.spinsUsed,
    maxSpins: player.maxSpins,
    spinsRemaining,
    prizeId: player.prizeId || '',
    prizeTitle: player.prizeTitle || '',
    claimCode: player.claimCode || '',
    enteredAt: player.enteredAt,
    spunAt: player.spunAt,
  };
}

export async function syncAllPlayersToCsv(csvFilePath) {
  const players = await Player.find().sort({ enteredAt: 1 }).lean();
  await syncCsvFromPlayers(players, csvFilePath);
}

export function createApiRouter(config) {
  const router = express.Router();

  function requirePlayer(req, res, next) {
    const auth = req.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const playerId = verifyPlayerToken(token, config.sessionSecret);
    if (!playerId) {
      return res.status(401).json({ error: 'Session expired or missing. Enter your details to play.' });
    }
    req.playerId = playerId;
    return next();
  }

  function requireAdmin(req, res, next) {
    const provided = req.get('x-admin-key') || '';
    if (!verifyPasskey(provided, config.adminPasskey)) {
      return res.status(401).json({ error: 'Invalid organizer passkey.' });
    }
    return next();
  }

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/prizes', (_req, res) => {
    res.json({
      prizes: PRIZES.map(({ id, title, wheelLabel, category, description, bgToken, fgToken }) => ({
        id,
        title,
        wheelLabel,
        category,
        description,
        bgToken,
        fgToken,
      })),
    });
  });

  router.get('/stats', async (_req, res, next) => {
    try {
      const [totalEntries, totalSpins, grouped] = await Promise.all([
        Player.countDocuments(),
        Spin.countDocuments(),
        Spin.aggregate([{ $group: { _id: '$prizeId', count: { $sum: 1 } } }]),
      ]);

      const prizeCounts = Object.fromEntries(PRIZES.map((p) => [p.id, 0]));
      for (const item of grouped) {
        if (item._id in prizeCounts) {
          prizeCounts[item._id] = item.count;
        }
      }

      res.json({
        totalEntries,
        totalSpins,
        maxSpinsPerPlayer: config.maxSpinsPerPlayer,
        prizeCounts,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/wheel/recent', async (_req, res, next) => {
    try {
      const spins = await Spin.find().sort({ spunAt: -1 }).limit(8).lean();
      res.json({
        recent: spins.map((s) => ({
          id: String(s._id),
          firstName: s.playerName.split(/\s+/)[0] || 'Guest',
          prizeId: s.prizeId,
          prizeTitle: s.prizeTitle,
          spunAt: s.spunAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/players/enter', async (req, res, next) => {
    try {
      const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

      if (rawName.length < 2 || rawName.length > 80) {
        return res.status(400).json({
          field: 'name',
          error: 'Enter your full name (at least 2 characters).',
        });
      }

      if (!rawPhone && !rawEmail) {
        return res.status(400).json({
          field: 'phone',
          error: 'Provide a phone number, an email address, or both to enter the game.',
        });
      }

      const phoneNormalized = normalizePhone(rawPhone);
      if (phoneNormalized === null) {
        return res.status(400).json({
          field: 'phone',
          error: 'Phone number must be 7 to 15 digits (spaces, dashes, and + allowed).',
        });
      }

      const emailNormalized = normalizeEmail(rawEmail);
      if (emailNormalized === null) {
        return res.status(400).json({
          field: 'email',
          error: 'That email address looks incomplete. Write it as name@example.com.',
        });
      }

      let byPhone = null;
      let byEmail = null;
      if (phoneNormalized) {
        byPhone = await Player.findOne({ phoneNormalized });
      }
      if (emailNormalized) {
        byEmail = await Player.findOne({ emailNormalized });
      }

      if (byPhone && byEmail && String(byPhone._id) !== String(byEmail._id)) {
        return res.status(409).json({
          field: 'phone',
          error: 'That phone number and email belong to different entries. Use one matching contact.',
        });
      }

      let player = byPhone || byEmail;
      if (player) {
        player.name = rawName;
        if (rawPhone && !player.phone) {
          player.phone = rawPhone;
          player.phoneNormalized = phoneNormalized;
        }
        if (rawEmail && !player.email) {
          player.email = emailNormalized;
          player.emailNormalized = emailNormalized;
        }
        player.lastLoginAt = new Date();
        await player.save();
      } else {
        player = await Player.create({
          name: rawName,
          phone: rawPhone,
          phoneNormalized,
          email: emailNormalized,
          emailNormalized,
          spinsUsed: 0,
          maxSpins: config.maxSpinsPerPlayer,
          enteredAt: new Date(),
          lastLoginAt: new Date(),
        });
      }

      await syncAllPlayersToCsv(config.csvFilePath);

      const token = createPlayerToken(player._id, config.sessionSecret);
      res.status(200).json({
        token,
        player: serializePlayerPublic(player),
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          error: 'An entry with that contact already exists. Please submit again to resume.',
        });
      }
      next(error);
    }
  });

  router.get('/players/me', requirePlayer, async (req, res, next) => {
    try {
      const player = await Player.findById(req.playerId);
      if (!player) {
        return res.status(404).json({ error: 'Entry not found. Enter your details again.' });
      }
      res.json({ player: serializePlayerPublic(player) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/wheel/spin', requirePlayer, async (req, res, next) => {
    try {
      const { prize, segmentIndex } = pickWeightedPrize();
      const claimCode = generateClaimCode();
      const spunAt = new Date();

      const updated = await Player.findOneAndUpdate(
        {
          _id: req.playerId,
          $expr: { $lt: ['$spinsUsed', '$maxSpins'] },
        },
        {
          $inc: { spinsUsed: 1 },
          $set: {
            prizeId: prize.id,
            prizeTitle: prize.title,
            claimCode,
            spunAt,
          },
        },
        { new: true }
      );

      if (!updated) {
        const existing = await Player.findById(req.playerId);
        if (!existing) {
          return res.status(404).json({ error: 'Entry not found. Sign in again to play.' });
        }
        return res.status(409).json({
          error: 'You have already spun the wheel with this contact.',
          player: serializePlayerPublic(existing),
        });
      }

      await Spin.create({
        playerId: updated._id,
        playerName: updated.name,
        phone: updated.phone,
        email: updated.email,
        prizeId: prize.id,
        prizeTitle: prize.title,
        segmentIndex,
        claimCode,
        spunAt,
      });

      await syncAllPlayersToCsv(config.csvFilePath);

      res.status(200).json({
        segmentIndex,
        prize: {
          id: prize.id,
          title: prize.title,
          wheelLabel: prize.wheelLabel,
          category: prize.category,
          description: prize.description,
        },
        claimCode,
        spunAt,
        player: serializePlayerPublic(updated),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/entries', requireAdmin, async (_req, res, next) => {
    try {
      const players = await Player.find().sort({ enteredAt: -1 }).lean();
      res.json({
        total: players.length,
        entries: players.map((p) => ({
          id: String(p._id),
          name: p.name,
          phone: p.phone || '',
          email: p.email || '',
          status: p.spinsUsed > 0 ? 'spun' : 'logged_in',
          prizeWon: p.prizeTitle || '',
          claimCode: p.claimCode || '',
          enteredAt: p.enteredAt,
          spunAt: p.spunAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/export.csv', requireAdmin, async (_req, res, next) => {
    try {
      await syncAllPlayersToCsv(config.csvFilePath);
      const csv = await readCsvFile(config.csvFilePath);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="carnival-wheel-entries.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
