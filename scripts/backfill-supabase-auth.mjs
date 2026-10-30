import { randomBytes } from 'node:crypto';
import nextEnv from '@next/env';
import pg from 'pg';

nextEnv.loadEnvConfig(process.cwd());
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DATABASE_URL;
if (!projectUrl || !secretKey || !connectionString) throw new Error('Supabase URL, secret key, and DATABASE_URL are required');
const project = new URL(projectUrl).hostname.split('.')[0];
const databaseProject = decodeURIComponent(new URL(connectionString).username).split('.')[1];
if (!databaseProject || databaseProject !== project) throw new Error('Supabase Auth and PostgreSQL project IDs do not match');

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
await client.connect();
let accounts;
try {
  const result = await client.query(`SELECT a.id, a.email, (a."emailVerified" IS NOT NULL) AS verified,
    (a."passwordHash" IS NOT NULL) AS legacy_password
    FROM "AuthUser" a LEFT JOIN auth.users u ON lower(u.email) = lower(a.email)
    WHERE u.id IS NULL AND a.email IS NOT NULL ORDER BY a.id`);
  accounts = result.rows;
} finally {
  await client.end();
}
console.log(`Supabase Auth backfill: ${accounts.length} missing identities, ${accounts.filter(a => a.legacy_password).length} with legacy password hashes.`);
if (!process.argv.includes('--apply')) {
  console.log('Dry run. Pass --apply to create the missing identities.');
  process.exit(0);
}

let created = 0;
for (const account of accounts) {
  const response = await fetch(`${projectUrl.replace(/\/$/, '')}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.email,
      password: randomBytes(32).toString('base64url'), email_confirm: account.verified,
      app_metadata: { app_account_id: account.id, migration_password_pending: account.legacy_password } }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Stopped after ${created} identities: Supabase Auth returned ${response.status}`);
  created++;
}
console.log(`Created ${created} Supabase Auth identities. Existing application roles and gym records were unchanged.`);
