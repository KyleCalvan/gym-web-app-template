import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptTotpSecret, encryptTotpSecret, newTotpSecret, totpCode, verifyTotpCode } from '../src/auth/totp.ts';

test('authenticator codes match the published TOTP SHA-1 vector and reject invalid values', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(totpCode(secret, 1), '287082');
  assert.equal(verifyTotpCode(secret, '287082', 59_000), true);
  assert.equal(verifyTotpCode(secret, '287082', 119_000), false);
  assert.equal(verifyTotpCode(secret, '12345', 59_000), false);
});

test('enrollment secrets are encrypted before storage', () => {
  process.env.NEXTAUTH_SECRET = 'test-only-encryption-key';
  const secret = newTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  assert.ok(!encrypted.includes(secret));
  assert.equal(decryptTotpSecret(encrypted), secret);
  assert.notEqual(encryptTotpSecret(secret), encrypted);
});
