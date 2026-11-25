import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { loadConfig } from '../config/env.js';
import { Player } from '../models/Player.js';
import { Spin } from '../models/Spin.js';

let server;
let baseUrl;
let tempDir;
let csvPath;

test.before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carnival-wheel-test-'));
  csvPath = path.join(tempDir, 'entries.csv');
  const testDbUri = 'mongodb://127.0.0.1:27017/carnival_wheel_test';

  await mongoose.connect(testDbUri);
  await Promise.all([Player.deleteMany({}), Spin.deleteMany({})]);

  const config = loadConfig({
    mongodbUri: testDbUri,
    csvFilePath: csvPath,
    adminPasskey: 'test-passkey',
    sessionSecret: 'test-session-secret',
    maxSpinsPerPlayer: 1,
  });

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
  await Promise.all([Player.deleteMany({}), Spin.deleteMany({})]);
  await mongoose.disconnect();
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('validation rejects missing contact and malformed email', async () => {
  const missingContact = await fetch(`${baseUrl}/api/players/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Amina Rahman' }),
  });
  assert.equal(missingContact.status, 400);

  const badEmail = await fetch(`${baseUrl}/api/players/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Amina Rahman', email: 'not-an-email' }),
  });
  assert.equal(badEmail.status, 400);
});

test('player enters with phone, stores in MongoDB + CSV, spins once, and exports CSV', async () => {
  const enterRes = await fetch(`${baseUrl}/api/players/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tariq Hasan',
      phone: '+880 1711-223344',
    }),
  });
  assert.equal(enterRes.status, 200);
  const entered = await enterRes.json();
  assert.equal(entered.player.name, 'Tariq Hasan');
  assert.equal(entered.player.spinsRemaining, 1);
  assert.ok(entered.token);

  let csvAfterLogin = await fs.readFile(csvPath, 'utf8');
  assert.match(csvAfterLogin, /Tariq Hasan,\+880 1711-223344,,logged_in/);

  const spinRes = await fetch(`${baseUrl}/api/wheel/spin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${entered.token}`,
    },
  });
  assert.equal(spinRes.status, 200);
  const spun = await spinRes.json();
  assert.ok(spun.segmentIndex >= 0 && spun.segmentIndex < 5);
  assert.ok(spun.claimCode.startsWith('CRN-'));
  assert.equal(spun.player.spinsRemaining, 0);

  const secondSpinRes = await fetch(`${baseUrl}/api/wheel/spin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${entered.token}`,
    },
  });
  assert.equal(secondSpinRes.status, 409);

  const csvAfterSpin = await fs.readFile(csvPath, 'utf8');
  assert.match(csvAfterSpin, new RegExp(`Tariq Hasan,\\+880 1711-223344,,spun,${spun.prize.title},${spun.claimCode}`));

  const statsRes = await fetch(`${baseUrl}/api/stats`);
  const stats = await statsRes.json();
  assert.equal(stats.totalEntries, 1);
  assert.equal(stats.totalSpins, 1);

  const unauthExport = await fetch(`${baseUrl}/api/admin/export.csv`);
  assert.equal(unauthExport.status, 401);

  const adminExport = await fetch(`${baseUrl}/api/admin/export.csv`, {
    headers: { 'x-admin-key': 'test-passkey' },
  });
  assert.equal(adminExport.status, 200);
  const downloadedCsv = await adminExport.text();
  assert.match(
    downloadedCsv,
    /playerId,name,phone,email,status,prizeWon,claimCode,enteredAt,spunAt,spinsUsed,lastLoginAt/
  );
  assert.match(downloadedCsv, /Tariq Hasan/);
});

test('email-only entry works and formula prefixes in names are safely escaped in CSV', async () => {
  const enterRes = await fetch(`${baseUrl}/api/players/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '=HYPERLINK("bad")',
      email: 'guest@example.com',
    }),
  });
  assert.equal(enterRes.status, 200);

  const csvText = await fs.readFile(csvPath, 'utf8');
  assert.match(csvText, /'=HYPERLINK/);
  assert.match(csvText, /guest@example\.com/);
});
