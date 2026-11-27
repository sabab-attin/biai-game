import crypto from 'node:crypto';

// Public prize list. Weights are server-side only and are never sent to clients.
// Active wheel weights: 85% Off (35%), Free Course (35%), Stickers (20%),
// Spin Again (5%), and Chocolate (5%). All other segments are display-only (weight 0).
export const PRIZES = Object.freeze([
  {
    id: 'spin-again',
    title: 'Spin Again',
    wheelLabel: 'SPIN AGAIN',
    category: 'Bonus turn',
    description: 'One more turn at the wheel — the carnival gives you another go.',
    weight: 5,
    bgToken: '--color-navy',
    fgToken: '--color-paper',
  },
  {
    id: 'nothing',
    title: 'Nothing',
    wheelLabel: 'NOTHING',
    category: 'Try again',
    description: 'A dry spin. No prize this time.',
    weight: 0,
    bgToken: '--color-paper-3',
    fgToken: '--color-ink',
  },
  {
    id: '85-off',
    title: '85% Off',
    wheelLabel: '85% OFF',
    category: 'BIAI discount',
    description: '85% off any BIAI course or bootcamp enrollment.',
    weight: 35,
    bgToken: '--color-accent-2',
    fgToken: '--color-paper',
  },
  {
    id: '10-off',
    title: '10% Off',
    wheelLabel: '10% OFF',
    category: 'BIAI discount',
    description: '10% off a BIAI course enrollment.',
    weight: 0,
    bgToken: '--color-paper',
    fgToken: '--color-ink',
  },
  {
    id: '25-off',
    title: '25% Off',
    wheelLabel: '25% OFF',
    category: 'BIAI discount',
    description: '25% off a BIAI course enrollment.',
    weight: 0,
    bgToken: '--color-accent',
    fgToken: '--color-accent-ink',
  },
  {
    id: '50-off',
    title: '50% Off',
    wheelLabel: '50% OFF',
    category: 'BIAI discount',
    description: '50% off a BIAI course enrollment.',
    weight: 0,
    bgToken: '--color-navy',
    fgToken: '--color-paper',
  },
  {
    id: 'free-courses',
    title: 'Free Course',
    wheelLabel: 'FREE COURSE',
    category: 'BIAI pass',
    description: 'Complimentary seat in a live BIAI applied AI workshop or cohort session.',
    weight: 35,
    bgToken: '--color-accent-2',
    fgToken: '--color-paper',
  },
  {
    id: 'stickers',
    title: 'Stickers',
    wheelLabel: 'STICKERS',
    category: 'Builder pack',
    description: 'Die-cut screen-printed BIAI builder sticker sheet from this edition.',
    weight: 20,
    bgToken: '--color-paper',
    fgToken: '--color-ink',
  },
  {
    id: 'notebook',
    title: 'Notebook',
    wheelLabel: 'NOTEBOOK',
    category: 'Stationery',
    description: 'BIAI carnival notebook for your next build.',
    weight: 0,
    bgToken: '--color-paper-3',
    fgToken: '--color-ink',
  },
  {
    id: 'chocolate',
    title: 'Chocolate',
    wheelLabel: 'CHOCOLATE',
    category: 'Sweet treat',
    description: 'A carnival chocolate treat from the BIAI booth.',
    weight: 5,
    bgToken: '--color-accent',
    fgToken: '--color-accent-ink',
  },
]);

export const QUIZ_PRIZE_IDS_BY_SCORE = Object.freeze({
  1: 'stickers',
  2: '10-off',
  3: '25-off',
  4: '50-off',
  5: 'free-courses',
});

let activeWeightOverrides = null;

function activeWeightFor(prize) {
  if (activeWeightOverrides && activeWeightOverrides.has(prize.id)) {
    return activeWeightOverrides.get(prize.id);
  }
  return prize.weight;
}

export function getEffectivePrizeWeights() {
  const prizes = PRIZES.map((prize) => ({
    id: prize.id,
    title: prize.title,
    wheelLabel: prize.wheelLabel,
    category: prize.category,
    weight: activeWeightFor(prize),
    defaultWeight: prize.weight,
  }));
  const totalWeight = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  return {
    prizes,
    totalWeight,
    isCustom: Boolean(activeWeightOverrides),
  };
}

export function setWheelWeightOverrides(weightsInput = {}) {
  const entries =
    weightsInput instanceof Map
      ? Array.from(weightsInput.entries())
      : Object.entries(weightsInput || {});

  const next = new Map();
  const validIds = new Set(PRIZES.map((prize) => prize.id));

  for (const [id, rawValue] of entries) {
    if (!validIds.has(id)) {
      throw new Error(`Unknown prize id: ${id}`);
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) {
      throw new Error(`Weight for "${id}" must be a non-negative number.`);
    }
    next.set(id, Math.round(parsed * 100) / 100);
  }

  for (const prize of PRIZES) {
    if (!next.has(prize.id)) {
      next.set(prize.id, prize.weight);
    }
  }

  const total = PRIZES.reduce((sum, prize) => sum + (next.get(prize.id) ?? 0), 0);
  if (total <= 0) {
    throw new Error('At least one wheel option must have a weight greater than 0.');
  }

  activeWeightOverrides = next;
  return getEffectivePrizeWeights();
}

export function resetWheelWeightOverrides() {
  activeWeightOverrides = null;
  return getEffectivePrizeWeights();
}

export function getQuizPrizeForScore(score) {
  const key = String(score);
  const prizeId = activeQuizSettings
    ? activeQuizSettings.rewardsByScore.get(key) || ''
    : QUIZ_PRIZE_IDS_BY_SCORE[score] || '';
  if (!prizeId || prizeId === 'none' || prizeId === 'nothing') return null;
  return PRIZES.find((prize) => prize.id === prizeId) || null;
}

let activeQuizSettings = null;
export const DEFAULT_QUIZ_QUESTION_COUNT = 5;
export const MAX_QUIZ_QUESTION_COUNT = 20;

function defaultQuizRewardsObject() {
  return Object.fromEntries(
    Object.entries(QUIZ_PRIZE_IDS_BY_SCORE).map(([k, v]) => [String(k), v])
  );
}

export function getQuizQuestionCount() {
  return activeQuizSettings ? activeQuizSettings.questionCount : DEFAULT_QUIZ_QUESTION_COUNT;
}

export function getPublicQuizRewardTiers() {
  const count = getQuizQuestionCount();
  const tiers = [];
  for (let score = 1; score <= count; score += 1) {
    const prize = getQuizPrizeForScore(score);
    if (prize) {
      tiers.push({ score, title: prize.title });
    }
  }
  return tiers;
}

export function getEffectiveQuizSettings() {
  const questionCount = getQuizQuestionCount();
  const rewardsByScore = {};
  for (let score = 1; score <= Math.max(questionCount, DEFAULT_QUIZ_QUESTION_COUNT); score += 1) {
    const key = String(score);
    rewardsByScore[key] = activeQuizSettings
      ? activeQuizSettings.rewardsByScore.get(key) || ''
      : QUIZ_PRIZE_IDS_BY_SCORE[score] || '';
  }

  return {
    questionCount,
    maxQuestions: MAX_QUIZ_QUESTION_COUNT,
    rewardsByScore,
    availablePrizes: PRIZES.filter((p) => p.id !== 'spin-again' && p.id !== 'nothing').map(
      (p) => ({ id: p.id, title: p.title })
    ),
    defaults: {
      questionCount: DEFAULT_QUIZ_QUESTION_COUNT,
      rewardsByScore: defaultQuizRewardsObject(),
    },
    isCustom: Boolean(activeQuizSettings),
  };
}

export function setQuizSettings(input = {}, maxQuestions = MAX_QUIZ_QUESTION_COUNT) {
  const count = Number(input?.questionCount ?? DEFAULT_QUIZ_QUESTION_COUNT);
  if (!Number.isInteger(count) || count < 1 || count > maxQuestions) {
    throw new Error(`Question count must be a whole number between 1 and ${maxQuestions}.`);
  }

  const rawRewards = input?.rewardsByScore;
  const entries =
    rawRewards instanceof Map
      ? Array.from(rawRewards.entries())
      : rawRewards && typeof rawRewards === 'object'
        ? Object.entries(rawRewards)
        : Object.entries(defaultQuizRewardsObject());

  const validPrizeIds = new Set(
    PRIZES.filter((p) => p.id !== 'spin-again' && p.id !== 'nothing').map((p) => p.id)
  );
  const rewardsMap = new Map();

  for (const [rawScore, rawPrizeId] of entries) {
    const score = Number(rawScore);
    if (!Number.isInteger(score) || score < 1 || score > maxQuestions) {
      continue;
    }
    const prizeId = String(rawPrizeId || '').trim();
    if (!prizeId || prizeId === 'none' || prizeId === 'nothing') {
      rewardsMap.set(String(score), '');
      continue;
    }
    if (!validPrizeIds.has(prizeId)) {
      throw new Error(`Invalid quiz reward "${prizeId}" for score ${score}.`);
    }
    rewardsMap.set(String(score), prizeId);
  }

  activeQuizSettings = {
    questionCount: count,
    rewardsByScore: rewardsMap,
  };
  return getEffectiveQuizSettings();
}

export function resetQuizSettings() {
  activeQuizSettings = null;
  return getEffectiveQuizSettings();
}

export function pickWeightedPrize() {
  const weights = PRIZES.map((prize) => Math.max(0, activeWeightFor(prize)));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    return { prize: PRIZES[0], segmentIndex: 0 };
  }

  // Scale by 100 so fractional weights (if ever entered) work with crypto.randomInt.
  const scale = 100;
  const scaledTotal = Math.round(totalWeight * scale);
  const roll = crypto.randomInt(0, scaledTotal);
  let cumulative = 0;

  for (let index = 0; index < PRIZES.length; index += 1) {
    cumulative += Math.round(weights[index] * scale);
    if (roll < cumulative) {
      return { prize: PRIZES[index], segmentIndex: index };
    }
  }

  return { prize: PRIZES[0], segmentIndex: 0 };
}

export function generateClaimCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return `CRN-${suffix}`;
}
