import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/api/trainer/sessions/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadRoute({ session, prisma, sameOrigin = true }) {
  const exports = {};
  const dependencies = {
    'next/server': {},
    '@/src/auth/sessions': { readSession: async () => session },
    '@/src/auth/session-cookie': { requestSessionToken: () => 'fixture' },
    '@/src/auth/http': { hasSameOrigin: () => sameOrigin },
    '@/src/auth/prisma': { prisma },
    '@/src/member/activityDates': { gymDateISO: date => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(date);
      const part = type => parts.find(value => value.type === type).value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    } },
  };
  vm.runInNewContext(compiled, {
    exports, require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    Response, Date, Intl, console,
  });
  return exports;
}

const trainer = { user: { id: 'trainer-account' }, status: { restricted: false, roles: ['trainer'] } };
const assignment = { profile: { trainer: { profileId: 'trainer-profile' } } };

test('trainer sessions require an unrestricted trainer account', async () => {
  const prisma = {};
  assert.equal((await loadRoute({ session: null, prisma }).GET({})).status, 401);
  assert.equal((await loadRoute({ session: { ...trainer, status: { restricted: true, roles: ['trainer'] } }, prisma }).GET({})).status, 403);
  assert.equal((await loadRoute({ session: { ...trainer, status: { restricted: false, roles: ['member'] } }, prisma }).GET({})).status, 403);
});

test('trainer sessions use the assigned profile ID and format database records', async () => {
  let query;
  const prisma = {
    assignedRole: { findUnique: async () => assignment },
    coachingSession: { findMany: async value => {
      query = value;
      return [{ id: 'session-1', startsAt: new Date('2026-10-28T02:30:00Z'),
        type: 'Personal Training', status: 'Confirmed', rating: null,
        member: { profile: { gymUser: { name: 'Maria Santos' } } } }];
    } },
  };
  const response = await loadRoute({ session: trainer, prisma }).GET({});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(query.where.trainerId, 'trainer-profile');
  assert.equal(query.select.rating, true);
  assert.deepEqual(await response.json(), { sessions: [{ id: 'session-1', member: 'Maria Santos',
    date: '2026-10-28', time: '10:30', type: 'Personal Training', status: 'Confirmed', rating: null }] });
});

test('trainer session writes are scoped to confirmed sessions and save schedule requests', async () => {
  let update;
  let created;
  const prisma = {
    assignedRole: { findUnique: async () => assignment },
    coachingSession: {
      updateMany: async value => { update = value; return { count: value.where.id === 'own' ? 1 : 0 }; },
      findFirst: async value => value.where.id === 'own' ? { id: 'own' } : null,
    },
    scheduleChangeRequest: { create: async value => { created = value; } },
  };
  const route = loadRoute({ session: trainer, prisma });
  const request = body => ({ json: async () => body });
  assert.equal((await route.PATCH(request({ id: 'other', action: 'complete' }))).status, 409);
  const completed = await route.PATCH(request({ id: 'own', action: 'complete' }));
  assert.equal(completed.status, 200);
  assert.equal(update.where.trainerId, 'trainer-profile');
  assert.equal(update.where.status, 'Confirmed');
  assert.equal(update.data.status, 'Completed');
  assert.equal((await route.PATCH(request({ id: 'own', action: 'cancel', reason: '' }))).status, 400);
  const cancelled = await route.PATCH(request({ id: 'own', action: 'cancel', reason: '  Conflict  ' }));
  assert.equal(cancelled.status, 200);
  assert.equal(update.data.cancellationReason, 'Conflict');
  assert.equal((await route.POST(request({ id: 'other', newDateTime: '2099-01-03T10:00', reason: 'Conflict' }))).status, 409);
  assert.equal((await route.POST(request({ id: 'own', newDateTime: '2099-01-03T10:00', reason: 'Conflict' }))).status, 201);
  assert.equal(created.data.coachingSessionId, 'own');
  assert.equal(created.data.requestedByAccountId, 'trainer-account');
  assert.equal(created.data.requestedStartsAt.toISOString(), '2099-01-03T02:00:00.000Z');
  assert.equal((await loadRoute({ session: trainer, prisma, sameOrigin: false }).PATCH(request({ id: 'own', action: 'complete' }))).status, 403);
});
