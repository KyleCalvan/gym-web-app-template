import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { copyFile, mkdir, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { startDatabase, startApplication, runNode, withDatabaseClient } from './harness.mjs';
import { startGoogle } from './google.mjs';
import { startSmtp } from './smtp.mjs';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';

let database;
let application;
let google;
let smtp;

test('plan mutations reject missing sessions with a structured request-correlated error', async () => {
  const response = await fetch(`${application.url}/api/gym-plans`, {
    method: 'POST', headers: { origin: application.url, 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 401);
  const error = await response.json();
  assert.equal(error.code, 'UNAUTHENTICATED');
  assert.equal(typeof error.message, 'string');
  assert.equal(error.requestId, response.headers.get('x-request-id'));
});
const adminCookie = 'next-auth.session-token=fixture-admin-session-token';
const memberCookie = 'next-auth.session-token=fixture-member-session-token';

test('logout reports revocation storage failure and preserves the usable cookie for retry', async () => {
  const signedIn = await google.signIn(application, { sub: 'logout-failure-subject', email: 'logout-failure@example.test', email_verified: true });
  const csrf = await fetch(`${application.url}/api/auth/csrf`);
  const { csrfToken } = await csrf.json();
  const cookie = `${signedIn.cookie}; ${responseCookieHeader(csrf)}`;
  await withDatabaseClient(database.env, (client) => client.query(`
    CREATE FUNCTION fail_revocation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action = 'session.revoked' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_revocation BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION fail_revocation_audit();
  `));
  try {
    const response = await fetch(`${application.url}/api/auth/signout`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, callbackUrl: application.url, json: 'true' }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'UNAVAILABLE');
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: signedIn.cookie } })).status, 200);
  } finally {
    await withDatabaseClient(database.env, (client) => client.query('DROP TRIGGER fail_revocation ON "AuditEvent"; DROP FUNCTION fail_revocation_audit()'));
  }
  const retried = await fetch(`${application.url}/api/auth/signout`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, callbackUrl: application.url, json: 'true' }),
  });
  assert.equal(retried.status, 200);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: signedIn.cookie } })).status, 401);
});

before(async () => {
  database = await startDatabase();
  google = await startGoogle();
  Object.assign(database.env, google.env);
  smtp = await startSmtp();
  Object.assign(database.env, smtp.env);
  database.env.INTEGRATION_CLOCK_FILE = path.join(database.directory, 'clock');
  database.env.INTEGRATION_SESSION_KEY = 'isolated-session-test-driver';
  await writeFile(database.env.INTEGRATION_CLOCK_FILE, '');
  const clockModule = new URL('./clock.cjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  database.env.NODE_OPTIONS += ` --require="${decodeURIComponent(clockModule)}"`;
  // Use the existing generated client for this isolated run while Windows holds its DLL open.
  await runNode('scripts/prisma.mjs', ['migrate', 'deploy'], database.env);
  const fixture = await readFile(new URL('./fixtures/legacy-account.sql', import.meta.url), 'utf8');
  await withDatabaseClient(database.env, (client) => client.query(fixture));
  database.env.ROLE_ASSIGNMENTS = JSON.stringify({ 'operator@example.test': ['member', 'admin'] });
  const fixtureDirectory = new URL('../../app/api/integration-session-fixture/', import.meta.url);
  const fixtureRoute = new URL('route.ts', fixtureDirectory);
  await mkdir(fixtureDirectory);
  try {
    await copyFile(new URL('./fixtures/session-route.ts', import.meta.url), fixtureRoute);
    await runNode('node_modules/next/dist/bin/next', ['build'], database.env);
  } finally {
    await unlink(fixtureRoute);
    await rmdir(fixtureDirectory);
  }
  application = await startApplication(database.env);
}, { timeout: 240_000 });

after(async () => {
  await application?.stop();
  await database?.stop();
  await google?.stop();
  await smtp?.stop();
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
  assert.match(page, /Save profile/);
  assert.match(page.replaceAll('<!-- -->', ''), /Terms of Use, version 2026-10-21/);
  assert.doesNotMatch(page, /Basic Membership|Current Membership/);
});

test('Google Account holder completes profile and explicitly accepts current terms through HTTP', async () => {
  const signedIn = await google.signIn(application, {
    sub: 'onboarding-subject', email: 'onboarding@example.test', email_verified: true, name: 'Google Name',
  });
  const request = (route, method, body, cookie = signedIn.cookie) => fetch(`${application.url}${route}`, {
    method, headers: { cookie, origin: application.url, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await request('/api/me', 'PATCH', { name: 'A', phone: '09123456789' })).status, 400);
  assert.equal((await request('/api/me', 'PATCH', { name: 'Real Member', phone: '09123456789', email: 'forged@example.test' })).status, 400);
  const profile = await request('/api/me', 'PATCH', { name: '  Real Member  ', phone: ' 09123456789 ' });
  assert.equal(profile.status, 200, application.logs());
  const afterProfile = await profile.json();
  assert.equal(afterProfile.account.name, 'Real Member');
  assert.equal(afterProfile.account.phone, '09123456789');
  assert.equal(afterProfile.account.email, 'onboarding@example.test');
  assert.deepEqual(afterProfile.nextSteps, ['accept-terms']);
  assert.equal(afterProfile.roles, undefined);
  assert.equal((await request('/api/me/terms', 'POST', { version: 'old', accepted: true })).status, 409);
  assert.equal((await request('/api/me/terms', 'POST', { version: '2026-10-21', accepted: false })).status, 400);
  const accepted = await request('/api/me/terms', 'POST', { version: '2026-10-21', accepted: true });
  assert.equal(accepted.status, 200, application.logs());
  const ready = await accepted.json();
  assert.equal(ready.restricted, false);
  assert.deepEqual(ready.roles, ['member']);
  assert.equal(ready.profiles.length, 1);
  assert.equal(ready.account.termsVersion, '2026-10-21');
  assert.ok(Date.parse(ready.account.termsAcceptedAt));
  assert.equal(ready.membership, undefined);
  const reloaded = await fetch(`${application.url}/api/me`, { headers: { cookie: signedIn.cookie } }).then((r) => r.json());
  assert.deepEqual(reloaded, ready);
  const pageResponse = await fetch(`${application.url}/account`, { headers: { cookie: signedIn.cookie } });
  assert.equal(pageResponse.status, 200, application.logs());
  const page = await pageResponse.text();
  assert.match(page, /class="app-shell"/);
  assert.match(page, /Membership Plans/);
  assert.match(page, /Coaching Sessions/);
  assert.match(page, /Loading your member dashboard/);
  const overview = await fetch(`${application.url}/api/member/overview`, { headers: { cookie: signedIn.cookie } });
  assert.equal(overview.status, 200);
  assert.equal((await overview.json()).membership, null);
  assert.doesNotMatch(page, /Maria Santos|Basic Membership|Premium Membership/);
});

test('checkout rejects another plan while the member has an active membership', async () => {
  const accountId = await seedSessionAccount();
  const { cookie } = await issueSession(accountId);
  const firstPlan = `Current-${randomUUID()}`;
  const otherPlan = `Other-${randomUUID()}`;
  await withDatabaseClient(database.env, async (client) => {
    const { rows: [assignment] } = await client.query(
      'SELECT "profileId" FROM "AssignedRole" WHERE "accountId" = $1 AND "role" = $2',
      [accountId, 'member'],
    );
    await client.query('INSERT INTO "MemberProfile" ("profileId") VALUES ($1)', [assignment.profileId]);
    await client.query('INSERT INTO "GymPlan" (name, price, period, "updatedAt") VALUES ($1, 1000, $3, NOW()), ($2, 1500, $3, NOW())',
      [firstPlan, otherPlan, 'month']);
    await client.query(`INSERT INTO "Membership" (id, "memberId", "planName", status, "startsAt", "endsAt", "updatedAt")
      VALUES ($1, $2, $3, 'Active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 month', NOW())`,
    [randomUUID(), assignment.profileId, firstPlan]);
  });
  const response = await fetch(`${application.url}/api/member/checkout`, {
    method: 'POST',
    headers: { cookie, origin: application.url, 'content-type': 'application/json' },
    body: JSON.stringify({ planName: otherPlan }),
  });
  assert.equal(response.status, 409, application.logs());
  assert.match((await response.json()).error, /already have an active plan/);
});

test('member activity reads only personal records and persists metrics and one daily check-in', async () => {
  const accountId = await seedSessionAccount();
  const otherAccountId = await seedSessionAccount();
  const { cookie } = await issueSession(accountId);
  const planName = `Activity-${randomUUID()}`;
  const { memberId, otherMemberId, pastSessionId, futureSessionId } = await withDatabaseClient(database.env, async (client) => {
    const { rows } = await client.query('SELECT "accountId", "profileId" FROM "AssignedRole" WHERE "accountId" IN ($1, $2) AND role = $3',
      [accountId, otherAccountId, 'member']);
    const memberId = rows.find(row => row.accountId === accountId).profileId;
    const otherMemberId = rows.find(row => row.accountId === otherAccountId).profileId;
    await client.query('INSERT INTO "MemberProfile" ("profileId", "weightKg", "heightCm") VALUES ($1, 72.5, 171), ($2, 80, 180)',
      [memberId, otherMemberId]);
    await client.query('INSERT INTO "GymPlan" (name, price, period, "updatedAt") VALUES ($1, 1000, $2, NOW())', [planName, 'month']);
    await client.query(`INSERT INTO "Membership" (id, "memberId", "planName", status, "startsAt", "endsAt", "updatedAt")
      VALUES ($1, $2, $3, 'Active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 month', NOW())`,
    [randomUUID(), memberId, planName]);
    await client.query('INSERT INTO "Attendance" (id, "memberId", "visitDate") VALUES ($1, $2, $3)',
      [randomUUID(), otherMemberId, '2026-01-01']);
    const trainerId = randomUUID();
    const { rows: [trainer] } = await client.query('INSERT INTO "User" (email, name) VALUES ($1, $2) RETURNING id',
      [`${trainerId}@example.test`, 'Activity Trainer']);
    await client.query('INSERT INTO "RoleProfile" (id, "gymUserId", role) VALUES ($1, $2, $3)', [trainerId, trainer.id, 'trainer']);
    await client.query('INSERT INTO "TrainerProfile" ("profileId") VALUES ($1)', [trainerId]);
    const pastSessionId = randomUUID();
    const futureSessionId = randomUUID();
    await client.query(`INSERT INTO "CoachingSession" (id, "memberId", "trainerId", "startsAt", status, amount, "updatedAt")
      VALUES ($1, $4, $3, NOW() - INTERVAL '2 days', 'Completed', 500, NOW()),
             ($2, $4, $3, NOW() + INTERVAL '2 days', 'Confirmed', 500, NOW()),
             ($5, $6, $3, NOW() + INTERVAL '3 days', 'Confirmed', 500, NOW())`,
    [pastSessionId, futureSessionId, trainerId, memberId, randomUUID(), otherMemberId]);
    return { memberId, otherMemberId, pastSessionId, futureSessionId };
  });
  const endpoint = `${application.url}/api/member/activity`;
  const headers = { cookie, origin: application.url, 'content-type': 'application/json' };
  assert.equal((await fetch(endpoint)).status, 401);
  const initial = await fetch(endpoint, { headers: { cookie } });
  assert.equal(initial.status, 200, application.logs());
  const before = await initial.json();
  assert.equal(before.weightKg, 72.5);
  assert.equal(before.heightCm, 171);
  assert.equal(before.canCheckIn, true);
  assert.deepEqual(before.checkInHistory, []);
  assert.deepEqual(before.sessions.map(session => session.id).sort(), [pastSessionId, futureSessionId].sort());
  assert.ok(before.sessions.every(session => session.trainer === 'Activity Trainer'));
  assert.equal((await fetch(endpoint, { method: 'PATCH', headers: { ...headers, origin: 'https://attacker.example' },
    body: JSON.stringify({ weightKg: 73, heightCm: 172 }) })).status, 403);
  assert.equal((await fetch(endpoint, { method: 'PATCH', headers, body: JSON.stringify({ weightKg: 0, heightCm: 172 }) })).status, 400);
  const updated = await fetch(endpoint, { method: 'PATCH', headers, body: JSON.stringify({ weightKg: 73.2, heightCm: 172 }) });
  assert.equal(updated.status, 200, application.logs());
  assert.deepEqual(await updated.json(), { weightKg: 73.2, heightCm: 172 });
  const checked = await fetch(endpoint, { method: 'POST', headers });
  assert.equal(checked.status, 201, application.logs());
  const { checkIn } = await checked.json();
  assert.equal(checkIn.memberId, memberId);
  assert.match(checkIn.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal((await fetch(endpoint, { method: 'POST', headers })).status, 409);
  const reloaded = await fetch(endpoint, { headers: { cookie } }).then(response => response.json());
  assert.equal(reloaded.weightKg, 73.2);
  assert.equal(reloaded.heightCm, 172);
  assert.deepEqual(reloaded.checkInHistory, [checkIn]);
  const other = await withDatabaseClient(database.env, client => client.query(
    'SELECT "weightKg", "heightCm", COUNT(a.id)::int AS visits FROM "MemberProfile" m LEFT JOIN "Attendance" a ON a."memberId" = m."profileId" WHERE m."profileId" = $1 GROUP BY m."profileId"',
    [otherMemberId]));
  assert.equal(Number(other.rows[0].weightKg), 80);
  assert.equal(other.rows[0].visits, 1);
});

test('member cancellation saves only the signed-in member’s plan and appears in their overview', async () => {
  const accountId = await seedSessionAccount();
  const otherAccountId = await seedSessionAccount();
  const { cookie } = await issueSession(accountId);
  const planName = `Cancel-${randomUUID()}`;
  const membershipIds = [randomUUID(), randomUUID()];
  const profiles = await withDatabaseClient(database.env, async (client) => {
    const { rows } = await client.query(
      'SELECT "accountId", "profileId" FROM "AssignedRole" WHERE "accountId" IN ($1, $2) AND role = $3',
      [accountId, otherAccountId, 'member'],
    );
    await client.query('INSERT INTO "GymPlan" (name, price, period, "updatedAt") VALUES ($1, 1000, $2, NOW())',
      [planName, 'month']);
    for (const [index, account] of [accountId, otherAccountId].entries()) {
      const profileId = rows.find(row => row.accountId === account).profileId;
      await client.query('INSERT INTO "MemberProfile" ("profileId") VALUES ($1)', [profileId]);
      await client.query(`INSERT INTO "Membership" (id, "memberId", "planName", status, "startsAt", "endsAt", "updatedAt")
        VALUES ($1, $2, $3, 'Active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 month', NOW())`,
      [membershipIds[index], profileId, planName]);
    }
    return rows;
  });
  const cancel = (headers = { cookie, origin: application.url, 'content-type': 'application/json' }, reason = ' Moving away ') =>
    fetch(`${application.url}/api/member/membership/cancel`, {
      method: 'POST', headers, body: JSON.stringify({ reason }),
    });
  assert.equal((await cancel({ origin: application.url, 'content-type': 'application/json' })).status, 401);
  assert.equal((await cancel({ cookie, origin: 'https://attacker.example', 'content-type': 'application/json' })).status, 403);
  assert.equal((await cancel(undefined, 'x'.repeat(501))).status, 400);
  const response = await cancel();
  assert.equal(response.status, 200, application.logs());
  const { membership } = await response.json();
  assert.equal(membership.planName, planName);
  assert.equal(membership.status, 'Active');
  assert.equal(membership.cancellationScheduled, true);
  const overview = await fetch(`${application.url}/api/member/overview`, { headers: { cookie } });
  assert.equal(overview.status, 200, application.logs());
  assert.equal((await overview.json()).membership.cancellationScheduled, true);
  assert.equal((await cancel()).status, 409);
  const checkout = await fetch(`${application.url}/api/member/checkout`, {
    method: 'POST', headers: { cookie, origin: application.url, 'content-type': 'application/json' },
    body: JSON.stringify({ planName }),
  });
  assert.equal(checkout.status, 409);
  const persisted = await withDatabaseClient(database.env, async (client) => {
    const { rows } = await client.query('SELECT id, status, "cancelledAt", "cancellationReason", "endsAt" FROM "Membership" WHERE id IN ($1, $2) ORDER BY id', membershipIds);
    return rows;
  });
  const own = persisted.find(row => row.id === membershipIds[0]);
  const other = persisted.find(row => row.id === membershipIds[1]);
  assert.equal(own.cancellationReason, 'Moving away');
  assert.ok(own.cancelledAt instanceof Date);
  assert.ok(Math.abs(own.cancelledAt.getTime() - Date.now()) < 10_000);
  assert.equal(own.status, 'Active');
  assert.ok(own.endsAt > own.cancelledAt);
  assert.equal(other.cancelledAt, null);
  assert.equal(profiles.length, 2);
});

test('mandatory terms renewal keeps every other Account gate in force', async () => {
  const accountId = await seedSessionAccount();
  const { cookie } = await issueSession(accountId);
  const submit = (body) => fetch(`${application.url}/api/me/terms`, {
    method: 'POST', headers: { cookie, origin: application.url, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  await withDatabaseClient(database.env, (client) => client.query(
    'UPDATE "AuthUser" SET "termsVersion" = $1, "phone" = NULL WHERE "id" = $2', ['obsolete', accountId],
  ));
  const restricted = await fetch(`${application.url}/api/me?role=admin`, { headers: { cookie } }).then((r) => r.json());
  assert.deepEqual(restricted.nextSteps, ['complete-profile', 'accept-terms']);
  assert.equal(restricted.roles, undefined);
  const renewed = await submit({ version: '2026-10-21', accepted: true });
  assert.equal(renewed.status, 200);
  assert.deepEqual((await renewed.json()).nextSteps, ['complete-profile']);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } }).then((r) => r.json())).roles, undefined);
  const forged = await fetch(`${application.url}/api/me`, {
    method: 'PATCH', headers: { cookie, origin: application.url, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Real Member', phone: '09123456789', role: 'admin' }),
  });
  assert.equal(forged.status, 400);
  await withDatabaseClient(database.env, (client) => client.query(
    'UPDATE "AuthUser" SET "status" = $1 WHERE "id" = $2', ['disabled', accountId],
  ));
  assert.equal((await submit({ version: '2026-10-21', accepted: true })).status, 401);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 401);
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
  const csrfCookies = responseCookieHeader(csrfResponse);
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

test('password login checks the stored hash and issues a shared database session', async () => {
  const accountId = await seedSessionAccount();
  const email = `${accountId}@example.test`;
  const password = 'A long password with spaces 2026';
  const salt = randomBytes(16);
  const hash = `scrypt:16384:8:1:${salt.toString('base64url')}:${scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('base64url')}`;
  await withDatabaseClient(database.env, (client) => client.query(
    'UPDATE "AuthUser" SET "passwordHash" = $1 WHERE "id" = $2', [hash, accountId],
  ));
  const login = (emailValue, passwordValue, origin = application.url) => fetch(`${application.url}/api/password-login`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email: emailValue, password: passwordValue }),
  });
  const wrong = await login(email, 'incorrect password');
  assert.equal(wrong.status, 401, application.logs());
  assert.equal((await wrong.json()).code, 'INVALID_CREDENTIALS');
  assert.equal(wrong.headers.getSetCookie().length, 0);
  const missing = await login('missing@example.test', password);
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).code, 'INVALID_CREDENTIALS');
  const foreign = await login(email, password, 'https://attacker.example');
  assert.equal(foreign.status, 403);
  const signedIn = await login(email.toUpperCase(), password);
  assert.equal(signedIn.status, 200, application.logs());
  assert.equal((await signedIn.json()).next, '/account');
  const cookie = responseCookieHeader(signedIn);
  assert.match(cookie, /^next-auth\.session-token=[A-Za-z0-9_-]{43}$/);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } }).then((r) => r.json())).account.id, accountId);
  assert.equal((await fetch(`${application.url}/api/auth/session`, { headers: { cookie } }).then((r) => r.json())).user.id, accountId);
  await application.stop();
  application = await startApplication(database.env);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } }).then((r) => r.json())).account.id, accountId);
  const csrf = await fetch(`${application.url}/api/auth/csrf`);
  const { csrfToken } = await csrf.json();
  const signout = await fetch(`${application.url}/api/auth/signout`, {
    method: 'POST',
    headers: { cookie: `${cookie}; ${responseCookieHeader(csrf)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, callbackUrl: application.url, json: 'true' }),
  });
  assert.equal(signout.status, 200, application.logs());
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 401);
  const attempts = await withDatabaseClient(database.env, (client) => client.query(
    `SELECT action, result, "requestId", details, metadata FROM "AuditEvent" WHERE action = 'password.sign-in' AND target = $1`, [accountId],
  ));
  assert.deepEqual(new Set(attempts.rows.map(({ result }) => result)), new Set(['rejected', 'success']));
  assert.ok(attempts.rows.every(({ details, metadata, requestId }) => details === null && metadata === null && typeof requestId === 'string'));
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await login(email, 'incorrect password')).status, 401);
  }
  await application.stop();
  application = await startApplication(database.env);
  const throttled = await login(email, password);
  assert.equal(throttled.status, 429);
  assert.equal((await throttled.json()).code, 'TOO_MANY_ATTEMPTS');
  assert.equal(throttled.headers.getSetCookie().length, 0);
  const otherAccount = await seedSessionAccount();
  await withDatabaseClient(database.env, (client) => client.query(
    'UPDATE "AuthUser" SET "passwordHash" = $1, "status" = $2 WHERE "id" = $3', [hash, 'disabled', otherAccount],
  ));
  assert.equal((await login(`${otherAccount}@example.test`, password)).status, 401);
});

test('registration creates only a member record and signs the new account in', async () => {
  const email = `new-member-${randomUUID()}@example.test`;
  const password = 'A long registration password 2026';
  const body = { firstName: 'Ava', middleName: 'Marie', lastName: 'Reyes', suffix: 'Jr.',
    email: email.toUpperCase(), phone: '+63 917 123 4567', password,
    termsAccepted: true, termsVersion: '2026-10-21' };
  const register = (data, origin = application.url) => fetch(`${application.url}/api/register`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(data),
  });

  assert.equal((await register(body, 'https://attacker.example')).status, 403);
  assert.equal((await register({ ...body, termsAccepted: false })).status, 400);
  assert.equal((await register({ ...body, password: 'short' })).status, 400);
  const created = await register(body);
  assert.equal(created.status, 201, application.logs());
  assert.equal((await created.json()).next, '/account?check-email=1');
  const cookie = responseCookieHeader(created);
  const rows = await withDatabaseClient(database.env, (client) => client.query(`
    SELECT a.id, a."passwordHash", a."emailVerified", a."termsVersion", u.name, u.phone,
      r.role, m."profileId", COUNT(ms.id)::int AS membership_count
    FROM "AuthUser" a JOIN "User" u ON u.id = a."gymUserId"
    JOIN "AssignedRole" r ON r."accountId" = a.id
    JOIN "MemberProfile" m ON m."profileId" = r."profileId"
    LEFT JOIN "Membership" ms ON ms."memberId" = m."profileId"
    WHERE a.email = $1 GROUP BY a.id, u.id, r.role, m."profileId"
  `, [email]));
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].name, 'Ava Marie Reyes Jr.');
  assert.equal(rows.rows[0].phone, '+63 917 123 4567');
  assert.equal(rows.rows[0].role, 'member');
  assert.equal(rows.rows[0].membership_count, 0);
  assert.equal(rows.rows[0].emailVerified, null);
  assert.equal(rows.rows[0].termsVersion, '2026-10-21');
  assert.match(rows.rows[0].passwordHash, /^scrypt:16384:8:1:/);
  assert.ok(!rows.rows[0].passwordHash.includes(password));
  const pendingSession = await fetch(`${application.url}/api/auth/session`, { headers: { cookie } }).then(r => r.json());
  assert.equal(pendingSession.user.restricted, true);
  assert.equal((await fetch(`${application.url}/api/member/overview`, { headers: { cookie } })).status, 403);
  const message = smtp.messages.at(-1)?.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  const link = message?.match(/http:\/\/127\.0\.0\.1:\d+\/api\/verify-email\?token=[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(link, 'SMTP message contains a one-time verification link');
  assert.equal((await fetch(`${application.url}/api/verify-email/resend`, {
    method: 'POST', headers: { origin: application.url, cookie },
  })).status, 429);
  const deliveredCount = smtp.messages.length;
  smtp.rejectNextRecipient();
  await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(Date.now() + 61_000));
  try {
    assert.equal((await fetch(`${application.url}/api/verify-email/resend`, {
      method: 'POST', headers: { origin: application.url, cookie },
    })).status, 503);
  } finally { await writeFile(database.env.INTEGRATION_CLOCK_FILE, ''); }
  assert.equal(smtp.messages.length, deliveredCount);
  await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(Date.now() + 122_000));
  try {
    assert.equal((await fetch(`${application.url}/api/verify-email/resend`, {
      method: 'POST', headers: { origin: application.url, cookie },
    })).status, 200);
  } finally { await writeFile(database.env.INTEGRATION_CLOCK_FILE, ''); }
  assert.equal(smtp.messages.length, deliveredCount + 1);
  const resentMessage = smtp.messages.at(-1)?.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  const resentLink = resentMessage?.match(/http:\/\/127\.0\.0\.1:\d+\/api\/verify-email\?token=[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(resentLink && resentLink !== link);
  const verified = await fetch(link, { redirect: 'manual' });
  assert.equal(verified.status, 307);
  assert.equal(verified.headers.get('location'), `${application.url}/?verified=1`);
  const verifiedCookie = responseCookieHeader(verified);
  assert.equal((await fetch(`${application.url}/api/auth/session`, { headers: { cookie: verifiedCookie } }).then(r => r.json())).user.role, 'member');
  const overview = await fetch(`${application.url}/api/member/overview`, { headers: { cookie: verifiedCookie } });
  assert.equal(overview.status, 200);
  assert.equal((await overview.json()).membership, null);
  assert.equal((await fetch(link, { redirect: 'manual' })).headers.get('location'), `${application.url}/account?verification=invalid`);
  assert.equal((await fetch(resentLink, { redirect: 'manual' })).headers.get('location'), `${application.url}/account?verification=invalid`);
  assert.equal((await register(body)).status, 409);
  const signedIn = await fetch(`${application.url}/api/password-login`, {
    method: 'POST', headers: { origin: application.url, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(signedIn.status, 200, application.logs());
  assert.ok(responseCookieHeader(signedIn));
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
  const cookie = `${signedIn.cookie}; ${responseCookieHeader(csrf)}`;
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
    const demoCookie = responseCookieHeader(login);
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
      const columns = table === 'User' ? '"id", "email", "name"'
        : table === 'AuthUser' ? '"id", "email", "name", "emailVerified", "image", "gymUserId"'
        : table === 'AuthSession' ? '"id", "sessionToken", "userId", "expires"' : '*';
      records.push((await client.query(`SELECT ${columns} FROM "${table}" ORDER BY "id"`)).rows);
    }
    return records;
  });
}

async function seedSessionAccount({ roles = ['member'], mfa = false } = {}) {
  const accountId = randomUUID();
  await withDatabaseClient(database.env, async (client) => {
    const { rows: [gym] } = await client.query('INSERT INTO "User" ("email", "name") VALUES ($1, $2) RETURNING "id"', [`${accountId}@example.test`, 'Session Member']);
    await client.query(`INSERT INTO "AuthUser" ("id", "email", "name", "gymUserId", "establishedAt", "emailVerified", "emailVerifiedProvider", "phone", "termsVersion", "termsAcceptedAt", "mfaEnabledAt")
      VALUES ($1, $2, 'Session Member', $3, NOW(), NOW(), 'password', '0912345678', '2026-10-21', NOW(), CASE WHEN $4 THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 second' ELSE NULL END)`,
    [accountId, `${accountId}@example.test`, gym.id, mfa]);
    for (const role of roles) {
      const profileId = randomUUID();
      await client.query('INSERT INTO "RoleProfile" ("id", "gymUserId", "role") VALUES ($1, $2, $3)', [profileId, gym.id, role]);
      await client.query('INSERT INTO "AssignedRole" ("accountId", "role", "profileId") VALUES ($1, $2, $3)', [accountId, role, profileId]);
    }
  });
  return accountId;
}

async function sessionCommand(action, input = {}, app = application, origin = app.url) {
  const { cookie, ...body } = input;
  return fetch(`${app.url}/api/integration-session-fixture`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin,
      'x-test-key': database.env.INTEGRATION_SESSION_KEY, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ action, ...body }),
  });
}

async function issueSession(accountId, app = application) {
  const response = await sessionCommand('issue', { accountId }, app);
  assert.equal(response.status, 200, app.logs());
  return { cookie: responseCookieHeader(response), response };
}

function responseCookieHeader(response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
}

test('shared application-issued sessions work with NextAuth and polling never extends the seven-day member idle boundary', async () => {
  const accountId = await seedSessionAccount();
  const now = Date.now();
  const setTime = (value) => writeFile(database.env.INTEGRATION_CLOCK_FILE, String(value));
  try {
    await setTime(now);
    const { cookie, response } = await issueSession(accountId);
    const setCookie = response.headers.getSetCookie()[0];
    assert.match(setCookie, /^next-auth.session-token=[A-Za-z0-9_-]{43};/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\//i);
    assert.doesNotMatch(setCookie, /; Secure/i);
    const status = await fetch(`${application.url}/api/me`, { headers: { cookie } }).then((r) => r.json());
    assert.equal(status.restricted, false);
    assert.deepEqual(status.roles, ['member']);
    assert.equal(status.account.id, accountId);
    await setTime(now + 7 * 86_400_000 - 1);
    const session = await fetch(`${application.url}/api/auth/session`, { headers: { cookie } }).then((r) => r.json());
    assert.equal(session.user.id, accountId);
    assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 200);
    await setTime(now + 7 * 86_400_000);
    assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 401);
    assert.deepEqual(await fetch(`${application.url}/api/auth/session`, { headers: { cookie } }).then((r) => r.json()), {});
  } finally { await writeFile(database.env.INTEGRATION_CLOCK_FILE, ''); }
});

test('MFA assurance belongs to one session and only fully authorized administrators can persist plan writes', async () => {
  const accountId = await seedSessionAccount({ roles: ['member', 'admin'], mfa: true });
  const first = await issueSession(accountId);
  const second = await issueSession(accountId);
  const catalog = await fetch(`${application.url}/api/gym-plans`).then((r) => r.json());
  const original = catalog.plans[0];
  const mutate = (cookie, body, origin = application.url) => fetch(`${application.url}/api/gym-plans`, {
    method: 'PATCH', headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await mutate(first.cookie, { action: 'deactivate', name: original.name })).status, 403);
  const rotation = await sessionCommand('rotate', { accountId, cookie: first.cookie, mfaVerified: true });
  assert.equal(rotation.status, 200);
  const assuredCookie = responseCookieHeader(rotation);
  assert.notEqual(assuredCookie, first.cookie);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: first.cookie } })).status, 401);
  const assuredSession = await fetch(`${application.url}/api/auth/session`, { headers: { cookie: assuredCookie } }).then((r) => r.json());
  assert.equal(assuredSession.user.restricted, false, JSON.stringify(assuredSession));
  const other = await fetch(`${application.url}/api/me`, { headers: { cookie: second.cookie } }).then((r) => r.json());
  assert.equal(other.restricted, true);
  assert.ok(other.nextSteps.includes('complete-two-step-verification'));
  assert.equal(other.roles, undefined);
  assert.equal((await mutate(second.cookie, { action: 'deactivate', name: original.name })).status, 403);
  const foreign = await mutate(assuredCookie, { action: 'deactivate', name: original.name }, 'https://attacker.example');
  assert.equal(foreign.status, 403);
  assert.equal((await foreign.json()).code, 'ORIGIN_REJECTED');
  assert.equal((await mutate(assuredCookie, { action: 'deactivate', name: original.name }, '')).status, 403);
  assert.deepEqual(await fetch(`${application.url}/api/gym-plans`).then((r) => r.json()), catalog);
  const response = await mutate(assuredCookie, { action: 'deactivate', name: original.name });
  assert.equal(response.status, 200, application.logs());
  assert.equal((await response.json()).plans.find((p) => p.name === original.name).status, 'Inactive');
  const createdPlan = { ...original, name: `Session authorized plan ${randomUUID()}` };
  const created = await fetch(`${application.url}/api/gym-plans`, {
    method: 'POST', headers: { cookie: assuredCookie, origin: application.url, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: createdPlan }),
  });
  assert.equal(created.status, 201);
  assert.equal((await mutate(assuredCookie, { action: 'update', originalName: createdPlan.name, plan: { ...createdPlan, price: 1234 } })).status, 200);
  assert.equal((await mutate(assuredCookie, { action: 'deactivate', name: createdPlan.name })).status, 200);
  assert.equal((await mutate(assuredCookie, { action: 'activate', name: original.name })).status, 200);
  const missing = await mutate(assuredCookie, { action: 'deactivate', name: 'does not exist' });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, 'PLAN_NOT_FOUND');
  const invalid = await mutate(assuredCookie, {});
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_REQUEST');
  await withDatabaseClient(database.env, (client) => client.query('DELETE FROM "AssignedRole" WHERE "accountId" = $1 AND "role" = $2', [accountId, 'admin']));
  const stale = await mutate(assuredCookie, { action: 'deactivate', name: original.name });
  assert.equal(stale.status, 403);
  assert.equal((await stale.json()).code, 'FORBIDDEN');
});

test('member activity cannot extend thirty-day absolute expiry, including credential rotation', async () => {
  const accountId = await seedSessionAccount();
  const now = Date.now();
  try {
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now));
    const issued = await issueSession(accountId);
    let cookie = issued.cookie;
    for (const day of [6, 12, 18, 24, 29]) {
      await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now + day * 86_400_000));
      assert.equal((await sessionCommand('business', { cookie })).status, 200);
    }
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now + 30 * 86_400_000 - 1));
    const rotated = await sessionCommand('rotate', { accountId, cookie, primaryAuthenticated: true });
    assert.equal(rotated.status, 200);
    cookie = responseCookieHeader(rotated);
    assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 200);
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now + 30 * 86_400_000));
    assert.equal((await sessionCommand('business', { cookie })).status, 401);
  } finally { await writeFile(database.env.INTEGRATION_CLOCK_FILE, ''); }
});

test('every privileged Assigned Role uses thirty-minute idle and twelve-hour absolute expiry', async () => {
  const now = Date.now();
  try {
    for (const role of ['staff', 'trainer', 'admin', 'superadmin']) {
      const accountId = await seedSessionAccount({ roles: ['member', role], mfa: true });
      await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now));
      const { cookie } = await issueSession(accountId);
      await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now + 30 * 60_000 - 1));
      assert.equal((await fetch(`${application.url}/api/auth/session`, { headers: { cookie } }).then((r) => r.json())).user.id, accountId);
      await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now + 30 * 60_000));
      assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 401, role);
    }
    const accountId = await seedSessionAccount({ roles: ['member', 'trainer'], mfa: true });
    // This Account was enrolled after the earlier role loop; its test clock
    // must begin after that enrollment for session MFA assurance to be valid.
    const activeNow = Date.now() + 1000;
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(activeNow));
    const initial = await issueSession(accountId);
    const rotated = await sessionCommand('rotate', { accountId, cookie: initial.cookie, mfaVerified: true });
    const cookie = responseCookieHeader(rotated);
    for (let minute = 29; minute < 720; minute += 29) {
      await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(activeNow + minute * 60_000));
      assert.equal((await sessionCommand('business', { cookie })).status, 200);
    }
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(activeNow + 12 * 60 * 60_000 - 1));
    assert.equal((await sessionCommand('business', { cookie })).status, 200);
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(activeNow + 12 * 60 * 60_000));
    assert.equal((await sessionCommand('business', { cookie })).status, 401);
  } finally { await writeFile(database.env.INTEGRATION_CLOCK_FILE, ''); }
});

test('current Account requirements are enforced on every plan mutation and disablement revokes all sessions', async () => {
  const catalog = await fetch(`${application.url}/api/gym-plans`).then((r) => r.json());
  for (const change of [
    '"emailVerified" = NULL', '"emailVerifiedProvider" = NULL', '"establishedAt" = NULL',
    '"phone" = NULL', '"name" = \'  \'', '"termsVersion" = \'obsolete\'', '"termsAcceptedAt" = NULL',
    '"mfaEnabledAt" = NULL', '"gymUserId" = NULL', '"status" = \'disabled\'',
  ]) {
    const accountId = await seedSessionAccount({ roles: ['admin'], mfa: true });
    const first = await issueSession(accountId);
    const second = await issueSession(accountId);
    const rotation = await sessionCommand('rotate', { accountId, cookie: first.cookie, mfaVerified: true });
    const cookie = responseCookieHeader(rotation);
    await withDatabaseClient(database.env, (client) => client.query(`UPDATE "AuthUser" SET ${change} WHERE "id" = $1`, [accountId]));
    const denied = await fetch(`${application.url}/api/gym-plans`, {
      method: 'PATCH', headers: { cookie, origin: application.url, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'deactivate', name: catalog.plans[0].name }),
    });
    assert.equal(denied.status, change.includes('disabled') ? 401 : 403, change);
    const error = await denied.json();
    assert.equal(typeof error.code, 'string');
    assert.equal(error.requestId, denied.headers.get('x-request-id'));
    if (change.includes('disabled')) {
      await withDatabaseClient(database.env, (client) => client.query('UPDATE "AuthUser" SET "status" = $1 WHERE "id" = $2', ['enabled', accountId]));
      assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 401);
      assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: second.cookie } })).status, 401);
      const fresh = await issueSession(accountId);
      assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: fresh.cookie } })).status, 200);
    }
  }
  const noRoles = await seedSessionAccount({ roles: [] });
  const { cookie } = await issueSession(noRoles);
  const status = await fetch(`${application.url}/api/me`, { headers: { cookie } }).then((r) => r.json());
  assert.equal(status.restricted, true);
  assert.ok(status.nextSteps.includes('contact-support'));
  assert.equal((await sessionCommand('business', { cookie })).status, 403);
  assert.deepEqual(await fetch(`${application.url}/api/gym-plans`).then((r) => r.json()), catalog);
});

test('optional MFA also restricts members and concurrent rotation consumes only one old token', async () => {
  const accountId = await seedSessionAccount({ mfa: true });
  const first = await issueSession(accountId);
  const second = await issueSession(accountId);
  assert.equal((await sessionCommand('business', { cookie: first.cookie })).status, 403);
  const results = await Promise.all([1, 2].map(() => sessionCommand('rotate', { accountId, cookie: first.cookie, mfaVerified: true })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const assured = responseCookieHeader(results.find((r) => r.status === 200));
  assert.equal((await sessionCommand('business', { cookie: assured })).status, 200);
  assert.equal((await sessionCommand('business', { cookie: second.cookie })).status, 403);
  const strangerId = await seedSessionAccount();
  const stranger = await issueSession(strangerId);
  assert.equal((await sessionCommand('rotate', { accountId: strangerId, cookie: assured, mfaVerified: true })).status, 409);
  assert.equal((await sessionCommand('business', { cookie: assured })).status, 200);
  assert.equal((await sessionCommand('revoke-all', { accountId })).status, 200);
  for (const cookie of [assured, second.cookie]) assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie } })).status, 401);
  assert.equal((await fetch(`${application.url}/api/me?accountId=${accountId}`, { headers: { cookie: stranger.cookie } }).then((r) => r.json())).account.id, strangerId);
});

test('primary proof expires at five minutes and a successful Google reauthentication rotates the old credential', async () => {
  const accountId = await seedSessionAccount();
  const now = Date.now();
  try {
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now));
    const { cookie } = await issueSession(accountId);
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now + 5 * 60_000 - 1));
    assert.deepEqual(await sessionCommand('fresh', { cookie }).then((r) => r.json()), { fresh: true });
    await writeFile(database.env.INTEGRATION_CLOCK_FILE, String(now + 5 * 60_000));
    assert.deepEqual(await sessionCommand('fresh', { cookie }).then((r) => r.json()), { fresh: false });
  } finally { await writeFile(database.env.INTEGRATION_CLOCK_FILE, ''); }
  const profile = { sub: 'fresh-google-subject', email: 'fresh-google@example.test', email_verified: true };
  const first = await google.signIn(application, profile);
  const again = await google.signIn(application, profile, first.cookie);
  assert.equal(new URL(again.location).href, `${application.url}/`, application.logs());
  assert.notEqual(again.cookie, first.cookie);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: first.cookie } })).status, 401);
  assert.equal((await fetch(`${application.url}/api/me`, { headers: { cookie: again.cookie } })).status, 200);
});

test('HTTPS policy shares secure cookies with NextAuth and logout cannot be forged or revoke another Account', async () => {
  const accountId = await seedSessionAccount();
  const secure = await startApplication(database.env, { https: true });
  try {
    const { cookie, response } = await issueSession(accountId, secure);
    assert.match(response.headers.getSetCookie()[0], /^__Secure-next-auth.session-token=/);
    assert.match(response.headers.getSetCookie()[0], /; Secure/i);
    assert.match(response.headers.getSetCookie()[0], /HttpOnly/i);
    assert.equal((await fetch(`${secure.url}/api/auth/session`, { headers: { cookie } }).then((r) => r.json())).user.id, accountId);
    const insecureCookie = cookie.replace('__Secure-', '');
    assert.equal((await fetch(`${secure.url}/api/me`, { headers: { cookie: insecureCookie } })).status, 401);
    const rejected = await fetch(`${secure.url}/api/auth/signout`, {
      method: 'POST', headers: { cookie, origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.getSetCookie().length, 0);
    const noCsrf = await fetch(`${secure.url}/api/auth/signout`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(noCsrf.status, 403);
    const otherId = await seedSessionAccount();
    const other = await issueSession(otherId, secure);
    const signedOut = await fetch(`${secure.url}/api/auth/signout`, {
      method: 'POST', headers: { cookie: `${cookie}; __Secure-next-auth.session-token.0=old-chunk; next-auth.session-token.0=old-local-chunk`,
        origin: secure.url.replace('http:', 'https:'), 'content-type': 'application/json' },
      body: JSON.stringify({ accountId: otherId, callbackUrl: 'https://attacker.example' }),
    });
    assert.equal(signedOut.status, 200);
    assert.equal((await signedOut.json()).url, secure.url.replace('http:', 'https:'));
    assert.ok(signedOut.headers.getSetCookie().some((c) => c.startsWith('next-auth.session-token.0=;') && /Max-Age=0/.test(c)));
    assert.ok(signedOut.headers.getSetCookie().some((c) => c.startsWith('__Secure-next-auth.session-token.0=;') && /Max-Age=0/.test(c)));
    assert.equal((await fetch(`${secure.url}/api/me`, { headers: { cookie } })).status, 401);
    assert.equal((await fetch(`${secure.url}/api/me`, { headers: { cookie: other.cookie } })).status, 200);
    const [cookieName, cookieValue] = other.cookie.split('=');
    const malformed = await fetch(`${secure.url}/api/auth/signout`, {
      method: 'POST', headers: { cookie: `${cookieName}.1=${cookieValue}`, origin: secure.url.replace('http:', 'https:'),
        'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, 'INVALID_SESSION_COOKIE');
    assert.equal(malformed.headers.getSetCookie().length, 0);
    const chunked = await fetch(`${secure.url}/api/auth/signout`, {
      method: 'POST', headers: { cookie: `${cookieName}.0=${cookieValue.slice(0, 20)}; ${cookieName}.1=${cookieValue.slice(20)}`,
        origin: secure.url.replace('http:', 'https:'), 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(chunked.status, 200);
    assert.equal((await fetch(`${secure.url}/api/me`, { headers: { cookie: other.cookie } })).status, 401);
  } finally { await secure.stop(); }
});

test('anonymous NextAuth session remains available when database storage is down', async () => {
  const unavailable = await startApplication({
    ...database.env,
    DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/invalid?schema=public',
  });
  try {
    const anonymous = await fetch(`${unavailable.url}/api/auth/session`);
    assert.equal(anonymous.status, 200, unavailable.logs());
    assert.deepEqual(await anonymous.json(), {});

    const authenticated = await fetch(`${unavailable.url}/api/auth/session`, { headers: { cookie: adminCookie } });
    assert.equal(authenticated.status, 503, unavailable.logs());
    assert.equal((await authenticated.json()).code, 'UNAVAILABLE');
  } finally { await unavailable.stop(); }
});
