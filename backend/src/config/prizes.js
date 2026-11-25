import crypto from 'node:crypto';

export const PRIZES = Object.freeze([
  {
    id: 'free-courses',
    title: 'Free Course',
    wheelLabel: 'FREE COURSE',
    category: 'BIAI pass',
    description: 'Complimentary seat in a live BIAI applied AI workshop or cohort session.',
    weight: 15,
    bgToken: '--color-accent-2',
    fgToken: '--color-paper',
  },
  {
    id: 'chocolates',
    title: 'Chocolates',
    wheelLabel: 'CHOCOLATES',
    category: 'Booth treat',
    description: 'Hand-packed dark and milk chocolate box waiting at the BIAI event desk.',
    weight: 22,
    bgToken: '--color-accent',
    fgToken: '--color-accent-ink',
  },
  {
    id: 'gift-cards',
    title: 'Gift Card',
    wheelLabel: 'GIFT CARD',
    category: 'BIAI voucher',
    description: 'Prepaid BIAI reward voucher toward bootcamps, workshops, or shop gear.',
    weight: 16,
    bgToken: '--color-navy',
    fgToken: '--color-paper',
  },
  {
    id: 'stickers',
    title: 'Stickers',
    wheelLabel: 'STICKERS',
    category: 'Builder pack',
    description: 'Die-cut screen-printed BIAI builder sticker sheet from this edition.',
    weight: 25,
    bgToken: '--color-paper',
    fgToken: '--color-ink',
  },
  {
    id: 'wristbands',
    title: 'Wristbands',
    wheelLabel: 'WRISTBANDS',
    category: 'Event band',
    description: 'Woven BIAI festival wristband with brass clasp from the carnival booth.',
    weight: 22,
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
