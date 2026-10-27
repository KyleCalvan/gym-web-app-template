import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeRegistrationPhone } from '../src/auth/registration-phone.ts';

test('registration accepts common Philippine phone formats and pasted Unicode dashes', () => {
  assert.equal(normalizeRegistrationPhone('09171234567'), '09171234567');
  assert.equal(normalizeRegistrationPhone('+63 917 123 4567'), '+63 917 123 4567');
  assert.equal(normalizeRegistrationPhone(' +63 917–123–4567 '), '+63 917-123-4567');
});

test('registration rejects too-short or non-phone input', () => {
  assert.equal(normalizeRegistrationPhone('123'), null);
  assert.equal(normalizeRegistrationPhone('call me at 09171234567'), null);
});
