import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadRoute(dependencies) {
  const source = readFileSync(new URL('../app/api/member/promotions/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    Response, Date, Intl,
  });
  return exports;
}

function dependencies(session, prisma) {
  return {
    'next/server': {},
    '@/src/auth/sessions': { readSession: async () => session },
    '@/src/auth/session-cookie': { requestSessionToken: () => 'fixture' },
    '@/src/auth/prisma': { prisma },
  };
}

test('member promotions require an unrestricted member session', async () => {
  const prisma = {};
  const request = {};
  assert.equal((await loadRoute(dependencies(null, prisma)).GET(request)).status, 401);
  assert.equal((await loadRoute(dependencies({ user: { id: 'a' }, status: { restricted: true, roles: ['member'] } }, prisma)).GET(request)).status, 403);
  assert.equal((await loadRoute(dependencies({ user: { id: 'a' }, status: { restricted: false, roles: ['trainer'] } }, prisma)).GET(request)).status, 403);
});

test('member promotions return current published offers for the member plan with redemption counts', async () => {
  let promotionQuery;
  let redemptionQuery;
  const prisma = {
    assignedRole: { findUnique: async () => ({ profile: { member: { profileId: 'member-1' } } }) },
    membership: { findFirst: async () => ({ planName: 'Premium' }) },
    promotion: { findMany: async query => {
      promotionQuery = query;
      return [
        { id: 'available', title: 'Offer', code: 'SAVE10', discountType: 'Percentage', discount: '10',
          validFrom: new Date('2026-10-01T00:00:00Z'), validUntil: new Date('2026-10-31T00:00:00Z'),
          planName: 'Premium', maxRedemptions: 5, minSpend: 100, status: 'Published',
          imageUrl: null, description: null, _count: { redemptions: 2 } },
        { id: 'full', maxRedemptions: 2, _count: { redemptions: 2 } },
      ];
    } },
    promotionRedemption: { findMany: async query => {
      redemptionQuery = query;
      return [{ id: 'redemption-1', memberId: 'member-1', promotionId: 'available', code: 'SAVE10',
        redeemedAt: new Date('2026-10-12T01:00:00Z') }];
    } },
  };
  const route = loadRoute(dependencies({
    user: { id: 'account-1' }, status: { restricted: false, roles: ['member'] },
  }, prisma));
  const response = await route.GET({});
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.promotions.length, 1);
  assert.deepEqual(result.promotions[0], {
    id: 'available', title: 'Offer', code: 'SAVE10', discountType: 'Percentage', discount: '10',
    validFrom: '2026-10-01', validUntil: '2026-10-31', plan: 'Premium', maxRedemptions: 5,
    redemptions: 2, minSpend: 100, status: 'Published',
  });
  assert.equal(result.promotionRedemptions[0].memberId, 'member-1');
  assert.equal(promotionQuery.where.status, 'Published');
  assert.equal(promotionQuery.where.deletedAt, null);
  assert.equal(promotionQuery.where.OR[1].planName, 'Premium');
  assert.equal(redemptionQuery.where.memberId, 'member-1');
  assert.equal(redemptionQuery.where.promotionId.in[0], 'available');
});
