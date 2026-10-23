// Measures clock/timezone/column-type semantics for the session MFA gate and
// computes exactly which getAccountStatus next-step fires.
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

const L = [];
try {
  const meta = await client.query(`SELECT now() AS "dbNow", current_setting('TimeZone') AS tz`);
  L.push('NODE_NOW=' + new Date().toISOString());
  L.push('DB_NOW=' + meta.rows[0].dbNow.toISOString() + ' TZ=' + meta.rows[0].tz);

  const types = await client.query(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE column_name IN ('mfaVerifiedAt','mfaEnabledAt','expires','lastActiveAt','createdAt','termsAcceptedAt','mfaEnabledAt')
      ORDER BY table_name, column_name`);
  for (const r of types.rows) L.push(`TYPE ${r.table_name}.${r.column_name}=${r.data_type}`);

  const sess = await client.query(
    `SELECT "mfaVerifiedAt"::text AS "mfaTxt", "mfaVerifiedAt" AS "mfaVal",
            "expires"::text AS "expTxt", "expires" AS "expVal"
       FROM "AuthSession" WHERE id='verify-admin-session'`);
  const s = sess.rows[0] || {};
  L.push('SESS_MFA_TXT=' + s.mfaTxt);
  L.push('SESS_MFA_JS=' + (s.mfaVal ? s.mfaVal.toISOString() : 'null'));
  L.push('SESS_EXP_TXT=' + s.expTxt + ' JS=' + (s.expVal ? s.expVal.toISOString() : 'null'));

  const acc = await client.query(
    `SELECT "mfaEnabledAt"::text AS "mfaEnTxt", "mfaEnabledAt" AS "mfaEnVal",
            "termsVersion", "termsAcceptedAt" AS "termsVal", name, phone, email,
            "emailVerified", "emailVerifiedProvider", "gymUserId", status
       FROM "AuthUser" WHERE id='verify-admin-account'`);
  const a = acc.rows[0] || {};
  L.push('ACC_MFAEN_TXT=' + a.mfaEnTxt);
  L.push('ACC_MFAEN_JS=' + (a.mfaEnVal ? a.mfaEnVal.toISOString() : 'null'));

  const now = new Date();
  const steps = [];
  if (a.status === 'disabled') steps.push('contact-support');
  if (!a.gymUserId) steps.push('sign-in-with-google');
  if (!a.email || !a.emailVerified || !a.emailVerifiedProvider) steps.push('verify-email');
  if (!a.name || !a.phone) steps.push('complete-profile');
  if (!a.termsVal || a.termsVersion !== '2026-10-21') steps.push('accept-terms');
  if (a.mfaEnVal && (!s.mfaVal || s.mfaVal < a.mfaEnVal || s.mfaVal > now)) steps.push('complete-two-step-verification');
  L.push('MFA_GT_NOW=' + (s.mfaVal ? String(s.mfaVal > now) : 'n/a'));
  L.push('MFA_LT_ENABLED=' + (s.mfaVal && a.mfaEnVal ? String(s.mfaVal < a.mfaEnVal) : 'n/a'));
  L.push('NEXTSTEPS=' + JSON.stringify([...new Set(steps)]));
} finally {
  await client.end();
}

writeFileSync('tmp-clock.txt', L.join('\n'));
console.log('WROTE tmp-clock.txt');
