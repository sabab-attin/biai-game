import { Counter } from '../models/Counter.js';
import { Record } from '../models/Record.js';

const GUEST_COUNTER_ID = 'guest';

async function highestGuestNumber() {
  const namedGuests = await Record.find({
    source: 'guest',
    name: { $regex: /^#Guest\d+$/ },
  })
    .select('name')
    .lean();

  let highest = 0;
  for (const record of namedGuests) {
    const match = /^#Guest(\d+)$/.exec(record.name || '');
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}

async function ensureCounter() {
  const existing = await Counter.findById(GUEST_COUNTER_ID);
  if (existing) return;

  // Bootstrap from any guest records created before the counter existed.
  const startingSequence = await highestGuestNumber();
  try {
    await Counter.create({ _id: GUEST_COUNTER_ID, seq: startingSequence });
  } catch (error) {
    // Another request may have created it first; that is safe.
    if (error?.code !== 11000) throw error;
  }
}

export async function nextGuestNumber() {
  await ensureCounter();
  const counter = await Counter.findOneAndUpdate(
    { _id: GUEST_COUNTER_ID },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.seq;
}

export async function nextGuestName() {
  const number = await nextGuestNumber();
  return { name: `#Guest${number}`, number };
}
