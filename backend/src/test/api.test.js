import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { loadConfig } from '../config/env.js';
import { QUIZ_QUESTIONS, getQuizQuestion, pickQuizQuestions } from '../config/quiz.js';
import { Admin } from '../models/Admin.js';
import { AdminAudit } from '../models/AdminAudit.js';
import { Counter } from '../models/Counter.js';
import { Player } from '../models/Player.js';
import { Record } from '../models/Record.js';
import { Spin } from '../models/Spin.js';
import { ensureAdminSeed } from '../services/adminAuth.js';
import {
  RECORD_CSV_HEADER,
  atomicWriteFile,
  ensureCsvHealthy,
  isCsvContentValid,
  parseCsv,
  rebuildCsvFromMongo,
  serializeRecordsToCsv,
} from '../services/csvStore.js';
import { restoreRecordsIfEmpty } from '../services/recordStore.js';

let server;
let baseUrl;
let tempDir;
let config;
let adminCookie;

const TEST_ADMIN = { username: 'ops-admin', password: 'test-admin-password' };

function jsonRequest(pathname, { method = 'GET', body, token, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function enterPlayer(payload) {
  const response = await jsonRequest('/api/players/enter', {
    method: 'POST',
    body: payload,
  });
  assert.equal(response.status, 200);
  return response.json();
}

test.before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnival-wheel-test-'));
  const testDbUri = 'mongodb://127.0.0.1:27017/carnival_wheel_test';

  await mongoose.connect(testDbUri);
  await Promise.all([
    Player.deleteMany({}),
    Spin.deleteMany({}),
    Record.deleteMany({}),
    Counter.deleteMany({}),
    Admin.deleteMany({}),
    AdminAudit.deleteMany({}),
  ]);

  config = loadConfig({
    mongodbUri: testDbUri,
    recordsCsvPath: path.join(tempDir, 'data', 'records.csv'),
    backupDir: path.join(tempDir, 'backups'),
    recordLogPath: path.join(tempDir, 'backups', 'records.log.jsonl'),
    snapshotDir: path.join(tempDir, 'backups', 'csv-snapshots'),
    adminUsername: TEST_ADMIN.username,
    adminPassword: TEST_ADMIN.password,
    secureCookies: false,
    sessionSecret: 'test-session-secret',
    maxSpinsPerPlayer: 1,
    adminLoginMaxAttempts: 50,
    adminLoginWindowMs: 60_000,
  });

  await Promise.all([Player.init(), Spin.init(), Record.init(), Admin.init()]);
  await ensureAdminSeed(config);

  const app = createApp(config);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await Promise.all([
    Player.deleteMany({}),
    Spin.deleteMany({}),
    Record.deleteMany({}),
    Counter.deleteMany({}),
    Admin.deleteMany({}),
    AdminAudit.deleteMany({}),
  ]);
  await mongoose.disconnect();
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('a player must provide a phone number while email stays optional', async () => {
  const missingPhone = await jsonRequest('/api/players/enter', {
    method: 'POST',
    body: { name: 'No Phone Player' },
  });
  assert.equal(missingPhone.status, 400);
  assert.equal((await missingPhone.json()).field, 'phone');

  const emailOnly = await jsonRequest('/api/players/enter', {
    method: 'POST',
    body: { name: 'Email Only Player', email: 'email-only@example.com' },
  });
  assert.equal(emailOnly.status, 400);

  const entered = await enterPlayer({ name: 'No Email Player', phone: '01612345678' });
  assert.equal(entered.player.name, 'No Email Player');
  assert.equal(entered.player.phone, '01612345678');
  assert.equal(entered.player.email, '');

  const record = await Record.findOne({ playerId: entered.player.id, source: 'wheel' }).lean();
  assert.ok(record);
  assert.equal(record.name, 'No Email Player');
  assert.equal(record.phone, '01612345678');
  assert.equal(record.email, null);

  const log = await fs.readFile(config.recordLogPath, 'utf8');
  assert.match(log, /"name":"No Email Player"/);
  assert.match(log, /"phone":"01612345678"/);
  assert.match(log, /"email":null/);

  await rebuildCsvFromMongo(config, { snapshot: false });
  const rows = parseCsv(await fs.readFile(config.recordsCsvPath, 'utf8'));
  const row = rows.find((cells) => cells[0] === 'No Email Player');
  assert.ok(row);
  assert.equal(row[1], '01612345678');
  assert.equal(row[2], '');
  assert.equal(row[3], '');
  assert.equal(row[5], 'wheel');
});

test('supplied but malformed phone or email is rejected', async () => {
  const badEmail = await jsonRequest('/api/players/enter', {
    method: 'POST',
    body: { name: 'Bad Email', phone: '01711111111', email: 'not-an-email' },
  });
  assert.equal(badEmail.status, 400);

  const badPhone = await jsonRequest('/api/players/enter', {
    method: 'POST',
    body: { name: 'Bad Phone', phone: '123' },
  });
  assert.equal(badPhone.status, 400);
});

test('guest entries are numbered sequentially and saved as #Guest names', async () => {
  await Promise.all([Counter.deleteMany({}), Record.deleteMany({ source: 'guest' })]);

  const firstResponse = await jsonRequest('/api/players/guest', { method: 'POST' });
  assert.equal(firstResponse.status, 200);
  const { player: first } = await firstResponse.json();
  assert.equal(first.isGuest, true);
  assert.equal(first.name, '#Guest1');

  const firstRecord = await Record.findOne({ playerId: first.id, source: 'guest' }).lean();
  assert.ok(firstRecord);
  assert.equal(firstRecord.name, '#Guest1');
  assert.equal(firstRecord.phone, null);
  assert.equal(firstRecord.email, null);

  const secondResponse = await jsonRequest('/api/players/guest', { method: 'POST' });
  assert.equal(secondResponse.status, 200);
  const { player: second } = await secondResponse.json();
  assert.equal(second.name, '#Guest2');

  const secondRecord = await Record.findOne({ playerId: second.id, source: 'guest' }).lean();
  assert.ok(secondRecord);
  assert.equal(secondRecord.name, '#Guest2');
});

test('CSV output escapes formulas, separators, quotes, newlines, and blanks nulls', () => {
  const csv = serializeRecordsToCsv([
    {
      name: '=HYPERLINK("bad")',
      phone: '+880 1711-223344',
      email: null,
      reward: 'Acme, Inc',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      source: 'dart',
    },
    {
      name: 'Quote "and"\nnewline',
      phone: null,
      email: 'guest@example.com',
      reward: null,
      timestamp: new Date('2026-01-02T00:00:00.000Z'),
      source: 'guest',
    },
  ]);

  assert.ok(csv.startsWith(RECORD_CSV_HEADER));
  assert.match(csv, /'=HYPERLINK\(""bad""\)/);
  assert.match(csv, /'\+880 1711-223344/);
  assert.match(csv, /"Acme, Inc"/);
  assert.match(csv, /"Quote ""and""\nnewline"/);

  const rows = parseCsv(csv);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], [
    "'=HYPERLINK(\"bad\")",
    "'+880 1711-223344",
    '',
    'Acme, Inc',
    '2026-01-01T00:00:00.000Z',
    'dart',
  ]);
  assert.deepEqual(rows[2], [
    'Quote "and"\nnewline',
    '',
    'guest@example.com',
    '',
    '2026-01-02T00:00:00.000Z',
    'guest',
  ]);
});

test('atomic CSV writes never expose partial content or leave temp files', async () => {
  const filePath = path.join(tempDir, 'data', 'atomic.csv');
  await atomicWriteFile(filePath, 'initial');

  const payloads = Array.from({ length: 12 }, (_, index) =>
    `${index}:${'x'.repeat(5000)}\n`
  );
  await Promise.all(payloads.map((payload) => atomicWriteFile(filePath, payload)));

  const finalContent = await fs.readFile(filePath, 'utf8');
  assert.ok(payloads.includes(finalContent));

  const files = await fs.readdir(path.dirname(filePath));
  assert.equal(files.filter((name) => name.endsWith('.tmp')).length, 0);
});

test('startup rebuild repairs a corrupt CSV from MongoDB', async () => {
  await fs.mkdir(path.dirname(config.recordsCsvPath), { recursive: true });
  await fs.writeFile(config.recordsCsvPath, 'this is not csv\u0000', 'utf8');

  const result = await ensureCsvHealthy(config);
  assert.equal(result.rebuilt, true);
  assert.ok(result.count >= 1);

  const repaired = await fs.readFile(config.recordsCsvPath, 'utf8');
  assert.equal(isCsvContentValid(repaired), true);
});

test('admin routes return plain 404 to anonymous callers and normal players', async () => {
  const anonymousStats = await jsonRequest('/api/admin/stats');
  assert.equal(anonymousStats.status, 404);
  assert.equal(await anonymousStats.text(), 'Not Found');

  const entered = await enterPlayer({
    name: 'Normal Player',
    phone: '01722222222',
    email: 'normal@example.com',
  });
  const playerStats = await jsonRequest('/api/admin/stats', { token: entered.token });
  assert.equal(playerStats.status, 404);

  const anonymousDownload = await jsonRequest('/api/admin/csv/download');
  assert.equal(anonymousDownload.status, 404);

  const wrongLogin = await jsonRequest('/api/admin-login', {
    method: 'POST',
    body: { username: TEST_ADMIN.username, password: 'wrong-password' },
  });
  assert.equal(wrongLogin.status, 404);
});

test('seeded admin can log in, read records, manage dart entries, and download CSV', async () => {
  const login = await jsonRequest('/api/admin-login', {
    method: 'POST',
    body: TEST_ADMIN,
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie') || '';
  adminCookie = setCookie.split(';')[0];
  assert.match(adminCookie, /^biai_admin=/);

  const session = await jsonRequest('/api/admin/session', {
    cookie: adminCookie,
  });
  assert.equal(session.status, 200);
  const sessionBody = await session.json();
  assert.equal(sessionBody.admin.username, TEST_ADMIN.username);

  const stats = await jsonRequest('/api/admin/stats', { cookie: adminCookie });
  assert.equal(stats.status, 200);
  const statsBody = await stats.json();
  assert.ok(statsBody.totalRecords >= 3);

  const loginAudits = await AdminAudit.countDocuments({ action: 'login' });
  assert.ok(loginAudits >= 1);

  const missingGame = await jsonRequest('/api/admin/dart', {
    method: 'POST',
    cookie: adminCookie,
    body: { name: 'No Game Player', result: '10 points' },
  });
  assert.equal(missingGame.status, 400);

  const created = await jsonRequest('/api/admin/dart', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      name: 'Dart Player',
      game: 'Darts',
      phone: '01711223344',
      result: '42 points',
      reward: 'Stickers',
      timestamp: '2026-02-01T12:00:00.000Z',
    },
  });
  assert.equal(created.status, 201);
  const { record: dartRecord } = await created.json();
  assert.equal(dartRecord.source, 'dart');
  assert.equal(dartRecord.result, '42 points');
  assert.equal(dartRecord.game, 'Darts');

  const list = await jsonRequest('/api/admin/dart', { cookie: adminCookie });
  assert.equal(list.status, 200);
  const { records: dartRecords } = await list.json();
  assert.ok(dartRecords.some((record) => record.recordId === dartRecord.recordId));

  const patched = await jsonRequest(`/api/admin/dart/${dartRecord.recordId}`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { reward: 'Notebook', game: 'Darts Final' },
  });
  assert.equal(patched.status, 200);
  const patchedBody = await patched.json();
  assert.equal(patchedBody.record.reward, 'Notebook');
  assert.equal(patchedBody.record.game, 'Darts Final');

  const download = await fetch(`${baseUrl}/api/admin/csv/download`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-type') || '', /text\/csv/);
  const csv = await download.text();
  assert.ok(csv.startsWith(RECORD_CSV_HEADER));
  assert.match(csv, /Dart Player/);

  const removed = await jsonRequest(`/api/admin/dart/${dartRecord.recordId}`, {
    method: 'DELETE',
    cookie: adminCookie,
  });
  assert.equal(removed.status, 200);
  assert.equal(await Record.countDocuments({ recordId: dartRecord.recordId }), 0);

  assert.ok((await AdminAudit.countDocuments({ action: 'dart.create' })) >= 1);
  assert.ok((await AdminAudit.countDocuments({ action: 'dart.update' })) >= 1);
  assert.ok((await AdminAudit.countDocuments({ action: 'dart.delete' })) >= 1);
  assert.ok((await AdminAudit.countDocuments({ action: 'csv.download' })) >= 1);
});

test('quiz sessions contain five distinct questions and scores persist', async () => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const questions = pickQuizQuestions(5);
    assert.equal(questions.length, 5);
    assert.equal(new Set(questions.map((question) => question.id)).size, 5);
    for (const question of questions) {
      assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
    }
  }

  const entered = await enterPlayer({ name: 'Quiz Player', phone: '01812345678' });
  const start = await jsonRequest('/api/quiz/start', {
    method: 'POST',
    token: entered.token,
  });
  assert.equal(start.status, 200);
  const quiz = await start.json();
  assert.equal(quiz.questions.length, 5);
  assert.equal(quiz.total, 5);
  assert.equal(new Set(quiz.questions.map((question) => question.id)).size, 5);
  assert.ok(quiz.questions.every((question) => QUIZ_QUESTIONS.some((q) => q.id === question.id)));

  const answers = [];
  for (const question of quiz.questions) {
    const source = getQuizQuestion(question.id);
    const answer = await jsonRequest('/api/quiz/answer', {
      method: 'POST',
      token: entered.token,
      body: {
        token: quiz.token,
        questionId: question.id,
        optionId: source.correctOptionId,
      },
    });
    assert.equal(answer.status, 200);
    const feedback = await answer.json();
    assert.equal(feedback.correct, true);
    answers.push({ questionId: question.id, optionId: source.correctOptionId });
  }

  const finish = await jsonRequest('/api/quiz/finish', {
    method: 'POST',
    token: entered.token,
    body: { token: quiz.token, answers },
  });
  assert.equal(finish.status, 200);
  const result = await finish.json();
  assert.equal(result.score, 5);
  assert.equal(result.total, 5);

  const saved = await Record.findOne({ playerId: entered.player.id, source: 'quiz' }).lean();
  assert.ok(saved);
  assert.equal(saved.score, 5);
  assert.equal(saved.result, '5/5');
});

test('the wheel keeps one spin per player and saves a wheel record', async () => {
  const entered = await enterPlayer({ name: 'Wheel Player', phone: '01912345678' });

  let spun = null;
  for (let attempt = 0; attempt < 40 && !spun; attempt += 1) {
    const response = await jsonRequest('/api/wheel/spin', {
      method: 'POST',
      token: entered.token,
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.segmentIndex >= 0 && result.segmentIndex < 9);
    if (!result.spinAgain) spun = result;
  }

  assert.ok(spun, 'expected a non-spin-again result within 40 attempts');
  assert.ok(spun.claimCode.startsWith('CRN-'));
  assert.equal(spun.player.spinsRemaining, 0);

  const wheelRecord = await Record.findOne({
    playerId: entered.player.id,
    source: 'wheel',
    reward: spun.prize.title,
  }).lean();
  assert.ok(wheelRecord);
  assert.equal(wheelRecord.name, 'Wheel Player');

  const secondSpin = await jsonRequest('/api/wheel/spin', {
    method: 'POST',
    token: entered.token,
  });
  assert.equal(secondSpin.status, 409);
});

test('an empty database can be restored from the JSONL backup log', async () => {
  const backupRecord = {
    recordId: 'restore-from-log',
    name: 'Restored Player',
    phone: null,
    email: null,
    reward: 'Notebook',
    timestamp: '2026-03-01T09:30:00.000Z',
    source: 'dart',
    createdAt: '2026-03-01T09:30:05.000Z',
    playerId: null,
    result: '10 points',
    score: null,
  };

  await fs.mkdir(path.dirname(config.recordLogPath), { recursive: true });
  await fs.writeFile(config.recordLogPath, `${JSON.stringify(backupRecord)}\n`, 'utf8');
  await Record.deleteMany({});

  const result = await restoreRecordsIfEmpty(config);
  assert.equal(result.restored, 1);

  const restored = await Record.findOne({ recordId: backupRecord.recordId }).lean();
  assert.ok(restored);
  assert.equal(restored.name, 'Restored Player');
  assert.equal(restored.source, 'dart');
});
