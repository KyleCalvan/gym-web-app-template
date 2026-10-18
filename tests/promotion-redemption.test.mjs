import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDiscountedPrice,
  promotionAppliesToPlan,
  promotionTargetsAllPlans,
  promotionMeetsMinSpend,
  getRedeemedPromotions,
  getActivePromotionsForMember,
  findRedeemablePromotion,
} from '../src/member/promotionEligibility.ts';

const promo = (overrides = {}) => ({
  id: 'promo-1',
  title: 'New Member Starter Pack',
  discountType: 'Percentage',
  discount: '20',
  validFrom: '2026-10-01',
  validUntil: '2026-10-31',
  plan: 'Any',
  code: 'WELCOME20',
  maxRedemptions: 100,
  redemptions: 0,
  minSpend: 1500,
  status: 'Published',
  ...overrides,
});

const member = { id: 'M-1001', plan: 'Premium' };

test('computeDiscountedPrice applies percentage and fixed discounts', () => {
  assert.equal(computeDiscountedPrice(promo(), 2499), 1999); // 2499 * 0.8 = 1999.2 -> round
  assert.equal(computeDiscountedPrice(promo({ discountType: 'Fixed', discount: '500' }), 900), 400);
});

test('computeDiscountedPrice never goes below zero and rejects bundle/custom', () => {
  assert.equal(computeDiscountedPrice(promo({ discountType: 'Fixed', discount: '5000' }), 900), 0);
  assert.equal(computeDiscountedPrice(promo({ discountType: 'Bundle', discount: '2-for-1' }), 900), null);
  assert.equal(computeDiscountedPrice(promo({ discount: 'abc' }), 900), null);
  assert.equal(computeDiscountedPrice(promo(), 0), null);
});

test('promotionAppliesToPlan matches Any and exact plan names, case-insensitive', () => {
  assert.equal(promotionAppliesToPlan(promo(), 'Premium'), true);
  assert.equal(promotionAppliesToPlan(promo({ plan: 'Any Plan' }), 'Basic'), true);
  assert.equal(promotionAppliesToPlan(promo({ plan: 'Elite' }), 'Premium'), false);
  assert.equal(promotionAppliesToPlan(promo({ plan: 'elite' }), 'Elite'), true);
  assert.equal(promotionAppliesToPlan(promo(), ''), false);
});

test('promotionTargetsAllPlans only true for Any / Any Plan', () => {
  assert.equal(promotionTargetsAllPlans(promo()), true);
  assert.equal(promotionTargetsAllPlans(promo({ plan: 'Premium' })), false);
});

test('promotionMeetsMinSpend checks spend against minimum', () => {
  assert.equal(promotionMeetsMinSpend(promo(), 1500), true);
  assert.equal(promotionMeetsMinSpend(promo(), 1499), false);
  assert.equal(promotionMeetsMinSpend(promo({ minSpend: 0 }), 100), true);
});

test('getRedeemedPromotions returns only promos redeemed by that member', () => {
  const promos = [promo(), promo({ id: 'promo-2', code: 'OTHER' })];
  const redemptions = [
    { memberId: 'M-1001', promotionId: 'promo-1' },
    { memberId: 'M-1002', promotionId: 'promo-2' },
  ];
  assert.deepEqual(getRedeemedPromotions(promos, redemptions, 'M-1001').map(p => p.id), ['promo-1']);
  assert.deepEqual(getRedeemedPromotions(promos, redemptions, null), []);
});

test('getActivePromotionsForMember returns redeemed promos that are still valid and eligible', () => {
  const promos = [
    promo(), // redeemed + valid
    promo({ id: 'promo-2', code: 'EXPIRED', validUntil: '2026-10-10' }), // redeemed but expired
    promo({ id: 'promo-3', code: 'NOTYET', validFrom: '2026-11-01' }), // redeemed but future
  ];
  const redemptions = [
    { memberId: 'M-1001', promotionId: 'promo-1' },
    { memberId: 'M-1001', promotionId: 'promo-2' },
    { memberId: 'M-1001', promotionId: 'promo-3' },
  ];
  assert.deepEqual(
    getActivePromotionsForMember(promos, redemptions, member, '2026-10-17').map(p => p.id),
    ['promo-1'],
  );
});

test('findRedeemablePromotion accepts a valid eligible code case-insensitively', () => {
  const result = findRedeemablePromotion([promo()], [], member, ' welcome20 ', '2026-10-17');
  assert.equal(result.error, null);
  assert.equal(result.promotion?.id, 'promo-1');
});

test('findRedeemablePromotion rejects unknown, unpublished, expired, wrong-plan, sold-out, and already-redeemed codes', () => {
  const promos = [promo()];
  assert.equal(findRedeemablePromotion(promos, [], member, 'NOPE', '2026-10-17').error, 'Invalid promotion code');
  assert.match(findRedeemablePromotion([promo({ status: 'Draft' })], [], member, 'WELCOME20', '2026-10-17').error, /not available/);
  assert.match(findRedeemablePromotion(promos, [], member, 'WELCOME20', '2026-11-01').error, /expired|not yet/i);
  assert.match(findRedeemablePromotion([promo({ plan: 'Elite' })], [], member, 'WELCOME20', '2026-10-17').error, /plan/i);
  assert.match(findRedeemablePromotion([promo({ maxRedemptions: 5, redemptions: 5 })], [], member, 'WELCOME20', '2026-10-17').error, /fully redeemed/i);
  const redemptions = [{ memberId: 'M-1001', promotionId: 'promo-1' }];
  assert.match(findRedeemablePromotion(promos, redemptions, member, 'WELCOME20', '2026-10-17').error, /already redeemed/i);
});
