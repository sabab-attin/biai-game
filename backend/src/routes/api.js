import crypto from 'node:crypto';
import express from 'express';
import { PRIZES, generateClaimCode, pickWeightedPrize } from '../config/prizes.js';
import { getQuizQuestion, pickQuizQuestions } from '../config/quiz.js';
import { Player } from '../models/Player.js';
import { Spin } from '../models/Spin.js';
import {
  adminNotFound,
  authenticateAdmin,
  issueAdminToken,
  setAdminCookie,
} from '../services/adminAuth.js';
import { logAdminAction } from '../services/audit.js';
import { normalizeEmail } from '../services/email.js';
import { nextGuestName } from '../services/guestSequence.js';
import { normalizePhone } from '../services/phone.js';
import { consumeRateLimit, resetRateLimit } from '../services/rateLimit.js';
import {
  RecordPersistenceError,
  persistRecord,
} from '../services/recordStore.js';
import {
  createPlayerToken,
  createQuizToken,
  verifyPlayerToken,
  verifyQuizToken,
} from '../services/token.js';
import { createAdminRouter } from './admin.js';

function maskContact(phone, email) {
  if (phone) {
    return `Phone ending ${phone.slice(-4)}`;
  }
  if (email) {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return '';
}

function contactLabelFor(player) {
  if (player.isGuest) return 'Guest session';
  return maskContact(player.phone, player.email) || 'No contact provided';
}

function serializePlayerPublic(player) {
  const spinsRemaining = Math.max(0, player.maxSpins - player.spinsUsed);
  return {
    id: String(player._id),
    name: player.name,
    isGuest: Boolean(player.isGuest),
    phone: player.phone || '',
    email: player.email || '',
    contactLabel: contactLabelFor(player),
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

function serializePrize(prize) {
  return {
    id: prize.id,
    title: prize.title,
    wheelLabel: prize.wheelLabel,
    category: prize.category,
    description: prize.description,
  };
}

function recordContact(player) {
  if (!player) {
    return { name: null, phone: null, email: null };
  }
  return {
    name: player.name || null,
    phone: player.isGuest ? null : player.phone || null,
    email: player.isGuest ? null : player.email || null,
  };
}

function recordPlayerId(player) {
  return player?._id || null;
}

async function saveInteractionOrRespond(res, config, input, player) {
  try {
    await persistRecord(input, config);
    return true;
  } catch (error) {
    if (error instanceof RecordPersistenceError) {
      res.status(503).json({
        error: error.message,
        player: player ? serializePlayerPublic(player) : undefined,
      });
      return false;
    }
    throw error;
  }
}

export function createApiRouter(config) {
  const router = express.Router();

  function requirePlayer(req, res, next) {
    const auth = req.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const playerId = verifyPlayerToken(token, config.sessionSecret);
    if (!playerId) {
      return res.status(401).json({
        error: 'Session expired or missing. Enter your details to play.',
      });
    }
    req.playerId = playerId;
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

  router.post('/admin-login', async (req, res, next) => {
    try {
      const key = `admin-login:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
      const limit = consumeRateLimit(key, {
        max: config.adminLoginMaxAttempts,
        windowMs: config.adminLoginWindowMs,
      });

      if (!limit.allowed) {
        console.warn('[admin] Login rate limit reached; rejecting request as not found.');
        return adminNotFound(res);
      }

      const admin = await authenticateAdmin(req.body?.username, req.body?.password);
      if (!admin) {
        return adminNotFound(res);
      }

      resetRateLimit(key);
      const token = issueAdminToken(admin, config);
      setAdminCookie(res, token, config);
      await logAdminAction(admin._id, 'login', {
        username: admin.username,
        ip: req.ip || null,
      });

      res.json({
        admin: {
          id: String(admin._id),
          username: admin.username,
          role: admin.role,
        },
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

      const phoneNormalized = normalizePhone(rawPhone);
      if (!phoneNormalized) {
        return res.status(400).json({
          field: 'phone',
          error: 'Phone number is required. Enter an 11-digit Bangladesh mobile number starting with 01, or use +880.',
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
        player.isGuest = false;
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
          isGuest: false,
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

      const logged = await saveInteractionOrRespond(
        res,
        config,
        {
          ...recordContact(player),
          reward: null,
          timestamp: new Date(),
          source: 'wheel',
          playerId: recordPlayerId(player),
        },
        player
      );
      if (!logged) return undefined;

      const token = createPlayerToken(player._id, config.sessionSecret);
      return res.status(200).json({
        token,
        player: serializePlayerPublic(player),
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          error: 'An entry with that contact already exists. Please submit again to resume.',
        });
      }
      return next(error);
    }
  });

  router.post('/players/guest', async (req, res, next) => {
    try {
      const guest = await nextGuestName();
      const player = await Player.create({
        name: guest.name,
        isGuest: true,
        spinsUsed: 0,
        maxSpins: config.maxSpinsPerPlayer,
        enteredAt: new Date(),
        lastLoginAt: new Date(),
      });

      const logged = await saveInteractionOrRespond(
        res,
        config,
        {
          name: guest.name,
          phone: null,
          email: null,
          reward: null,
          timestamp: new Date(),
          source: 'guest',
          playerId: recordPlayerId(player),
        },
        player
      );
      if (!logged) return undefined;

      const token = createPlayerToken(player._id, config.sessionSecret);
      return res.status(200).json({
        token,
        player: serializePlayerPublic(player),
      });
    } catch (error) {
      return next(error);
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

      if (prize.id === 'spin-again') {
        const refunded = await Player.findOneAndUpdate(
          { _id: updated._id },
          {
            $inc: { spinsUsed: -1 },
            $set: { prizeId: '', prizeTitle: '', claimCode: '', spunAt: null },
          },
          { new: true }
        );

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

        const logged = await saveInteractionOrRespond(
          res,
          config,
          {
            ...recordContact(updated),
            reward: prize.title,
            timestamp: spunAt,
            source: 'wheel',
            playerId: recordPlayerId(updated),
          },
          refunded || updated
        );
        if (!logged) return undefined;

        return res.status(200).json({
          segmentIndex,
          prize: serializePrize(prize),
          claimCode: '',
          spunAt,
          player: serializePlayerPublic(refunded || updated),
          spinAgain: true,
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

      const logged = await saveInteractionOrRespond(
        res,
        config,
        {
          ...recordContact(updated),
          reward: prize.title,
          timestamp: spunAt,
          source: 'wheel',
          playerId: recordPlayerId(updated),
        },
        updated
      );
      if (!logged) return undefined;

      return res.status(200).json({
        segmentIndex,
        prize: serializePrize(prize),
        claimCode,
        spunAt,
        player: serializePlayerPublic(updated),
        spinAgain: false,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/quiz/start', requirePlayer, async (req, res, next) => {
    try {
      const questions = pickQuizQuestions(5);
      const token = createQuizToken(
        {
          playerId: req.playerId,
          questionIds: questions.map((question) => question.id),
          quizId: crypto.randomUUID(),
        },
        config.sessionSecret
      );

      res.json({ token, questions, total: questions.length });
    } catch (error) {
      next(error);
    }
  });

  router.post('/quiz/answer', requirePlayer, async (req, res, next) => {
    try {
      const payload = verifyQuizToken(req.body?.token, config.sessionSecret);
      if (!payload || payload.pid !== String(req.playerId)) {
        return res.status(400).json({ error: 'Quiz session is invalid or expired.' });
      }

      const questionId = String(req.body?.questionId || '');
      if (!payload.qids.includes(questionId)) {
        return res.status(400).json({ error: 'That question is not part of this quiz.' });
      }

      const question = getQuizQuestion(questionId);
      if (!question) {
        return res.status(400).json({ error: 'Question not found.' });
      }

      const optionId = Number(req.body?.optionId);
      const optionExists = question.options.some((option) => option.id === optionId);
      if (!optionExists) {
        return res.status(400).json({ error: 'Choose a valid answer.' });
      }

      res.json({
        correct: optionId === question.correctOptionId,
        correctOptionId: question.correctOptionId,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/quiz/finish', requirePlayer, async (req, res, next) => {
    try {
      const payload = verifyQuizToken(req.body?.token, config.sessionSecret);
      if (!payload || payload.pid !== String(req.playerId)) {
        return res.status(400).json({ error: 'Quiz session is invalid or expired.' });
      }

      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const answerByQuestion = new Map(
        answers.map((answer) => [String(answer?.questionId || ''), Number(answer?.optionId)])
      );

      let score = 0;
      for (const questionId of payload.qids) {
        const question = getQuizQuestion(questionId);
        if (!question) continue;
        if (answerByQuestion.get(questionId) === question.correctOptionId) {
          score += 1;
        }
      }

      const player = await Player.findById(req.playerId);
      if (!player) {
        return res.status(404).json({ error: 'Entry not found. Sign in again.' });
      }

      let record = null;
      try {
        record = await persistRecord(
          {
            recordId: `quiz-${payload.quizId}`,
            ...recordContact(player),
            reward: `Quiz score ${score}/${payload.qids.length}`,
            timestamp: new Date(),
            source: 'quiz',
            playerId: player._id,
            result: `${score}/${payload.qids.length}`,
            score,
          },
          config
        );
      } catch (error) {
        if (error instanceof RecordPersistenceError) {
          return res.status(503).json({ error: error.message });
        }
        throw error;
      }

      const savedScore = record?.score ?? score;
      res.json({
        score: savedScore,
        total: payload.qids.length,
        record,
      });
    } catch (error) {
      next(error);
    }
  });

  router.use('/admin', createAdminRouter(config));

  return router;
}
