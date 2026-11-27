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
  const prizeId = QUIZ_PRIZE_IDS_BY_SCORE[score];
  if (!prizeId) return null;
  return PRIZES.find((prize) => prize.id === prizeId) || null;
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
