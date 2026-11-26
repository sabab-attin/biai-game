import crypto from 'node:crypto';

// Public prize list. Weights are server-side only and are never sent to clients.
// Only spin-again (10%), 80% off (85%), and free-courses (5%) have non-zero
// weights; every other segment is display-only.
export const PRIZES = Object.freeze([
  {
    id: 'spin-again',
    title: 'Spin Again',
    wheelLabel: 'SPIN AGAIN',
    category: 'Bonus turn',
    description: 'One more turn at the wheel — the carnival gives you another go.',
    weight: 10,
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
    id: '80-off',
    title: '80% Off',
    wheelLabel: '80% OFF',
    category: 'BIAI discount',
    description: '80% off any BIAI course or bootcamp enrollment.',
    weight: 85,
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
    weight: 5,
    bgToken: '--color-accent-2',
    fgToken: '--color-paper',
  },
  {
    id: 'stickers',
    title: 'Stickers',
    wheelLabel: 'STICKERS',
    category: 'Builder pack',
    description: 'Die-cut screen-printed BIAI builder sticker sheet from this edition.',
    weight: 0,
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
]);

export function pickWeightedPrize() {
  const totalWeight = PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
  const roll = crypto.randomInt(0, totalWeight);
  let cumulative = 0;

  for (let index = 0; index < PRIZES.length; index += 1) {
    cumulative += PRIZES[index].weight;
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
