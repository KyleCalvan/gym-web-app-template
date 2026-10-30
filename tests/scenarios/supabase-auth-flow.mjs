import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import nextEnv from '@next/env';
import { startDatabase, startApplication, runNode, withDatabaseClient } from '../integration/harness.mjs';
import { startSmtp } from '../integration/smtp.mjs';

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && publishableKey && secretKey, 'Supabase Auth keys are required');
const email = `codex-flow-${randomBytes(8).toString('hex')}@example.com`;
const password = randomBytes(24).toString('base64url');
let database, smtp, app;
const supabaseIds = [];
try {
  database = await startDatabase();
  smtp = await startSmtp();
  Object.assign(database.env, smtp.env, { NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publishableKey, SUPABASE_SERVICE_ROLE_KEY: secretKey });
  await runNode('scripts/prisma.mjs', ['migrate', 'deploy'], database.env);
  await runNode('node_modules/next/dist/bin/next', ['build'], database.env);
  app = await startApplication(database.env);
  const provider = await fetch(`${app.url}/api/supabase/google/status`).then((response) => response.json());
  assert.equal(typeof provider.google, 'boolean');
  const oauthStart = await fetch(`${app.url}/api/supabase/google`, { redirect: 'manual' });
  assert.equal(oauthStart.status, 307);
  assert.equal(new URL(oauthStart.headers.get('location')).origin, new URL(url).origin);
  assert.ok(oauthStart.headers.getSetCookie().some((cookie) => cookie.includes('code-verifier')));
  const register = await fetch(`${app.url}/api/register`, { method: 'POST',
    headers: { origin: app.url, 'content-type': 'application/json' },
    body: JSON.stringify({ firstName: 'Temporary', middleName: '', lastName: 'Check', suffix: '',
      email, phone: '09123456789', password, termsAccepted: true, termsVersion: '2026-10-21' }) });
  assert.equal(register.status, 201, `${await register.text()}\n${app.logs()}`);
  const users = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` },
  }).then((response) => response.json());
  const supabaseId = users.users.find((user) => user.email === email)?.id;
  assert.ok(supabaseId, 'Registration created a Supabase Auth user');
  supabaseIds.push(supabaseId);
  const stored = await withDatabaseClient(database.env, (client) => client.query(`SELECT
    a."passwordHash", r.role::text AS role FROM "AuthUser" a
    JOIN "AssignedRole" r ON r."accountId" = a.id WHERE a.email = $1`, [email]));
  assert.deepEqual(stored.rows, [{ passwordHash: null, role: 'member' }]);
  const login = () => fetch(`${app.url}/api/password-login`, { method: 'POST',
    headers: { origin: app.url, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal((await login()).status, 401, 'Unverified Supabase user cannot sign in');
  const message = smtp.messages.at(-1)?.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  const link = message?.match(/http:\/\/127\.0\.0\.1:\d+\/api\/verify-email\?token=[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(link, 'Verification email contains the app link');
  assert.equal((await fetch(link, { redirect: 'manual' })).status, 307);
  assert.equal((await login()).status, 200, 'Verified Supabase user can sign in');
  console.log('Supabase registration, verification, password login, and role link passed.');

  const staffEmail = `codex-staff-${randomBytes(8).toString('hex')}@example.com`;
  const staffPassword = randomBytes(24).toString('base64url');
  const accountId = randomUUID(), profileId = randomUUID();
  const salt = randomBytes(16);
  const hash = `scrypt:16384:8:1:${salt.toString('base64url')}:${scryptSync(staffPassword, salt, 64,
    { N: 16384, r: 8, p: 1 }).toString('base64url')}`;
  await withDatabaseClient(database.env, async (client) => {
    const gym = await client.query('INSERT INTO "User" (email, name) VALUES ($1, $2) RETURNING id', [staffEmail, 'Temporary Staff']);
    await client.query(`INSERT INTO "AuthUser" (id,email,name,"gymUserId","establishedAt","emailVerified","emailVerifiedProvider",phone,"termsVersion","termsAcceptedAt","passwordHash")
      VALUES ($1,$2,'Temporary Staff',$3,NOW(),NOW(),'password-registration','09123456789','2026-10-21',NOW(),$4)`,
    [accountId, staffEmail, gym.rows[0].id, hash]);
    await client.query('INSERT INTO "RoleProfile" (id,"gymUserId",role) VALUES ($1,$2,$3)', [profileId, gym.rows[0].id, 'staff']);
    await client.query('INSERT INTO "AssignedRole" ("accountId",role,"profileId") VALUES ($1,$2,$3)', [accountId, 'staff', profileId]);
    await client.query('INSERT INTO "StaffProfile" ("profileId") VALUES ($1)', [profileId]);
  });
  const placeholder = await fetch(`${url}/auth/v1/admin/users`, { method: 'POST',
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: staffEmail, password: randomBytes(24).toString('base64url'),
      email_confirm: true, app_metadata: { app_account_id: accountId, migration_password_pending: true } }) });
  assert.equal(placeholder.status, 200, 'Temporary staff Auth identity created');
  supabaseIds.push((await placeholder.json()).id);
  const staffLogin = await fetch(`${app.url}/api/password-login`, { method: 'POST',
    headers: { origin: app.url, 'content-type': 'application/json' },
    body: JSON.stringify({ email: staffEmail, password: staffPassword }) });
  assert.equal(staffLogin.status, 200, `${await staffLogin.text()}\n${app.logs()}`);
  const staffRow = await withDatabaseClient(database.env, (client) => client.query(
    'SELECT "passwordHash" FROM "AuthUser" WHERE id=$1', [accountId]));
  assert.equal(staffRow.rows[0].passwordHash, null);
  const supabaseLogin = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST',
    headers: { apikey: publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: staffEmail, password: staffPassword }) });
  assert.equal(supabaseLogin.status, 200, 'Legacy staff password migrated into Supabase Auth');
  console.log('Existing staff password migration into Supabase Auth passed.');
} finally {
  await app?.stop();
  await database?.stop();
  await smtp?.stop();
  for (const id of supabaseIds) {
    const deleted = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: 'DELETE',
      headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` } });
    assert.equal(deleted.ok, true, 'Temporary Supabase Auth user was removed');
  }
}
