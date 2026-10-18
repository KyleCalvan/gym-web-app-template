import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
  authenticateDemoAccount,
  createDemoSessionToken,
  getDemoAccounts,
  isDemoLoginEnabled,
  readDemoSessionToken,
} from '../src/auth/demo-session.ts';

const originalSecret = process.env.DEMO_SESSION_SECRET;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;
const originalNodeEnv = process.env.NODE_ENV;
const originalEnabled = process.env.DEMO_ACCOUNTS_ENABLED;

afterEach(() => restoreEnvironment());

function restoreEnvironment() {
  if (originalSecret === undefined) delete process.env.DEMO_SESSION_SECRET;
  else process.env.DEMO_SESSION_SECRET = originalSecret;
  if (originalNextAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalEnabled === undefined) delete process.env.DEMO_ACCOUNTS_ENABLED;
  else process.env.DEMO_ACCOUNTS_ENABLED = originalEnabled;
}

test('lists demo credentials for each role and authenticates only matching credentials', () => {
  const accounts = getDemoAccounts();
  assert.deepEqual(accounts.map(({ role }) => role), ['member', 'staff', 'trainer', 'admin', 'superadmin']);
  for (const account of accounts) {
    assert.equal(authenticateDemoAccount(account.email, account.password)?.role, account.role);
  }
  assert.equal(authenticateDemoAccount(' ADMIN@vinathletics.gym ', 'admin123')?.role, 'admin');
  assert.equal(authenticateDemoAccount('admin@vinathletics.gym', 'incorrect'), null);
  assert.equal(authenticateDemoAccount('unknown@vinathletics.gym', 'admin123'), null);
});

test('signs, verifies, rejects tampered, and expires demo sessions', () => {
  delete process.env.DEMO_SESSION_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  process.env.NODE_ENV = 'development';
  const devSession = authenticateDemoAccount('member@vinathletics.gym', 'member123');
  assert.ok(devSession);
  assert.deepEqual(readDemoSessionToken(createDemoSessionToken(devSession)), devSession);

  process.env.DEMO_SESSION_SECRET = 'test-only-demo-signing-secret';
  const session = authenticateDemoAccount('trainer@vinathletics.gym', 'trainer123');
  assert.ok(session);
  const token = createDemoSessionToken(session);
  assert.deepEqual(readDemoSessionToken(token), session);
  const [, signature] = token.split('.');
  const alteredToken = `${token.split('.')[0]}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
  assert.equal(readDemoSessionToken(alteredToken), null);
  assert.equal(readDemoSessionToken(createDemoSessionToken({ ...session, expiresAt: 1 })), null);
});

test('demo login is blocked in production and can be disabled elsewhere', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.DEMO_ACCOUNTS_ENABLED;
  assert.equal(isDemoLoginEnabled(), false);
  process.env.NODE_ENV = 'development';
  process.env.DEMO_ACCOUNTS_ENABLED = 'false';
  assert.equal(isDemoLoginEnabled(), false);
  process.env.DEMO_ACCOUNTS_ENABLED = 'true';
  assert.equal(isDemoLoginEnabled(), true);
});
