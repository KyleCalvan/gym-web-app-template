import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/api/superadmin/users/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function routeFor({ session, sameOrigin = true, tx = {} }) {
  const exports = {};
  const deps = {
    'node:crypto': { randomUUID: () => 'request-1' },
    'next/server': {},
    '@/backend/generated/prisma/client': { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    '@/src/auth/account': { normalizeEmail: value => value.trim().toLowerCase() },
    '@/src/auth/http': { hasSameOrigin: () => sameOrigin },
    '@/src/auth/prisma': { prisma: { ...tx, $transaction: callback => callback(tx) } },
    '@/src/auth/session-cookie': { requestSessionToken: () => 'session-token' },
    '@/src/auth/sessions': { readSession: async () => session },
  };
  vm.runInNewContext(compiled, {
    exports, require: name => {
      if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
      return deps[name];
    }, Response, Date, JSON, Number, console,
  });
  return exports;
}

const superadmin = { user: { id: 'superadmin-account' }, status: { restricted: false, roles: ['superadmin'] } };
const request = body => ({ cookies: { get: () => null }, json: async () => body });
const member = { kind: 'member', firstName: 'Maria', middleName: '', lastName: 'Santos', suffix: '',
  email: ' Maria@Example.test ', phone: '+63 917 123 4567', plan: 'Premium' };

test('managed users require an unrestricted Super Admin session and same-origin writes', async () => {
  const tx = { roleProfile: { findMany: async () => { throw new Error('Unexpected query'); } } };
  assert.equal((await routeFor({ session: null, tx }).GET(request())).status, 401);
  assert.equal((await routeFor({ session: { ...superadmin, status: { restricted: true, roles: ['superadmin'] } }, tx }).GET(request())).status, 403);
  assert.equal((await routeFor({ session: { ...superadmin, status: { restricted: false, roles: ['admin'] } }, tx }).GET(request())).status, 403);
  assert.equal((await routeFor({ session: null, tx }).POST(request(member))).status, 401);
  assert.equal((await routeFor({ session: superadmin, sameOrigin: false, tx }).POST(request(member))).status, 403);
});

test('member registration saves plan interest without creating a purchased membership or login', async () => {
  const calls = [];
  const tx = {
    $executeRaw: async () => {},
    gymPlan: { findUnique: async () => ({ name: 'Premium' }) },
    authUser: { findUnique: async () => null },
    user: {
      findUnique: async () => null,
      create: async ({ data }) => { calls.push(['user', data]); return { id: 7, ...data, oauthIdentity: null }; },
    },
    roleProfile: { create: async ({ data }) => { calls.push(['role', data]); return { id: 'profile-1' }; } },
    memberProfile: { create: async ({ data }) => { calls.push(['member', data]); } },
    auditEvent: { create: async () => {} },
  };
  const route = routeFor({ session: superadmin, tx });
  const response = await route.POST(request(member));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: 'profile-1' });
  assert.equal(calls.find(([kind]) => kind === 'user')[1].email, 'maria@example.test');
  assert.equal(calls.find(([kind]) => kind === 'role')[1].role, 'member');
  assert.equal(calls.find(([kind]) => kind === 'member')[1].profileId, 'profile-1');
  assert.equal(calls.find(([kind]) => kind === 'member')[1].planInterest, 'Premium');
  assert.equal((await route.POST(request({ ...member, email: 'bad' }))).status, 400);
});

test('matching an existing email cannot silently grant another Account role', async () => {
  let created = false;
  const tx = {
    $executeRaw: async () => {},
    gymPlan: { findUnique: async () => ({ name: 'Premium' }) },
    user: { findUnique: async () => ({ id: 7 }), create: async () => { created = true; } },
    auditEvent: { create: async () => {} },
  };
  const response = await routeFor({ session: superadmin, tx }).POST(request(member));
  assert.equal(response.status, 409);
  assert.equal(created, false);
});

test('archive and restore change the persisted role state', async () => {
  const updates = [];
  let archivedAt = null;
  const tx = {
    roleProfile: {
      findFirst: async () => ({ id: 'profile-1', archivedAt, gymUser: { oauthIdentity: null } }),
      update: async ({ data }) => { archivedAt = data.archivedAt; updates.push(data); },
    },
    assignedRole: { findFirst: async () => null },
    auditEvent: { create: async () => {} },
  };
  const route = routeFor({ session: superadmin, tx });
  assert.equal((await route.PATCH(request({ id: 'profile-1', kind: 'member', action: 'archive' }))).status, 200);
  assert.ok(archivedAt instanceof Date);
  assert.equal((await route.PATCH(request({ id: 'profile-1', kind: 'member', action: 'archive' }))).status, 409);
  assert.equal((await route.PATCH(request({ id: 'profile-1', kind: 'member', action: 'restore' }))).status, 200);
  assert.equal(archivedAt, null);
  assert.equal(updates.length, 2);
});

test('an online Account role cannot be archived through the record editor', async () => {
  let changed = false;
  const tx = {
    roleProfile: {
      findFirst: async () => ({ id: 'profile-1', archivedAt: null, gymUser: { oauthIdentity: { id: 'account-1' } } }),
      update: async () => { changed = true; },
    },
  };
  const response = await routeFor({ session: superadmin, tx }).PATCH(request({ id: 'profile-1', kind: 'member', action: 'archive' }));
  assert.equal(response.status, 409);
  assert.equal(changed, false);
});

test('bulk restore validates every selected role before updating any row', async () => {
  let changes = 0;
  const tx = {
    roleProfile: {
      findMany: async () => [{ id: 'profile-1', role: 'member', assignments: [], gymUser: { oauthIdentity: null } }],
      updateMany: async () => { changes++; },
    },
    auditEvent: { create: async () => {} },
  };
  const route = routeFor({ session: superadmin, tx });
  const invalid = await route.PATCH(request({ action: 'restore-many', users: [
    { id: 'profile-1', kind: 'member' }, { id: 'profile-2', kind: 'staff' },
  ] }));
  assert.equal(invalid.status, 409);
  assert.equal(changes, 0);
  const valid = await route.PATCH(request({ action: 'restore-many', users: [{ id: 'profile-1', kind: 'member' }] }));
  assert.equal(valid.status, 200);
  assert.equal(changes, 1);
});

test('the user list shows actual membership status and separate plan interest', async () => {
  const profile = { id: 'profile-1', role: 'member', status: 'Active', archivedAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'), gymUser: { name: 'Maria Santos', email: 'maria@example.test', phone: null },
    member: { joinedAt: new Date('2026-10-01T00:00:00Z'), planInterest: 'Premium', memberships: [] },
    trainer: null, staff: null };
  const tx = { roleProfile: { findMany: async () => [profile] } };
  const response = await routeFor({ session: superadmin, tx }).GET(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.members[0].status, 'No Membership');
  assert.equal(body.members[0].plan, 'Premium');
  assert.equal(body.members[0].planInterest, 'Premium');
  assert.equal(body.admins.length, 0);
});
