// Seeds one fully-established admin Account and one member Account, then issues a
// real database-backed session for the admin. Writes tmp-seed.json (session token).
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const envText = readFileSync('.env', 'utf8');
const line = envText.split(/\r?\n/).find((l) => l.trim().startsWith('DATABASE_URL='));
const raw = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
const parsed = new URL(raw);
const password = decodeURIComponent(parsed.password);
const port = Number(parsed.port || 5432);
const database = parsed.pathname.replace(/^\//, '') || 'postgres';
const host = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname;
const TERMS = '2026-10-21';

const client = new pg.Client({ host, port, user: 'postgres', password, database });
await client.connect();
// Prisma stores DateTime as timestamp-without-tz holding UTC wall-clock. Casting
// now() in a non-UTC session would write local wall-clock and read back shifted.
await client.query("SET TIME ZONE 'UTC'");

try {
  await client.query('BEGIN');

  // Idempotent reset of just our seeded identities.
  const accounts = ['verify-admin-account', 'verify-member-account'];
  await client.query('DELETE FROM "AuthUser" WHERE "id" = ANY($1)', [accounts]);
  await client.query('DELETE FROM "RoleProfile" WHERE "id" = ANY($1)', [['verify-admin-profile', 'verify-member-profile']]);
  await client.query('DELETE FROM "MemberProfile" WHERE "id" = $1', ['verify-member-profile-row']);
  await client.query('DELETE FROM "User" WHERE "email" IN ($1,$2)', ['verify.admin@vinathletics.gym', 'verify.member@vinathletics.gym']);

  const adminUser = await client.query(
    'INSERT INTO "User" ("email","name") VALUES ($1,$2) RETURNING "id"',
    ['verify.admin@vinathletics.gym', 'Verify Admin'],
  );
  const adminGymId = adminUser.rows[0].id;
  const memberUser = await client.query(
    'INSERT INTO "User" ("email","name") VALUES ($1,$2) RETURNING "id"',
    ['verify.member@vinathletics.gym', 'Verify Member'],
  );
  const memberGymId = memberUser.rows[0].id;

  await client.query(
    `INSERT INTO "AuthUser" ("id","name","email","gymUserId","status","establishedAt","emailVerified",
      "emailVerifiedProvider","phone","termsVersion","termsAcceptedAt","mfaEnabledAt")
     VALUES ($1,$2,$3,$4,'enabled', now(), now(), 'seed', $5, $6, now(), now() - interval '1 hour')`,
    ['verify-admin-account', 'Verify Admin', 'verify.admin@vinathletics.gym', adminGymId, '+63 900 000 0001', TERMS],
  );
  await client.query(
    `INSERT INTO "AuthUser" ("id","name","email","gymUserId","status","establishedAt","emailVerified",
      "emailVerifiedProvider","phone","termsVersion","termsAcceptedAt")
     VALUES ($1,$2,$3,$4,'enabled', now(), now(), 'seed', $5, $6, now())`,
    ['verify-member-account', 'Verify Member', 'verify.member@vinathletics.gym', memberGymId, '+63 900 000 0002', TERMS],
  );

  await client.query('INSERT INTO "RoleProfile" ("id","gymUserId","role") VALUES ($1,$2,$3)',
    ['verify-admin-profile', adminGymId, 'admin']);
  await client.query('INSERT INTO "RoleProfile" ("id","gymUserId","role") VALUES ($1,$2,$3)',
    ['verify-member-profile', memberGymId, 'member']);
  await client.query('INSERT INTO "AssignedRole" ("accountId","role","profileId") VALUES ($1,$2,$3)',
    ['verify-admin-account', 'admin', 'verify-admin-profile']);
  await client.query('INSERT INTO "AssignedRole" ("accountId","role","profileId") VALUES ($1,$2,$3)',
    ['verify-member-account', 'member', 'verify-member-profile']);

  await client.query(
    'INSERT INTO "MemberProfile" ("id","gymUserId","displayNumber") VALUES ($1,$2,$3)',
    ['verify-member-profile-row', memberGymId, 'M-VERIFY'],
  );

  const sessionToken = 'verify-' + randomBytes(24).toString('hex');
  await client.query(
    `INSERT INTO "AuthSession" ("id","sessionToken","userId","expires","createdAt","lastActiveAt",
      "primaryAuthenticatedAt","mfaVerifiedAt")
     VALUES ($1,$2,$3, now() + interval '8 hours', now(), now(), now(), now())`,
    ['verify-admin-session', sessionToken, 'verify-admin-account'],
  );

  await client.query('COMMIT');
  writeFileSync('tmp-seed.json', JSON.stringify({
    sessionToken,
    adminGymUserId: adminGymId,
    memberGymUserId: memberGymId,
  }, null, 2));
  console.log('SEEDED');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('SEED_FAILED', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
