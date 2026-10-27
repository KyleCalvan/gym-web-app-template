import test from 'node:test';
import assert from 'node:assert/strict';
import { getEligiblePromotions } from '../src/member/promotionEligibility.ts';

const promo = (overrides = {}) => ({
  id: 'p-default',
  title: 'Member offer',
  status: 'Published',
  validFrom: '2026-10-01',
  validUntil: '2026-10-31',
  plan: 'Any',
  maxRedemptions: 10,
  redemptions: 1,
  ...overrides,
});

test('only returns published, in-date promotions matching the member plan with redemptions left', () => {
  const promos = [
    promo({ id: 'any' }),
    promo({ id: 'specific', plan: 'Premium' }),
    promo({ id: 'draft', status: 'Draft' }),
    promo({ id: 'expired', validUntil: '2026-10-16' }),
    promo({ id: 'future', validFrom: '2026-10-18' }),
    promo({ id: 'wrong-plan', plan: 'Elite' }),
    promo({ id: 'sold-out', maxRedemptions: 10, redemptions: 10 }),
  ];

  assert.deepEqual(
    getEligiblePromotions(promos, { plan: 'Premium' }, '2026-10-17').map((item) => item.id),
    ['any', 'specific'],
  );
});

test('treats no redemption cap as unlimited and sorts by nearest expiry', () => {
  const promos = [
    promo({ id: 'later', validUntil: '2026-10-30', maxRedemptions: 0, redemptions: 500 }),
    promo({ id: 'sooner', validUntil: 'Oct 20, 2026', plan: 'Any Plan' }),
  ];

  assert.deepEqual(
    getEligiblePromotions(promos, { plan: 'Basic' }, '2026-10-17').map((item) => item.id),
    ['sooner', 'later'],
  );
});

test('does not return promotions with missing or malformed validity dates', () => {
  const promos = [
    promo({ id: 'missing', validUntil: '' }),
    promo({ id: 'malformed', validFrom: 'not-a-date' }),
  ];

  assert.deepEqual(getEligiblePromotions(promos, { plan: 'Premium' }, '2026-10-17'), []);
});

test('shows Any Plan promotions to members who have not purchased a plan', () => {
  assert.deepEqual(getEligiblePromotions([
    promo({ id: 'any' }),
    promo({ id: 'specific', plan: 'Premium' }),
  ], { plan: '' }, '2026-10-17').map(item => item.id), ['any']);
});
