import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/api/trainer/availability/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const trainer = { user: { id: 'account-1' }, status: { restricted: false, roles: ['trainer'] } };
const assignment = { profile: { trainer: { profileId: 'trainer-1' }, gymUser: { name: 'James Reyes' } } };
const day = '2099-01-03';
const at = time => new Date(`${day}T${time}:00+08:00`);

function setup({ session = trainer, sameOrigin = true, slots = [], bookings = [] } = {}) {
  const records = [...slots];
  const prisma = {
    assignedRole: { findUnique: async () => assignment },
    trainerAvailability: {
      findMany: async () => [...records],
      create: async ({ data }) => {
        const row = { id: `slot-${records.length + 1}`, ...data };
        records.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = records.find(item => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }) => { records.splice(records.findIndex(item => item.id === where.id), 1); },
    },
    coachingSession: { findMany: async () => bookings },
    $executeRaw: async () => {},
    $transaction: async action => action(prisma),
  };
  const dependencies = {
    'next/server': {},
    '@/src/auth/prisma': { prisma },
    '@/src/auth/sessions': { readSession: async () => session },
    '@/src/auth/session-cookie': { requestSessionToken: () => 'fixture' },
    '@/src/auth/http': { hasSameOrigin: () => sameOrigin },
    '@/src/member/bookingDates': { getBookingToday: () => '2099-01-01', getBookingCurrentTime: () => '08:00' },
    '@/src/trainer/availability': { timeInMinutes: value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    Response, Date, Intl, console,
  });
  return { route: exports, records };
}

const request = body => ({ json: async () => body });
const slot = (id, start, end, status = 'available') => ({ id, trainerId: 'trainer-1',
  startsAt: at(start), endsAt: at(end), status });

test('trainer schedule requires an unrestricted assigned trainer and same-origin writes', async () => {
  assert.equal((await setup({ session: null }).route.GET(request({}))).status, 401);
  assert.equal((await setup({ session: { ...trainer, status: { restricted: true, roles: ['trainer'] } } }).route.GET(request({}))).status, 403);
  assert.equal((await setup({ session: { ...trainer, status: { restricted: false, roles: ['member'] } } }).route.GET(request({}))).status, 403);
  assert.equal((await setup({ sameOrigin: false }).route.POST(request({ date: day, startTime: '09:00', endTime: '10:00', status: 'available' }))).status, 403);
});

test('trainer can create, read, update, and delete persisted availability', async () => {
  const { route, records } = setup();
  const created = await route.POST(request({ date: day, startTime: '09:00', endTime: '11:00', status: 'available' }));
  assert.equal(created.status, 201);
  const saved = (await created.json()).availability;
  assert.equal(saved.trainerId, 'trainer-1');
  assert.equal(records.length, 1);
  const list = await route.GET(request({}));
  assert.equal(list.headers.get('cache-control'), 'private, no-store');
  assert.equal((await list.json()).availability[0].id, saved.id);
  const changed = await route.PATCH(request({ id: saved.id, date: day, startTime: '10:00', endTime: '12:00', status: 'unavailable' }));
  assert.equal(changed.status, 200);
  assert.equal(records[0].status, 'unavailable');
  assert.equal((await route.DELETE(request({ id: saved.id }))).status, 200);
  assert.equal(records.length, 0);
});

test('schedule changes reject overlaps and preserve an active booked hour', async () => {
  const bookings = [{ id: 'booking-1', startsAt: at('10:00') }];
  const { route, records } = setup({ slots: [slot('slot-1', '09:00', '12:00')], bookings });
  assert.equal((await route.POST(request({ date: day, startTime: '11:00', endTime: '13:00', status: 'available' }))).status, 409);
  assert.equal((await route.PATCH(request({ id: 'slot-1', date: day, startTime: '09:00', endTime: '10:30', status: 'available' }))).status, 409);
  assert.equal((await route.DELETE(request({ id: 'slot-1' }))).status, 409);
  assert.equal(records.length, 1);
  assert.equal(records[0].endsAt.toISOString(), at('12:00').toISOString());
  assert.equal((await route.PATCH(request({ id: 'other-trainer-slot', date: day, startTime: '09:00', endTime: '12:00', status: 'available' }))).status, 404);
});
