// Diagnoses why the seeded admin Account is restricted and what columns exist.
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const envText = readFileSync('.env', 'utf8');
const line = envText.split(/\r?\n/).find((l) => l.trim().startsWith('DATABASE_URL='));
const raw = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
const parsed = new URL(raw);
const client = new pg.Client({
  host: parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname,
  port: Number(parsed.port || 5432),
  user: 'postgres',
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.replace(/^\//, '') || 'postgres',
});
await client.connect();

const lines = [];
lines.push('DBHOST=' + parsed.hostname + ':' + (parsed.port || 5432) + ' DB=' + parsed.pathname + ' QUERY=' + parsed.search);
async function q(label, sql, params) {
  try {
    const r = await client.query(sql, params);
    lines.push(label + '=' + JSON.stringify(r.rows));
  } catch (e) {
    lines.push(label + '=ERR:' + e.message);
  }
}

try {
  await q('TABLES', `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
  await q('ACCOUNT', `SELECT id, email, "gymUserId", status, "establishedAt", "emailVerified",
      "emailVerifiedProvider", phone, name, "termsVersion", "termsAcceptedAt", "mfaEnabledAt"
      FROM "AuthUser" WHERE id='verify-admin-account'`);
  await q('ROLES', `SELECT ar.role, ar."profileId", rp."gymUserId" AS "profileGymUserId"
      FROM "AssignedRole" ar LEFT JOIN "RoleProfile" rp ON rp.id = ar."profileId"
      WHERE ar."accountId"='verify-admin-account'`);
  await q('SESSION', `SELECT id, "userId", expires, "lastActiveAt", "primaryAuthenticatedAt",
      "mfaVerifiedAt", length("sessionToken") AS "tokenLen"
      FROM "AuthSession" WHERE id='verify-admin-session'`);
  await q('USERROW', `SELECT id, email, name FROM "User" WHERE id = (SELECT "gymUserId" FROM "AuthUser" WHERE id='verify-admin-account')`);
  await q('COLS_TRAINER', `SELECT column_name FROM information_schema.columns WHERE table_name='TrainerProfile' ORDER BY 1`);
  await q('COLS_STAFF', `SELECT column_name FROM information_schema.columns WHERE table_name='StaffProfile' ORDER BY 1`);
  await q('COLS_BOOKING', `SELECT column_name FROM information_schema.columns WHERE table_name='Booking' ORDER BY 1`);
} finally {
  await client.end();
}

writeFileSync('tmp-diag2.txt', lines.join('\n'));
console.log('WROTE tmp-diag2.txt');
