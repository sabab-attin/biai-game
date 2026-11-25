import fs from 'node:fs/promises';
import path from 'node:path';

const CSV_HEADER = 'playerId,name,phone,email,status,prizeWon,claimCode,enteredAt,spunAt';
const queues = new Map();

function sanitizeCell(rawValue) {
  let str = rawValue == null ? '' : String(rawValue);
  str = str.replace(/\r\n|\r|\n/g, ' ').trim();

  // Defuse spreadsheet formula prefixes while keeping normal international phone numbers like +8801711223344 readable.
  const isPhoneWithPlus = /^\+[0-9\s().-]{6,20}$/.test(str);
  if (!isPhoneWithPlus && /^[=@\t\r]/.test(str)) {
    str = `'${str}`;
  } else if (!isPhoneWithPlus && /^[+-]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function serializePlayersToCsv(players) {
  const rows = players.map((player) => {
    const status = player.spinsUsed > 0 ? 'spun' : 'logged_in';
    const cells = [
      player._id,
      player.name,
      player.phone || '',
      player.email || '',
      status,
      player.prizeTitle || '',
      player.claimCode || '',
      player.enteredAt ? new Date(player.enteredAt).toISOString() : '',
      player.spunAt ? new Date(player.spunAt).toISOString() : '',
    ];
    return cells.map(sanitizeCell).join(',');
  });

  return `${CSV_HEADER}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

export function enqueueCsvWrite(filePath, task) {
  const prev = queues.get(filePath) || Promise.resolve();
  const next = prev.then(task, task);
  queues.set(filePath, next);
  return next;
}

export async function syncCsvFromPlayers(players, filePath) {
  return enqueueCsvWrite(filePath, async () => {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const csvContent = serializePlayersToCsv(players);
    await fs.writeFile(tmpPath, csvContent, 'utf8');
    await fs.rename(tmpPath, filePath);
    return csvContent;
  });
}

export async function readCsvFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return `${CSV_HEADER}\n`;
    }
    throw error;
  }
}
