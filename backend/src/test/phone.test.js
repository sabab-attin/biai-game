import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePhone } from '../services/phone.js';

test('normalizes Bangladesh mobile numbers to the 11-digit local format', () => {
  assert.equal(normalizePhone('01545969532'), '01545969532');
  assert.equal(normalizePhone('+880 1545-969532'), '01545969532');
  assert.equal(normalizePhone('+880 (1711) 223-344'), '01711223344');
});

test('rejects phone numbers outside Bangladesh mobile formats', () => {
  assert.equal(normalizePhone('0154596953'), null);
  assert.equal(normalizePhone('01123456789'), null);
  assert.equal(normalizePhone('8801711223344'), null);
  assert.equal(normalizePhone(''), '');
});
