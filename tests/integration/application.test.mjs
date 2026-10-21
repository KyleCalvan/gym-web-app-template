import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { startDatabase, startApplication, runNode, withDatabaseClient } from './harness.mjs';

let database;
let application;
const adminCookie = 'next-auth.session-token=fixture-admin-session-token';
const memberCookie = 'next-auth.session-token=fixture-member-session-token';

before(async () => {
  database = await startDatabase();
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
});

test('an authorized plan update survives an application restart in isolated PostgreSQL', async () => {
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
  assert.equal(updated.status, 200, application.logs());
  const saved = await updated.json();
  assert.deepEqual(saved.plans.find((item) => item.name === plan.name), plan);

  await application.stop();
  application = await startApplication(database.env);
  const reloaded = await fetch(`${application.url}/api/gym-plans`);
  assert.equal(reloaded.status, 200);
  assert.deepEqual(await reloaded.json(), saved);
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
  const original = await readLegacyRecords(env);

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
      records.push((await client.query(`SELECT * FROM "${table}" ORDER BY "id"`)).rows);
    }
    return records;
  });
}
