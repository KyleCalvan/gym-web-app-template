import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { startDatabase, startApplication, runNode, withDatabaseClient } from './harness.mjs';
import { startGoogle } from './google.mjs';

let database;
let application;
let google;
const adminCookie = 'next-auth.session-token=fixture-admin-session-token';
const memberCookie = 'next-auth.session-token=fixture-member-session-token';

before(async () => {
  database = await startDatabase();
  google = await startGoogle();
  Object.assign(database.env, google.env);
  await runNode('scripts/prisma.mjs', ['generate'], database.env);
  await runNode('scripts/prisma.mjs', ['migrate', 'deploy'], database.env);
  const fixture = await readFile(new URL('./fixtures/legacy-account.sql', import.meta.url), 'utf8');
  await withDatabaseClient(database.env, (client) => client.query(fixture));
  database.env.ROLE_ASSIGNMENTS = JSON.stringify({ 'operator@example.test': ['member', 'admin'] });
  await runNode('node_modules/next/dist/bin/next', ['build'], database.env);
  application = await startApplication(database.env);
}, { timeout: 240_000 });

after(async () => {
  await application?.stop();
  await database?.stop();
  await google?.stop();
});

test('first Google callback establishes a durable verified Account without a second login', async () => {
  const signedIn = await google.signIn(application, {
    sub: 'first-google-subject', email: ' First.Member+Gym@Example.test ',
    email_verified: true, name: 'First Member',
  });
  assert.equal(new URL(signedIn.location).href, `${application.url}/`, application.logs());
  const response = await fetch(`${application.url}/api/me`, { headers: { cookie: signedIn.cookie } });
  assert.equal(response.status, 200, application.logs());
  const status = await response.json();
  assert.equal(typeof status.account.id, 'string');
  assert.equal(typeof status.account.gymUserId, 'number');
  assert.equal(status.account.email, 'first.member+gym@example.test');
  assert.equal(status.account.emailVerified, true);
  assert.equal(status.account.status, 'enabled');
  assert.deepEqual(status.nextSteps, ['complete-profile', 'accept-terms']);
  assert.equal(status.restricted, true);
  assert.equal(status.membership, undefined);
  const session = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: signedIn.cookie } }).then((r) => r.json());
  assert.deepEqual(session.user.roles, ['member']);
  assert.equal(session.user.gymUserId, status.account.gymUserId);
  const again = await google.signIn(application, {
    sub: 'first-google-subject', email: 'first.member+gym@example.test', email_verified: true, name: 'First Member',
  });
  assert.equal(new URL(again.location).href, `${application.url}/`, application.logs());
  const persisted = await fetch(`${application.url}/api/me`, { headers: { cookie: again.cookie } }).then((r) => r.json());
  assert.deepEqual(persisted.account, status.account);
  await application.stop();
  application = await startApplication(database.env);
  const reloaded = await fetch(`${application.url}/api/me`, { headers: { cookie: signedIn.cookie } }).then((r) => r.json());
  assert.deepEqual(reloaded, status);
  const page = await fetch(`${application.url}/account`, { headers: { cookie: signedIn.cookie } }).then((r) => r.text());
  assert.match(page, /Next steps/);
  assert.match(page, /Email verified/);
  assert.match(page, /Complete your full name and contact phone/);
  assert.doesNotMatch(page, /Basic Membership|Current Membership/);
});

test('concurrent Google callbacks keep one Account and never merge a different subject by normalized email', async () => {
  const profile = { sub: 'concurrent-subject', email: 'race@example.test', email_verified: true, name: 'Concurrent Member' };
  const callbacks = await Promise.all(Array.from({ length: 4 }, () => google.signIn(application, profile)));
  const statuses = await Promise.all(callbacks.map(async (callback) => {
    assert.equal(new URL(callback.location).href, `${application.url}/`, application.logs());
    return fetch(`${application.url}/api/me`, { headers: { cookie: callback.cookie } }).then((r) => r.json());
  }));
  assert.equal(new Set(statuses.map((status) => status.account.id)).size, 1);
  assert.equal(new Set(statuses.map((status) => status.account.gymUserId)).size, 1);
  const collision = await google.signIn(application, { ...profile, sub: 'different-subject', email: ' RACE@EXAMPLE.TEST ' });
  assert.match(collision.location, /error=AccountConflict&requestId=[a-f0-9-]+/);
  const rejectedSession = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: collision.cookie } }).then((r) => r.json());
  assert.deepEqual(rejectedSession, {});
  const after = await fetch(`${application.url}/api/me`, { headers: { cookie: callbacks[0].cookie } }).then((r) => r.json());
  assert.deepEqual(after, statuses[0]);
  const racingSubjects = await Promise.all(['subject-a', 'subject-b'].map((sub) => google.signIn(application, {
    sub, email: sub === 'subject-a' ? ' Simultaneous@Example.test ' : 'simultaneous@example.test', email_verified: true,
  })));
  assert.equal(racingSubjects.filter((callback) => callback.location.includes('error=AccountConflict')).length, 1);
  assert.equal(racingSubjects.filter((callback) => new URL(callback.location, application.url).pathname === '/').length, 1);
});

test('reviewed role cutover imports existing authority once and runtime environment changes cannot override it', async () => {
  const planFile = path.join(database.directory, 'reviewed-roles.json');
  await runNode('scripts/account-cutover.mjs', ['plan', '--output', planFile], database.env);
  const plan = JSON.parse(await readFile(planFile, 'utf8'));
  assert.deepEqual(plan.issues, []);
  assert.deepEqual(plan.assignments.map(({ accountId, roles }) => ({ accountId, roles })), [
    { accountId: 'fixture-auth-admin', roles: ['member', 'admin'] },
  ]);
  await assert.rejects(runNode('scripts/account-cutover.mjs', ['apply', '--plan', planFile], database.env), /reviewed-by/);
  for (const roleAssignments of ['{broken', '{"operator@example.test":["owner"]}', '{"operator@example.test":["member"]," OPERATOR@EXAMPLE.TEST ":["admin"]}']) {
    await assert.rejects(runNode('scripts/account-cutover.mjs', ['plan', '--output', path.join(database.directory, 'invalid-plan.json')], { ...database.env, ROLE_ASSIGNMENTS: roleAssignments }));
  }
  const before = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: adminCookie } }).then((r) => r.json());
  assert.deepEqual(before.user.roles, []);
  await runNode('scripts/account-cutover.mjs', ['apply', '--plan', planFile, '--reviewed-by', 'fixture-reviewer'], database.env);
  const after = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: adminCookie } }).then((r) => r.json());
  assert.deepEqual(after.user.roles, ['member', 'admin']);
  assert.equal(after.user.restricted, true);
  assert.equal(after.user.id, before.user.id);
  assert.equal(after.user.gymUserId, 41);
  await assert.rejects(runNode('scripts/account-cutover.mjs', ['apply', '--plan', planFile, '--reviewed-by', 'fixture-reviewer'], database.env), /stale/);
  database.env.ROLE_ASSIGNMENTS = JSON.stringify({ 'operator@example.test': ['superadmin'], 'first.member+gym@example.test': ['admin'] });
  database.env.ADMIN_EMAILS = 'race@example.test';
  await application.stop();
  application = await startApplication(database.env);
  const unchanged = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: adminCookie } }).then((r) => r.json());
  assert.deepEqual(unchanged.user.roles, ['member', 'admin']);
});

test('unproven legacy sessions cannot mutate plans and public plans survive a restart', async () => {
  const response = await fetch(`${application.url}/api/gym-plans`);
  assert.equal(response.status, 200, application.logs());
  const catalog = await response.json();
  assert.ok(catalog.plans.length > 0);
  assert.equal(catalog.maxActivePlans, 4);

  const plan = { ...catalog.plans[0], name: 'Isolated persistence check', price: 1337.25 };
  const updated = await fetch(`${application.url}/api/gym-plans`, {
    method: 'PATCH',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'update', originalName: catalog.plans[0].name, plan }),
  });
  assert.equal(updated.status, 403, application.logs());

  await application.stop();
  application = await startApplication(database.env);
  const reloaded = await fetch(`${application.url}/api/gym-plans`);
  assert.equal(reloaded.status, 200);
  assert.deepEqual(await reloaded.json(), catalog);
});

test('Google remains configured and database sessions work through NextAuth HTTP routes', async () => {
  const providers = await fetch(`${application.url}/api/auth/providers`).then((response) => response.json());
  assert.equal(providers.google.type, 'oauth');
  assert.equal(providers.google.callbackUrl, `${application.url}/api/auth/callback/google`);

  const response = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: adminCookie } });
  assert.equal(response.status, 200, application.logs());
  const session = await response.json();
  assert.equal(session.user.id, 'fixture-auth-admin');
  assert.equal(session.user.gymUserId, 41);
  assert.deepEqual(session.user.roles, ['member', 'admin']);
  assert.equal(session.user.restricted, true);

  const memberSession = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: memberCookie } });
  assert.equal((await memberSession.json()).user.id, 'fixture-auth-member');

  const csrfResponse = await fetch(`${application.url}/api/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
  const signout = await fetch(`${application.url}/api/auth/signout`, {
    method: 'POST',
    headers: { cookie: `${memberCookie}; ${csrfCookies}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, callbackUrl: application.url, json: 'true' }),
  });
  assert.equal(signout.status, 200, application.logs());
  assert.equal((await signout.json()).url, application.url);
  const revoked = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: memberCookie } });
  assert.deepEqual(await revoked.json(), {});
});

test('existing Google mappings survive while email-only claims and automatic provider additions are rejected', async () => {
  const existing = await google.signIn(application, {
    sub: 'fixture-google-subject', email: ' OPERATOR@EXAMPLE.TEST ', email_verified: true, name: 'Changed provider name',
  }, adminCookie);
  assert.equal(new URL(existing.location).href, `${application.url}/`, application.logs());
  const before = await fetch(`${application.url}/api/me`, { headers: { cookie: existing.cookie } }).then((r) => r.json());
  assert.equal(before.account.id, 'fixture-auth-admin');
  assert.equal(before.account.gymUserId, 41);
  assert.equal(before.account.name, 'Fixture Operator');
  assert.equal(before.account.emailVerified, true);
  const differentSubject = await google.signIn(application, {
    sub: 'unlinked-operator-subject', email: 'operator@example.test', email_verified: true,
  });
  assert.match(differentSubject.location, /error=AccountConflict/);
  // A gym record without an online identity is not automatically claimable.
  await withDatabaseClient(database.env, (client) => client.query(`INSERT INTO "User" ("email", "name") VALUES ('unclaimed@example.test', 'Existing gym record')`));
  const unclaimed = await google.signIn(application, { sub: 'unclaimed-subject', email: 'unclaimed@example.test', email_verified: true });
  assert.match(unclaimed.location, /error=AccountConflict/);
  const newProfile = { sub: 'new-method-subject', email: 'new-method@example.test', email_verified: true };
  const addition = await google.signIn(application, newProfile, existing.cookie);
  assert.match(addition.location, /error=AccessDenied/);
  const separate = await google.signIn(application, newProfile);
  assert.equal(new URL(separate.location).href, `${application.url}/`, application.logs());
  const separateStatus = await fetch(`${application.url}/api/me?accountId=fixture-auth-admin`, { headers: { cookie: separate.cookie } }).then((r) => r.json());
  assert.notEqual(separateStatus.account.id, before.account.id);
  assert.notEqual(separateStatus.account.gymUserId, before.account.gymUserId);
  const after = await fetch(`${application.url}/api/me`, { headers: { cookie: existing.cookie } }).then((r) => r.json());
  assert.deepEqual(after, before);
});

test('a failed audit write rolls back Account creation and leaves the address available for a clean signup', async () => {
  await withDatabaseClient(database.env, (client) => client.query(`
    CREATE FUNCTION "rejectFixtureAccountAudit"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW."action" = 'account.created' THEN RAISE EXCEPTION 'Fixture audit unavailable'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER "fixture_audit_failure" BEFORE INSERT ON "AuditEvent"
      FOR EACH ROW EXECUTE FUNCTION "rejectFixtureAccountAudit"();
  `));
  try {
    const failed = await google.signIn(application, { sub: 'rolled-back-subject', email: 'rollback@example.test', email_verified: true });
    assert.match(failed.location, /error=AccessDenied/);
    const unavailable = await fetch(`${application.url}/api/me`, { headers: { cookie: failed.cookie } });
    assert.equal(unavailable.status, 401);
  } finally {
    await withDatabaseClient(database.env, (client) => client.query(`DROP TRIGGER "fixture_audit_failure" ON "AuditEvent"; DROP FUNCTION "rejectFixtureAccountAudit"()`));
  }
  const retry = await google.signIn(application, { sub: 'clean-signup-subject', email: ' ROLLBACK@example.test ', email_verified: true });
  assert.equal(new URL(retry.location).href, `${application.url}/`, application.logs());
  const status = await fetch(`${application.url}/api/me`, { headers: { cookie: retry.cookie } }).then((r) => r.json());
  assert.equal(status.account.emailVerified, true);
  assert.equal(status.account.email, 'rollback@example.test');
});

test('revoked database roles stay revoked after login and disabling an Account invalidates every browser session', async () => {
  const profile = { sub: 'revocation-subject', email: 'revocation@example.test', email_verified: true };
  const first = await google.signIn(application, profile);
  const original = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: first.cookie } }).then((r) => r.json());
  assert.deepEqual(original.user.roles, ['member']);
  await withDatabaseClient(database.env, (client) => client.query('DELETE FROM "AssignedRole" WHERE "accountId" = $1', [original.user.id]));
  const second = await google.signIn(application, profile);
  const revoked = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: second.cookie } }).then((r) => r.json());
  assert.deepEqual(revoked.user.roles, []);
  assert.equal(revoked.user.restricted, true);
  await withDatabaseClient(database.env, (client) => client.query('UPDATE "AuthUser" SET "status" = $1 WHERE "id" = $2', ['disabled', original.user.id]));
  for (const cookie of [first.cookie, second.cookie]) {
    assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 401);
  }
  const denied = await google.signIn(application, profile);
  assert.match(denied.location, /error=AccessDenied/);
  await withDatabaseClient(database.env, (client) => client.query('UPDATE "AuthUser" SET "status" = $1 WHERE "id" = $2', ['enabled', original.user.id]));
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: first.cookie } })).status, 401);
  const fresh = await google.signIn(application, profile);
  assert.equal(new URL(fresh.location).href, `${application.url}/`, application.logs());
  const enabled = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: fresh.cookie } }).then((r) => r.json());
  assert.deepEqual(enabled.user.roles, []);
  assert.equal(enabled.user.id, original.user.id);
});

test('unverified Google email grants nothing, while dot/plus addresses and a known identity missing its gym link remain distinct', async () => {
  const unverified = await google.signIn(application, { sub: 'unverified-subject', email: 'dot.name+gym@example.test', email_verified: false });
  assert.match(unverified.location, /error=AccessDenied/);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: unverified.cookie } })).status, 401);
  const signedIn = await google.signIn(application, { sub: 'verified-after-rejection', email: 'dot.name+gym@example.test', email_verified: true });
  const distinct = await google.signIn(application, { sub: 'distinct-dot-subject', email: 'dotname@example.test', email_verified: true });
  const status = await fetch(`${application.url}/api/me`, { headers: { cookie: signedIn.cookie } }).then((r) => r.json());
  const other = await fetch(`${application.url}/api/me`, { headers: { cookie: distinct.cookie } }).then((r) => r.json());
  assert.notEqual(status.account.id, other.account.id);
  assert.equal(status.account.email, 'dot.name+gym@example.test');
  await withDatabaseClient(database.env, async (client) => {
    await client.query(`INSERT INTO "AuthUser" ("id", "email") VALUES ('legacy-missing-link', 'missing-link@example.test')`);
    await client.query(`INSERT INTO "AuthAccount" ("id", "userId", "type", "provider", "providerAccountId")
      VALUES ('legacy-missing-provider-link', 'legacy-missing-link', 'oauth', 'google', 'missing-link-subject')`);
  });
  const repaired = await google.signIn(application, { sub: 'missing-link-subject', email: 'missing-link@example.test', email_verified: true });
  assert.equal(new URL(repaired.location).href, `${application.url}/`, application.logs());
  const linked = await fetch(`${application.url}/api/me`, { headers: { cookie: repaired.cookie } }).then((r) => r.json());
  assert.equal(linked.account.id, 'legacy-missing-link');
  assert.equal(typeof linked.account.gymUserId, 'number');
  assert.equal(linked.account.emailVerified, true);
});

test('limited status, client session updates, and enabled preview demos cannot confer business authority', async () => {
  const unauthenticated = await fetch(`${application.url}/api/me?accountId=fixture-auth-admin`);
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).requestId, unauthenticated.headers.get('x-request-id'));
  const signedIn = await google.signIn(application, { sub: 'limited-subject', email: 'limited@example.test', email_verified: true });
  const statusResponse = await fetch(`${application.url}/api/me?accountId=fixture-auth-admin`, { headers: { cookie: signedIn.cookie } });
  assert.match(statusResponse.headers.get('cache-control'), /no-store/);
  const limited = await statusResponse.json();
  assert.notEqual(limited.account.id, 'fixture-auth-admin');
  assert.equal(limited.roles, undefined);
  assert.equal(limited.profiles, undefined);
  assert.equal(limited.account.emailVerifiedSubject, undefined);
  const csrf = await fetch(`${application.url}/api/auth/csrf`);
  const { csrfToken } = await csrf.json();
  const cookie = `${signedIn.cookie}; ${csrf.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')}`;
  const update = await fetch(`${application.url}/api/auth/session`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ csrfToken, data: { user: { roles: ['superadmin'], role: 'superadmin', restricted: false, gymUserId: 41 } } }),
  });
  const session = await update.json();
  assert.deepEqual(session.user.roles, ['member']);
  assert.equal(session.user.restricted, true);
  assert.notEqual(session.user.gymUserId, 41);
  const mutation = await fetch(`${application.url}/api/gym-plans`, {
    method: 'PATCH', headers: { cookie: signedIn.cookie, 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(mutation.status, 403);
  const preview = await startApplication({ ...database.env, VERCEL_ENV: 'preview', DEMO_ACCOUNTS_ENABLED: 'true' });
  try {
    const login = await fetch(`${preview.url}/api/demo-session`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vinathletics.gym', password: 'admin123' }),
    });
    assert.equal(login.status, 200, preview.logs());
    const demoCookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    assert.equal((await fetch(`${preview.url}/api/me`, { headers: { cookie: demoCookie } })).status, 401);
    const demoMutation = await fetch(`${preview.url}/api/gym-plans`, {
      method: 'PATCH', headers: { cookie: demoCookie, 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(demoMutation.status, 401);
  } finally { await preview.stop(); }
});

test('fresh migrations match the schema and can be deployed again without changes', async () => {
  await runNode('scripts/prisma.mjs', ['validate'], database.env);
  await runNode('scripts/prisma.mjs', ['migrate', 'deploy'], database.env);
  await runNode('scripts/prisma.mjs', ['migrate', 'status'], database.env);
  await assertNoSchemaDrift(database.env);
});

test('upgrading preserves gym and Google records and serves real routes in a custom schema', async () => {
  await withDatabaseClient(database.env, (client) => client.query('CREATE DATABASE vinathletics_upgrade'));
  const url = new URL(database.env.DATABASE_URL);
  url.pathname = '/vinathletics_upgrade';
  url.searchParams.set('schema', 'upgrade_fixture');
  const env = { ...database.env, DATABASE_URL: url.href };

  // Deploy the historical prefix with Prisma's real migration ledger, rather
  // than stamping a baseline or manufacturing _prisma_migrations rows.
  const fixtureDirectory = path.join(database.directory, 'upgrade');
  const historicalMigrations = [
    '20261007023716_init',
    '20261017150000_authjs_google',
  ];
  for (const migration of historicalMigrations) {
    const target = path.join(fixtureDirectory, 'migrations', migration);
    await mkdir(target, { recursive: true });
    await copyFile(new URL(`../../backend/prisma/migrations/${migration}/migration.sql`, import.meta.url), path.join(target, 'migration.sql'));
  }
  await copyFile(new URL('../../backend/prisma/migrations/migration_lock.toml', import.meta.url), path.join(fixtureDirectory, 'migrations/migration_lock.toml'));
  const fixtureSchema = path.join(fixtureDirectory, 'schema.prisma');
  await copyFile(new URL('../../backend/prisma/schema.prisma', import.meta.url), fixtureSchema);
  await runNode('node_modules/prisma/build/index.js', ['migrate', 'deploy', `--schema=${fixtureSchema}`], env);
  const fixture = await readFile(new URL('./fixtures/legacy-account.sql', import.meta.url), 'utf8');
  await withDatabaseClient(env, (client) => client.query(fixture));
  await withDatabaseClient(env, async (client) => {
    await client.query('UPDATE "User" SET "email" = $1 WHERE "id" = 42', [' Member@Example.test\t\u00a0']);
    await client.query('UPDATE "AuthUser" SET "email" = $1 WHERE "id" = $2', [' Member@Example.test\t\u00a0', 'fixture-auth-member']);
  });
  const original = await readLegacyRecords(env);
  original[0].find((record) => record.id === 42).email = 'member@example.test';
  original[2].find((record) => record.id === 'fixture-auth-member').email = 'member@example.test';

  await withDatabaseClient(env, (client) => client.query(`INSERT INTO "User" ("id", "email") VALUES (999, ' OPERATOR@EXAMPLE.TEST ')`));
  const collisionState = await readLegacyRecords(env);
  const collisionReportFile = path.join(database.directory, 'collisions.json');
  await assert.rejects(runNode('scripts/account-cutover.mjs', ['plan', '--output', collisionReportFile], {
    ...env, ROLE_ASSIGNMENTS: '{}', ADMIN_EMAILS: '',
  }));
  const collisionReport = JSON.parse(await readFile(collisionReportFile, 'utf8'));
  assert.ok(collisionReport.issues.some((issue) => issue.kind === 'normalized-email-collision' && issue.ids.includes(41) && issue.ids.includes(999)));
  await assert.rejects(runNode('scripts/prisma.mjs', ['migrate', 'deploy'], env), /Normalized email collisions require explicit resolution/);
  assert.deepEqual(await readLegacyRecords(env), collisionState);
  // Correct only the deliberately conflicting fixture, then use Prisma's
  // supported failed-migration recovery instead of editing its ledger.
  await withDatabaseClient(env, (client) => client.query('DELETE FROM "User" WHERE "id" = 999'));
  await runNode('scripts/prisma.mjs', ['migrate', 'resolve', '--rolled-back', '20261021120000_canonical_account'], env);

  await runNode('scripts/prisma.mjs', ['migrate', 'deploy'], env);
  assert.deepEqual(await readLegacyRecords(env), original);
  await runNode('scripts/prisma.mjs', ['migrate', 'status'], env);
  await assertNoSchemaDrift(env);

  const upgraded = await startApplication(env);
  try {
    const session = await fetch(`${upgraded.url}/api/auth/session`, { headers: { cookie: adminCookie } });
    assert.equal(session.status, 200, upgraded.logs());
    const identity = await session.json();
    assert.equal(identity.user.id, 'fixture-auth-admin');
    assert.equal(identity.user.gymUserId, 41);
    assert.equal(identity.user.restricted, true);
    const plans = await fetch(`${upgraded.url}/api/gym-plans`);
    assert.equal(plans.status, 200, upgraded.logs());
    assert.ok((await plans.json()).plans.length > 0);
  } finally {
    await upgraded.stop();
  }
});

async function assertNoSchemaDrift(env) {
  await runNode('node_modules/prisma/build/index.js', [
    'migrate', 'diff', `--from-url=${env.DATABASE_URL}`,
    '--to-schema-datamodel=backend/prisma/schema.prisma', '--exit-code',
  ], env);
}

async function readLegacyRecords(env) {
  return withDatabaseClient(env, async (client) => {
    const records = [];
    for (const table of ['User', 'Post', 'AuthUser', 'AuthAccount', 'AuthSession']) {
      const columns = table === 'AuthUser' ? '"id", "email", "name", "emailVerified", "image", "gymUserId"' : '*';
      records.push((await client.query(`SELECT ${columns} FROM "${table}" ORDER BY "id"`)).rows);
    }
    return records;
  });
}
