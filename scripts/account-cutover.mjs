import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import nextEnv from '@next/env';
import pg from 'pg';

nextEnv.loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)), process.env.NODE_ENV !== 'production');
const roles = ['member', 'staff', 'trainer', 'admin', 'superadmin'];
const normalize = (email) => email.trim().toLowerCase();
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function assignmentsFrom(source) {
  const explicit = JSON.parse(source.roleAssignments || '{}');
  if (!explicit || typeof explicit !== 'object' || Array.isArray(explicit)) throw new Error('ROLE_ASSIGNMENTS must be a JSON object.');
  const assignments = new Map();
  for (const [email, values] of Object.entries(explicit)) {
    const normalized = normalize(email);
    if (!normalized || assignments.has(normalized)) throw new Error('ROLE_ASSIGNMENTS contains an empty or colliding normalized email.');
    if (!Array.isArray(values) || !values.length || values.some((value) => !roles.includes(value))) throw new Error('ROLE_ASSIGNMENTS contains an invalid role list.');
    assignments.set(normalized, roles.filter((role) => values.includes(role)));
  }
  for (const email of (source.adminEmails || '').split(',').map(normalize).filter(Boolean)) {
    if (!assignments.has(email)) assignments.set(email, ['member', 'admin']);
  }
  return [...assignments].sort(([a], [b]) => a.localeCompare(b));
}

async function planCutover(client, source) {
  const auth = (await client.query(`SELECT a."id", a."email", a."gymUserId", a."emailVerified",
    COALESCE(to_jsonb(a)->>'status', 'enabled') AS status FROM "AuthUser" a ORDER BY a."id"`)).rows;
  const gym = (await client.query('SELECT "id", "email" FROM "User" ORDER BY "id"')).rows;
  const links = (await client.query('SELECT "userId", "provider", "providerAccountId" FROM "AuthAccount" ORDER BY "id"')).rows;
  const rolesReady = (await client.query(`SELECT to_regclass('"AssignedRole"') AS table`)).rows[0].table !== null;
  const assigned = rolesReady ? (await client.query('SELECT * FROM "AssignedRole" ORDER BY "accountId", "role"')).rows : [];
  const profiles = rolesReady ? (await client.query('SELECT * FROM "RoleProfile" ORDER BY "id"')).rows : [];
  const database = (await client.query('SELECT current_database() AS database, current_schema() AS schema')).rows[0];
  const issues = [];
  for (const [table, records] of [['AuthUser', auth], ['User', gym]]) {
    const byEmail = new Map();
    for (const record of records) {
      if (record.email === null) continue;
      const email = normalize(record.email);
      if (!email) issues.push({ kind: 'empty-email', table, id: record.id });
      const ids = byEmail.get(email) ?? [];
      ids.push(record.id);
      byEmail.set(email, ids);
    }
    for (const [normalizedEmail, ids] of byEmail) {
      if (ids.length > 1) issues.push({ kind: 'normalized-email-collision', table, normalizedEmail, ids });
    }
  }
  for (const account of auth) {
    for (const user of gym) {
      if (account.email && normalize(account.email) === normalize(user.email) && account.gymUserId !== user.id) {
        issues.push({ kind: 'identity-link-conflict', accountId: account.id, gymUserId: user.id, normalizedEmail: normalize(account.email) });
      }
    }
  }
  const assignments = [];
  for (const [email, assignedRoles] of assignmentsFrom(source)) {
    const matches = auth.filter((record) => record.email && normalize(record.email) === email);
    const account = matches[0];
    if (matches.length !== 1 || !account.emailVerified || account.gymUserId === null || account.status !== 'enabled') {
      issues.push({ kind: 'unresolved-role-assignment', normalizedEmail: email });
      continue;
    }
    assignments.push({ accountId: account.id, gymUserId: account.gymUserId, email, roles: assignedRoles });
  }
  return {
    version: 1, database, source, issues, assignments,
    fingerprint: digest({ database, auth, gym, links, assigned, profiles }),
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true, options: { output: { type: 'string' }, plan: { type: 'string' }, 'reviewed-by': { type: 'string' } },
  });
  const command = positionals[0];
  if (positionals.length !== 1 || !['plan', 'apply'].includes(command)) throw new Error('Use plan --output <file> or apply --plan <file> --reviewed-by <operator>.');
  if (command === 'plan' && !values.output) throw new Error('plan requires --output.');
  if (command === 'apply' && (!values.plan || !values['reviewed-by']?.trim())) throw new Error('apply requires --plan and --reviewed-by.');
  const reviewedBy = values['reviewed-by']?.trim();
  if (reviewedBy && !/^[a-zA-Z0-9_.@-]{1,100}$/.test(reviewedBy)) throw new Error('reviewed-by must be a short operator identifier.');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const schema = new URL(connectionString).searchParams.get('schema') ?? 'public';
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Quote the schema as an identifier inside search_path, not as SQL text.
    await client.query("SELECT set_config('search_path', $1, false)", [`"${schema.replaceAll('"', '""')}"`]);
    if (command === 'plan') {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const plan = await planCutover(client, { roleAssignments: process.env.ROLE_ASSIGNMENTS || '{}', adminEmails: process.env.ADMIN_EMAILS || '' });
      await client.query('COMMIT');
      await writeFile(values.output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ issues: plan.issues, assignments: plan.assignments.length, fingerprint: plan.fingerprint }));
      if (plan.issues.length) process.exitCode = 2;
      return;
    }
    const plan = JSON.parse(await readFile(values.plan, 'utf8'));
    if (plan.version !== 1 || !plan.source || plan.issues?.length !== 0) throw new Error('The reviewed plan is invalid or has unresolved issues.');
    await client.query('BEGIN');
    await client.query('LOCK TABLE "User", "AuthUser", "AuthAccount", "RoleProfile", "AssignedRole" IN SHARE ROW EXCLUSIVE MODE');
    const current = await planCutover(client, plan.source);
    if (JSON.stringify(current) !== JSON.stringify(plan)) throw new Error('The reviewed plan is stale or changed. Generate and review a new plan.');
    const requestId = randomUUID();
    for (const assignment of plan.assignments) {
      for (const role of assignment.roles) {
        const profile = (await client.query(`INSERT INTO "RoleProfile" ("id", "gymUserId", "role") VALUES ($1, $2, $3)
          ON CONFLICT ("gymUserId", "role") DO UPDATE SET "role" = EXCLUDED."role" RETURNING "id"`, [randomUUID(), assignment.gymUserId, role])).rows[0];
        await client.query(`INSERT INTO "AssignedRole" ("accountId", "role", "profileId") VALUES ($1, $2, $3)
          ON CONFLICT ("accountId", "role") DO NOTHING`, [assignment.accountId, role, profile.id]);
      }
      await client.query(`INSERT INTO "AuditEvent" ("id", "actor", "action", "target", "result", "requestId")
        VALUES ($1, $2, 'role.assignments-imported', $3, 'success', $4)`, [randomUUID(), `operator:${reviewedBy}`, assignment.accountId, requestId]);
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ imported: plan.assignments.length, requestId }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}

main().catch((error) => {
  // The report intentionally contains email addresses for operator resolution;
  // database connection strings and query parameter dumps are never printed.
  console.error(error.code ? `Account cutover failed (${error.code}). No assignments were committed.` : error.message);
  process.exitCode = 1;
});
