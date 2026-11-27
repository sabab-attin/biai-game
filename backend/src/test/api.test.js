import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { loadConfig } from '../config/env.js';
import serverlessApp, { createServerlessHandler } from '../serverless.js';
import { getQuizPrizeForScore } from '../config/prizes.js';
import { QUIZ_QUESTIONS, getQuizQuestion, pickQuizQuestions } from '../config/quiz.js';
import { Admin } from '../models/Admin.js';
import { AdminAudit } from '../models/AdminAudit.js';
import { PendingPlay } from '../models/PendingPlay.js';
import { Player } from '../models/Player.js';
import { RECORD_SOURCES, Record } from '../models/Record.js';
import { Spin } from '../models/Spin.js';
import { WinnerPhoto } from '../models/WinnerPhoto.js';
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

function jsonRequest(pathname, { method = 'GET', body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;

  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function spinUntilClaimable() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const response = await jsonRequest('/api/play/wheel/spin', { method: 'POST' });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.segmentIndex >= 0 && result.segmentIndex < 9);
    if (result.claimable) return result;
  }
  throw new Error('Expected a claimable wheel result within 80 spins.');
}

test.before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnival-wheel-test-'));
  const testDbUri = 'mongodb://127.0.0.1:27017/carnival_wheel_test';

  await mongoose.connect(testDbUri);
  await Promise.all([
    Player.deleteMany({}),
    Spin.deleteMany({}),
    Record.deleteMany({}),
    PendingPlay.deleteMany({}),
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

  await Promise.all([
    Player.init(),
    Spin.init(),
    Record.init(),
    PendingPlay.init(),
    Admin.init(),
  ]);
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
    PendingPlay.deleteMany({}),
    Admin.deleteMany({}),
    AdminAudit.deleteMany({}),
  ]);
  await mongoose.disconnect();
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('a wheel win is saved only after the winner submits a valid phone number', async () => {
  const spin = await spinUntilClaimable();

  assert.ok(spin.playId);
  assert.ok(spin.claimCode.startsWith('CRN-'));
  assert.equal(spin.claimable, true);
  assert.ok(spin.prize?.title);

  const recordId = `play-${spin.playId}`;
  assert.equal(await Record.countDocuments({ recordId }), 0);

  const missingPhone = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: { playId: spin.playId, name: 'Wheel Winner' },
  });
  assert.equal(missingPhone.status, 400);
  assert.equal((await missingPhone.json()).field, 'phone');

  const emailOnly = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: {
      playId: spin.playId,
      name: 'Email Only Player',
      email: 'email-only@example.com',
    },
  });
  assert.equal(emailOnly.status, 400);

  const badEmail = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: {
      playId: spin.playId,
      name: 'Bad Email',
      phone: '01711111111',
      email: 'not-an-email',
    },
  });
  assert.equal(badEmail.status, 400);
  assert.equal((await badEmail.json()).field, 'email');

  const claim = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: {
      playId: spin.playId,
      name: 'No Email Player',
      phone: '01612345678',
    },
  });
  assert.equal(claim.status, 200);
  const claimed = await claim.json();

  assert.equal(claimed.record.source, 'wheel');
  assert.equal(claimed.record.game, 'Wheel');
  assert.equal(claimed.record.name, 'No Email Player');
  assert.equal(claimed.record.phone, '01612345678');
  assert.equal(claimed.record.email, null);
  assert.equal(claimed.record.reward, spin.prize.title);
  assert.equal(claimed.player.name, 'No Email Player');
  assert.equal(claimed.claimCode, spin.claimCode);

  const record = await Record.findOne({ recordId }).lean();
  assert.ok(record);
  assert.equal(record.email, null);

  const log = await fs.readFile(config.recordLogPath, 'utf8');
  assert.match(log, /"name":"No Email Player"/);
  assert.match(log, /"phone":"01612345678"/);
  assert.match(log, /"email":null/);
  assert.match(log, /"source":"wheel"/);
  assert.match(log, /"game":"Wheel"/);

  await rebuildCsvFromMongo(config, { snapshot: false });
  const rows = parseCsv(await fs.readFile(config.recordsCsvPath, 'utf8'));
  const row = rows.find((cells) => cells[0] === 'No Email Player');
  assert.ok(row);
  assert.equal(row[1], '01612345678');
  assert.equal(row[2], '');
  assert.equal(row[3], spin.prize.title);
  assert.equal(row[5], 'wheel');

  const repeatClaim = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: {
      playId: spin.playId,
      name: 'No Email Player',
      phone: '01612345678',
    },
  });
  assert.equal(repeatClaim.status, 409);
});

test('guest mode and the old pre-login endpoints are gone', async () => {
  assert.deepEqual([...RECORD_SOURCES], ['wheel', 'quiz', 'dart']);

  for (const pathname of [
    '/api/players/guest',
    '/api/players/enter',
    '/api/players/me',
    '/api/wheel/spin',
    '/api/quiz/start',
  ]) {
    const response = await jsonRequest(pathname, { method: 'POST' });
    assert.equal(response.status, 404);
  }
});

test('a spin-again result is a free retry and never creates a claim', async () => {
  let spinAgain = null;
  for (let attempt = 0; attempt < 200 && !spinAgain; attempt += 1) {
    const response = await jsonRequest('/api/play/wheel/spin', { method: 'POST' });
    assert.equal(response.status, 200);
    const result = await response.json();
    if (result.spinAgain) spinAgain = result;
  }

  assert.ok(spinAgain, 'expected a spin-again result within 200 spins');
  assert.equal(spinAgain.claimable, false);
  assert.equal(spinAgain.playId, null);
  assert.equal(spinAgain.claimCode, '');
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
      email: 'player@example.com',
      reward: null,
      timestamp: new Date('2026-01-02T00:00:00.000Z'),
      source: 'quiz',
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
    'player@example.com',
    '',
    '2026-01-02T00:00:00.000Z',
    'quiz',
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
  await Record.create({
    recordId: 'csv-health-check',
    name: 'Health Player',
    timestamp: new Date('2026-02-01T00:00:00.000Z'),
    source: 'dart',
    game: 'Darts',
  });

  await fs.mkdir(path.dirname(config.recordsCsvPath), { recursive: true });
  await fs.writeFile(config.recordsCsvPath, 'this is not csv\u0000', 'utf8');

  const result = await ensureCsvHealthy(config);
  assert.equal(result.rebuilt, true);
  assert.ok(result.count >= 1);

  const repaired = await fs.readFile(config.recordsCsvPath, 'utf8');
  assert.equal(isCsvContentValid(repaired), true);
});

test('admin routes return plain 404 to anonymous callers', async () => {
  const anonymousStats = await jsonRequest('/api/admin/stats');
  assert.equal(anonymousStats.status, 404);
  assert.equal(await anonymousStats.text(), 'Not Found');

  const fakeSession = await jsonRequest('/api/admin/stats', {
    cookie: 'biai_admin=fake-token',
  });
  assert.equal(fakeSession.status, 404);

  const anonymousDownload = await jsonRequest('/api/admin/csv/download');
  assert.equal(anonymousDownload.status, 404);

  const wrongLogin = await jsonRequest('/api/admin-login', {
    method: 'POST',
    body: { username: TEST_ADMIN.username, password: 'wrong-password' },
  });
  assert.equal(wrongLogin.status, 404);
});

test('seeded admin can log in, read records, manage manual entries, and download CSV', async () => {
  const login = await jsonRequest('/api/admin-login', {
    method: 'POST',
    body: TEST_ADMIN,
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie') || '';
  adminCookie = setCookie.split(';')[0];
  assert.match(adminCookie, /^biai_admin=/);
  assert.doesNotMatch(setCookie, /Max-Age=|Expires=/i);

  const session = await jsonRequest('/api/admin/session', {
    cookie: adminCookie,
  });
  assert.equal(session.status, 200);
  const sessionBody = await session.json();
  assert.equal(sessionBody.admin.username, TEST_ADMIN.username);

  const stats = await jsonRequest('/api/admin/stats', { cookie: adminCookie });
  assert.equal(stats.status, 200);
  const statsBody = await stats.json();
  assert.ok(statsBody.totalRecords >= 2);
  assert.equal(statsBody.sourceCounts.guest, undefined);

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
  assert.doesNotMatch(csv, /,guest$/m);

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

  const logout = await jsonRequest('/api/admin/logout', {
    method: 'POST',
    cookie: adminCookie,
  });
  assert.equal(logout.status, 200);
  const clearedCookie = logout.headers.get('set-cookie') || '';
  assert.match(clearedCookie, /^biai_admin=;/);
  assert.ok((await AdminAudit.countDocuments({ action: 'logout' })) >= 1);
});

test('quiz sessions contain five distinct questions and scores persist after claiming', async () => {
  assert.equal(QUIZ_QUESTIONS.length, 20);
  const seenIds = new Set();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const questions = pickQuizQuestions(5);
    assert.equal(questions.length, 5);
    assert.equal(new Set(questions.map((question) => question.id)).size, 5);
    const intermediateCount = questions.filter(
      (question) => getQuizQuestion(question.id)?.level === 'intermediate'
    ).length;
    assert.ok(intermediateCount <= 1, 'expected at most 1 intermediate question per quiz');
    for (const question of questions) {
      seenIds.add(question.id);
      assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
    }
  }
  assert.ok(seenIds.size > 10, 'expected shuffled questions across the 20-question bank');

  const start = await jsonRequest('/api/play/quiz/start', { method: 'POST' });
  assert.equal(start.status, 200);
  const quiz = await start.json();
  assert.equal(quiz.questions.length, 5);
  assert.equal(quiz.total, 5);
  assert.equal(new Set(quiz.questions.map((question) => question.id)).size, 5);
  assert.ok(quiz.questions.every((question) => QUIZ_QUESTIONS.some((q) => q.id === question.id)));

  const answers = [];
  for (const question of quiz.questions) {
    const source = getQuizQuestion(question.id);
    const answer = await jsonRequest('/api/play/quiz/answer', {
      method: 'POST',
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

  const finish = await jsonRequest('/api/play/quiz/finish', {
    method: 'POST',
    body: { token: quiz.token, answers },
  });
  assert.equal(finish.status, 200);
  const result = await finish.json();
  assert.equal(result.score, 5);
  assert.equal(result.total, 5);
  assert.equal(result.claimable, true);
  assert.equal(result.prize?.title, 'Free Course');
  assert.ok(result.playId);

  assert.equal(getQuizPrizeForScore(0), null);
  assert.equal(getQuizPrizeForScore(1)?.title, 'Stickers');
  assert.equal(getQuizPrizeForScore(2)?.title, '10% Off');
  assert.equal(getQuizPrizeForScore(3)?.title, '25% Off');
  assert.equal(getQuizPrizeForScore(4)?.title, '50% Off');
  assert.equal(getQuizPrizeForScore(5)?.title, 'Free Course');

  const prizesRes = await jsonRequest('/api/prizes');
  assert.equal(prizesRes.status, 200);
  const prizesBody = await prizesRes.json();
  assert.ok(prizesBody.prizes.some((prize) => prize.id === '85-off' && prize.title === '85% Off'));
  assert.equal(prizesBody.prizes.some((prize) => prize.id === '80-off'), false);

  const zeroAnswers = quiz.questions.map((question) => {
    const source = getQuizQuestion(question.id);
    const wrongOption = source.options.find((opt) => opt.id !== source.correctOptionId);
    return { questionId: question.id, optionId: wrongOption.id };
  });
  const zeroFinish = await jsonRequest('/api/play/quiz/finish', {
    method: 'POST',
    body: { token: quiz.token, answers: zeroAnswers },
  });
  assert.equal(zeroFinish.status, 200);
  const zeroResult = await zeroFinish.json();
  assert.equal(zeroResult.score, 0);
  assert.equal(zeroResult.claimable, false);
  assert.equal(zeroResult.playId, null);
  assert.equal(zeroResult.prize, null);

  const recordId = `play-${result.playId}`;
  assert.equal(await Record.countDocuments({ recordId }), 0);

  const claim = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: {
      playId: result.playId,
      name: 'Quiz Player',
      phone: '01812345678',
      email: 'quiz-player@example.com',
    },
  });
  assert.equal(claim.status, 200);

  const saved = await Record.findOne({ recordId }).lean();
  assert.ok(saved);
  assert.equal(saved.source, 'quiz');
  assert.equal(saved.game, 'Quiz');
  assert.equal(saved.score, 5);
  assert.equal(saved.result, '5/5');
  assert.equal(saved.reward, 'Free Course');
  assert.equal(saved.email, 'quiz-player@example.com');

  const repeatClaim = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: {
      playId: result.playId,
      name: 'Quiz Player',
      phone: '01812345678',
    },
  });
  assert.equal(repeatClaim.status, 409);
});

test('winner photo enforces <=50KB limit, stores in MongoDB, and streams/deletes in admin gallery', async () => {
  const spin = await spinUntilClaimable();
  const claim = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: {
      playId: spin.playId,
      name: 'Photo Winner',
      phone: '01611223344',
    },
  });
  assert.equal(claim.status, 200);

  // Valid minimal RIFF/WEBP payload well under 50 KB
  const validWebpPayload = Buffer.concat([
    Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'ascii'),
    Buffer.alloc(32, 0xab),
  ]);
  const validDataUrl = `data:image/webp;base64,${validWebpPayload.toString('base64')}`;

  // Oversized (> 50 KB) payload must be rejected
  const oversizedBuffer = Buffer.concat([
    Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'ascii'),
    Buffer.alloc(52 * 1024, 0xcd),
  ]);
  const oversizedRes = await jsonRequest('/api/play/photo', {
    method: 'POST',
    body: {
      playId: spin.playId,
      themeId: 'gold',
      imageDataUrl: `data:image/webp;base64,${oversizedBuffer.toString('base64')}`,
    },
  });
  assert.equal(oversizedRes.status, 413);

  const badFormat = await jsonRequest('/api/play/photo', {
    method: 'POST',
    body: {
      playId: spin.playId,
      themeId: 'gold',
      imageDataUrl: 'data:text/plain;base64,aGVsbG8=',
    },
  });
  assert.equal(badFormat.status, 400);

  const missingPlay = await jsonRequest('/api/play/photo', {
    method: 'POST',
    body: {
      playId: 'nonexistent-play-id',
      themeId: 'gold',
      imageDataUrl: validDataUrl,
    },
  });
  assert.equal(missingPlay.status, 404);

  const savedRes = await jsonRequest('/api/play/photo', {
    method: 'POST',
    body: {
      playId: spin.playId,
      themeId: 'crimson',
      imageDataUrl: validDataUrl,
    },
  });
  assert.equal(savedRes.status, 201);
  const savedBody = await savedRes.json();
  assert.equal(savedBody.photo.winnerName, 'Photo Winner');
  assert.equal(savedBody.photo.themeId, 'crimson');
  assert.equal(savedBody.photo.sizeBytes, validWebpPayload.length);
  assert.ok(savedBody.photo.sizeBytes <= 50 * 1024);

  const docCount = await WinnerPhoto.countDocuments({ playId: spin.playId });
  assert.equal(docCount, 1);

  const login = await jsonRequest('/api/admin-login', {
    method: 'POST',
    body: TEST_ADMIN,
  });
  assert.equal(login.status, 200);
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

  const listRes = await jsonRequest('/api/admin/photos', { cookie });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(listBody.photos.some((item) => item.photoId === savedBody.photo.photoId));

  const downloadRes = await fetch(
    `${baseUrl}/api/admin/photos/${savedBody.photo.photoId}/image?download=1`,
    { headers: { Cookie: cookie } }
  );
  assert.equal(downloadRes.status, 200);
  assert.equal(downloadRes.headers.get('content-type'), 'image/webp');
  assert.match(downloadRes.headers.get('content-disposition') || '', /attachment; filename="biai-photo-winner-/);
  const downloadedBytes = Buffer.from(await downloadRes.arrayBuffer());
  assert.deepEqual(downloadedBytes, validWebpPayload);

  const deleteRes = await jsonRequest(`/api/admin/photos/${savedBody.photo.photoId}`, {
    method: 'DELETE',
    cookie,
  });
  assert.equal(deleteRes.status, 200);
  assert.equal(await WinnerPhoto.countDocuments({ playId: spin.playId }), 0);

  // Quiz winners also save sharp <=50KB photos to MongoDB and appear in Admin gallery
  const quizStart = await jsonRequest('/api/play/quiz/start', { method: 'POST' });
  assert.equal(quizStart.status, 200);
  const quizData = await quizStart.json();
  const quizAnswers = quizData.questions.map((q) => ({
    questionId: q.id,
    optionId: getQuizQuestion(q.id).correctOptionId,
  }));
  const quizFinish = await jsonRequest('/api/play/quiz/finish', {
    method: 'POST',
    body: { token: quizData.token, answers: quizAnswers },
  });
  assert.equal(quizFinish.status, 200);
  const quizResult = await quizFinish.json();
  assert.equal(quizResult.claimable, true);

  const quizClaim = await jsonRequest('/api/play/claim', {
    method: 'POST',
    body: {
      playId: quizResult.playId,
      name: 'Quiz Photo Winner',
      phone: '01622334455',
    },
  });
  assert.equal(quizClaim.status, 200);

  const quizPhotoRes = await jsonRequest('/api/play/photo', {
    method: 'POST',
    body: {
      playId: quizResult.playId,
      themeId: 'navy',
      imageDataUrl: validDataUrl,
    },
  });
  assert.equal(quizPhotoRes.status, 201);
  const quizPhotoBody = await quizPhotoRes.json();
  assert.equal(quizPhotoBody.photo.game, 'Quiz');
  assert.equal(quizPhotoBody.photo.prizeTitle, 'Free Course');
  assert.equal(quizPhotoBody.photo.winnerName, 'Quiz Photo Winner');

  const delQuizPhoto = await jsonRequest(`/api/admin/photos/${quizPhotoBody.photo.photoId}`, {
    method: 'DELETE',
    cookie,
  });
  assert.equal(delQuizPhoto.status, 200);
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
    game: 'Darts',
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

test('vercel serverless config uses /tmp storage and fails cleanly without MONGODB_URI', async () => {
  const prevBackupDir = process.env.BACKUP_DIR;
  const prevCsvPath = process.env.CSV_FILE_PATH;
  const prevMongoUri = process.env.MONGODB_URI;
  const prevCookieSecure = process.env.COOKIE_SECURE;
  const prevVercelEnv = process.env.VERCEL_ENV;
  delete process.env.BACKUP_DIR;
  delete process.env.CSV_FILE_PATH;
  delete process.env.MONGODB_URI;
  delete process.env.COOKIE_SECURE;
  delete process.env.VERCEL_ENV;

  try {
    const vercelConfig = loadConfig({
      isVercel: true,
      frontendUrl: 'https://biai-game.vercel.app',
    });
    assert.equal(vercelConfig.isVercel, true);
    assert.ok(vercelConfig.backupDir.startsWith(os.tmpdir()));
    assert.ok(vercelConfig.recordsCsvPath.startsWith(os.tmpdir()));
    assert.equal(vercelConfig.mongodbUri, '');
    assert.equal(vercelConfig.secureCookies, true);
    assert.ok(vercelConfig.allowedOrigins.includes('https://biai-game.vercel.app'));

    process.env.VERCEL_ENV = 'development';
    assert.equal(loadConfig({ isVercel: true }).secureCookies, false);
    delete process.env.VERCEL_ENV;

    const vercelJson = JSON.parse(
      await fs.readFile(path.resolve(import.meta.dirname, '../../../vercel.json'), 'utf8')
    );
    assert.equal(vercelJson.services.backend.root, 'backend');
    assert.equal(vercelJson.services.backend.framework, 'express');
    assert.equal(vercelJson.services.backend.entrypoint, 'src/serverless.js');
    assert.equal(vercelJson.services.frontend.root, 'frontend');
    assert.equal(vercelJson.services.frontend.framework, 'vite');
    assert.deepEqual(
      vercelJson.rewrites.map((r) => [r.source, r.destination?.service]),
      [
        ['/api/(.*)', 'backend'],
        ['/(.*)', 'frontend'],
      ]
    );
    for (const forbidden of [
      'functions',
      'installCommand',
      'buildCommand',
      'devCommand',
      'ignoreCommand',
      'outputDirectory',
      'framework',
    ]) {
      assert.equal(forbidden in vercelJson, false);
    }

    const defaultSrv = http.createServer(serverlessApp);
    await new Promise((resolve) => defaultSrv.listen(0, resolve));
    try {
      const defaultPort = defaultSrv.address().port;
      const prizesRes = await fetch(`http://127.0.0.1:${defaultPort}/api/prizes`);
      assert.equal(prizesRes.status, 200);
    } finally {
      await new Promise((resolve) => defaultSrv.close(resolve));
    }

    const handler = createServerlessHandler({ mongodbUri: '' });
    const srv = http.createServer(handler);
    await new Promise((resolve) => srv.listen(0, resolve));
    const port = srv.address().port;

    try {
      const health = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { ok: true });

      const unconfigured = await fetch(`http://127.0.0.1:${port}/api/play/wheel/spin`, {
        method: 'POST',
      });
      assert.equal(unconfigured.status, 503);
      const errBody = await unconfigured.json();
      assert.match(errBody.error, /MONGODB_URI/i);
    } finally {
      await new Promise((resolve) => srv.close(resolve));
    }
  } finally {
    if (prevBackupDir !== undefined) process.env.BACKUP_DIR = prevBackupDir;
    if (prevCsvPath !== undefined) process.env.CSV_FILE_PATH = prevCsvPath;
    if (prevMongoUri !== undefined) process.env.MONGODB_URI = prevMongoUri;
    if (prevCookieSecure !== undefined) process.env.COOKIE_SECURE = prevCookieSecure;
    if (prevVercelEnv !== undefined) process.env.VERCEL_ENV = prevVercelEnv;
  }
});
