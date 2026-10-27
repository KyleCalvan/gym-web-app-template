import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { getCoachingSessionPricePhp } from '../src/member/coachingPrice.ts';

const trainer = {
  profileId: 'trainer-1',
  specialty: 'Strength', certifications: '', sessionPrice: 0,
  profile: { archivedAt: null, status: 'Active', gymUser: { name: 'Test Trainer' } },
  availability: [{ id: 'slot-1', startsAt: new Date('2030-01-02T01:00:00Z'),
    endsAt: new Date('2030-01-02T02:00:00Z'), status: 'available' }],
};

function loadRoute(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    process, console, Response, URL, Date, Intl, setTimeout,
  }, { filename: file });
  return exports;
}

test('a trainer listed for booking with the default price can start checkout at the displayed rate', async () => {
  const originalOrigin = process.env.NEXTAUTH_URL;
  const originalKey = process.env.PAYMONGO_SECRET_KEY;
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.PAYMONGO_SECRET_KEY = 'sk_test_fixture';
  try {
    let chargedCentavos;
    let reservedAmount;
    const prisma = {
      trainerProfile: {
        findMany: async () => [trainer],
        findUnique: async () => trainer,
      },
      coachingSession: { findMany: async () => [] },
      assignedRole: { findUnique: async () => ({ profile: { member: { profileId: 'member-1' } } }) },
      trainerAvailability: { findMany: async () => trainer.availability },
      paymentTransaction: { update: async () => ({}) },
      $transaction: async callback => callback({
        paymentTransaction: { create: async () => ({ id: 'payment-1' }) },
        coachingSession: { create: async ({ data }) => {
          reservedAmount = data.amount;
          return { id: 'booking-1' };
        } },
        transactionItem: { create: async () => ({}) },
      }),
    };
    const shared = {
      'next/server': {},
      '@/src/auth/sessions': { readSession: async () => ({ user: { id: 'account-1', email: 'member@example.test', name: 'Test Member' }, status: { restricted: false, roles: ['member'] } }) },
      '@/src/auth/session-cookie': { requestSessionToken: () => 'fixture' },
      '@/src/auth/prisma': { prisma },
      '@/src/member/coachingPrice': { getCoachingSessionPricePhp },
      '@/src/paymongo/cancelCoachingCheckout': { releaseAbandonedCoachingCheckouts: async () => {} },
    };
    const options = loadRoute('../app/api/member/coaching-options/route.ts', shared);
    const listed = await options.GET({});
    assert.equal(listed.status, 200);
    const { trainers } = await listed.json();
    assert.equal(trainers.length, 1);
    assert.equal(trainers[0].sessionPrice, 900);

    const checkout = loadRoute('../app/api/member/coaching-checkout/route.ts', {
      ...shared,
      '@/src/member/bookingDates': { getBookingDatesError: () => null },
      '@/src/paymongo/checkout': { createTestCheckout: async ({ amountCentavos }) => {
        chargedCentavos = amountCentavos;
        return { id: 'checkout-1', url: 'https://checkout.example.test/' };
      } },
      'node:crypto': { randomUUID: () => 'fixture' },
    });
    const response = await checkout.POST({
      headers: { get: name => name === 'origin' ? 'http://localhost:3000' : null },
      json: async () => ({ trainerId: trainers[0].id, dates: ['2030-01-02'], time: '09:00', expectedTotal: 900 }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, body.error);
    assert.equal(body.checkoutUrl, 'https://checkout.example.test/');
    assert.equal(reservedAmount, 900);
    assert.equal(chargedCentavos, 90_000);
  } finally {
    if (originalOrigin === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = originalOrigin;
    if (originalKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
    else process.env.PAYMONGO_SECRET_KEY = originalKey;
  }
});
