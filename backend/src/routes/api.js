import crypto from 'node:crypto';
import express from 'express';
import {
  PRIZES,
  generateClaimCode,
  getQuizPrizeForScore,
  pickWeightedPrize,
} from '../config/prizes.js';
import { getQuizQuestion, pickQuizQuestions } from '../config/quiz.js';
import { PendingPlay } from '../models/PendingPlay.js';
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
import { normalizePhone } from '../services/phone.js';
import { consumeRateLimit, resetRateLimit } from '../services/rateLimit.js';
import {
  RecordPersistenceError,
  persistRecord,
} from '../services/recordStore.js';
import { createQuizToken, verifyQuizToken } from '../services/token.js';
import { createAdminRouter } from './admin.js';

const PLAY_CLAIM_TTL_MS = 1000 * 60 * 60 * 24;

function serializePrize(prize) {
  return {
    id: prize.id,
    title: prize.title,
    wheelLabel: prize.wheelLabel,
    category: prize.category,
    description: prize.description,
  };
}

function serializePlayerPublic(player) {
  const spinsRemaining = Math.max(0, player.maxSpins - player.spinsUsed);
  return {
    id: String(player._id),
    name: player.name,
    phone: player.phone || '',
    email: player.email || '',
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

function gameName(game) {
  return game === 'wheel' ? 'Wheel' : 'Quiz';
}

export function createApiRouter(config) {
  const router = express.Router();

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

  // The wheel is playable without signing in. A claimable result is held for 24h
  // and only becomes a record after the winner submits their contact details.
  router.post('/play/wheel/spin', async (_req, res, next) => {
    try {
      const { prize, segmentIndex } = pickWeightedPrize();
      const createdAt = new Date();
      const spinAgain = prize.id === 'spin-again';
      const claimable = !spinAgain && prize.id !== 'nothing';

      let playId = null;
      let claimCode = '';

      if (claimable) {
        playId = crypto.randomUUID();
        claimCode = generateClaimCode();
        await PendingPlay.create({
          playId,
          game: 'wheel',
          status: 'pending',
          prizeId: prize.id,
          prizeTitle: prize.title,
          segmentIndex,
          claimCode,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + PLAY_CLAIM_TTL_MS),
        });
      }

      res.json({
        playId,
        segmentIndex,
        prize: serializePrize(prize),
        claimCode,
        spinAgain,
        claimable,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/play/quiz/start', async (_req, res, next) => {
    try {
      const questions = pickQuizQuestions(5);
      const token = createQuizToken(
        {
          questionIds: questions.map((question) => question.id),
          quizId: crypto.randomUUID(),
        },
        config.sessionSecret
      );

      res.json({ token, questions, total: questions.length });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/play/quiz/answer', async (req, res, next) => {
    try {
      const payload = verifyQuizToken(req.body?.token, config.sessionSecret);
      if (!payload) {
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
      return next(error);
    }
  });

  router.post('/play/quiz/finish', async (req, res, next) => {
    try {
      const payload = verifyQuizToken(req.body?.token, config.sessionSecret);
      if (!payload) {
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

      const prize = getQuizPrizeForScore(score);
      if (!prize) {
        res.json({
          playId: null,
          score,
          total: payload.qids.length,
          claimable: false,
          prize: null,
        });
        return;
      }

      const playId = crypto.randomUUID();
      const claimCode = generateClaimCode();
      const createdAt = new Date();
      await PendingPlay.create({
        playId,
        game: 'quiz',
        status: 'pending',
        prizeId: prize.id,
        prizeTitle: prize.title,
        claimCode,
        score,
        total: payload.qids.length,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + PLAY_CLAIM_TTL_MS),
      });

      res.json({
        playId,
        score,
        total: payload.qids.length,
        claimable: true,
        prize: serializePrize(prize),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/play/claim', async (req, res, next) => {
    try {
      const playId = String(req.body?.playId || '').trim();
      if (!playId) {
        return res.status(400).json({ field: 'playId', error: 'Missing game result.' });
      }

      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (name.length < 2 || name.length > 80) {
        return res.status(400).json({
          field: 'name',
          error: 'Enter your full name (at least 2 characters).',
        });
      }

      const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const phoneNormalized = normalizePhone(rawPhone);
      if (!phoneNormalized) {
        return res.status(400).json({
          field: 'phone',
          error:
            'Phone number is required. Enter an 11-digit Bangladesh mobile number starting with 01, or use +880.',
        });
      }

      const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const emailNormalized = normalizeEmail(rawEmail);
      if (emailNormalized === null) {
        return res.status(400).json({
          field: 'email',
          error: 'That email address looks incomplete. Write it as name@example.com.',
        });
      }

      const pending = await PendingPlay.findOne({ playId }).lean();
      if (!pending) {
        return res.status(404).json({ error: 'This result was not found. Play again.' });
      }
      if (pending.status === 'claimed') {
        return res.status(409).json({ error: 'This result has already been claimed.' });
      }
      if (pending.expiresAt && pending.expiresAt.getTime() < Date.now()) {
        return res.status(410).json({ error: 'This result expired. Play again.' });
      }

      let byPhone = await Player.findOne({ phoneNormalized });
      let byEmail = emailNormalized ? await Player.findOne({ emailNormalized }) : null;

      if (byPhone && byEmail && String(byPhone._id) !== String(byEmail._id)) {
        return res.status(409).json({
          field: 'phone',
          error: 'That phone number and email belong to different entries. Use one matching contact.',
        });
      }

      let player = byPhone || byEmail;

      if (player) {
        const alreadyClaimed = await Record.exists({
          playerId: player._id,
          source: pending.game,
        });
        if (alreadyClaimed) {
          return res.status(409).json({
            error: `This contact already has a saved ${gameName(pending.game)} result.`,
          });
        }

        player.name = name;
        player.phone = rawPhone;
        player.phoneNormalized = phoneNormalized;
        if (emailNormalized) {
          player.email = rawEmail;
          player.emailNormalized = emailNormalized;
        }
        player.lastLoginAt = new Date();
        await player.save();
      } else {
        player = await Player.create({
          name,
          phone: rawPhone,
          phoneNormalized,
          email: emailNormalized ? rawEmail : '',
          emailNormalized,
          spinsUsed: 0,
          maxSpins: config.maxSpinsPerPlayer,
          enteredAt: new Date(),
          lastLoginAt: new Date(),
        });
      }

      const claimedAt = new Date();
      const recordInput = {
        recordId: `play-${playId}`,
        name,
        phone: rawPhone,
        email: emailNormalized ? rawEmail : null,
        timestamp: claimedAt,
        source: pending.game,
        game: gameName(pending.game),
        playerId: player._id,
      };

      if (pending.game === 'wheel') {
        recordInput.reward = pending.prizeTitle;
        recordInput.result = null;
        recordInput.score = null;
      } else {
        recordInput.reward =
          pending.prizeTitle || `Quiz score ${pending.score}/${pending.total}`;
        recordInput.result = `${pending.score}/${pending.total}`;
        recordInput.score = pending.score;
      }

      let record;
      try {
        record = await persistRecord(recordInput, config);
      } catch (error) {
        if (error instanceof RecordPersistenceError) {
          return res.status(503).json({ error: error.message });
        }
        throw error;
      }

      if (pending.game === 'wheel') {
        player.prizeId = pending.prizeId;
        player.prizeTitle = pending.prizeTitle;
        player.claimCode = pending.claimCode;
        player.spunAt = pending.createdAt || claimedAt;
        player.spinsUsed = Math.min(player.maxSpins, player.spinsUsed + 1);
        await player.save();

        await Spin.findOneAndUpdate(
          { claimCode: pending.claimCode },
          {
            $setOnInsert: {
              playerId: player._id,
              playerName: name,
              phone: player.phone,
              email: player.email,
              prizeId: pending.prizeId,
              prizeTitle: pending.prizeTitle,
              segmentIndex: pending.segmentIndex ?? 0,
              claimCode: pending.claimCode,
              spunAt: pending.createdAt || claimedAt,
            },
          },
          { upsert: true, new: true }
        );
      }

      await PendingPlay.updateOne(
        { playId, status: 'pending' },
        { $set: { status: 'claimed', claimedAt, playerId: player._id } }
      );

      res.json({
        record,
        player: serializePlayerPublic(player),
        game: gameName(pending.game),
        claimCode: pending.claimCode || '',
        prizeTitle: pending.prizeTitle || '',
        score: pending.score ?? null,
        total: pending.total ?? null,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          error: 'That phone number or email is already linked to another entry.',
        });
      }
      return next(error);
    }
  });

  router.use('/admin', createAdminRouter(config));

  return router;
}
