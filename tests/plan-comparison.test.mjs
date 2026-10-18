import test from 'node:test';
import assert from 'node:assert/strict';
import {
  comparePlans,
  buildCancelConfirmation,
  planDurationMonths,
} from '../src/member/planComparison.ts';

const basePlan = (overrides = {}) => ({
  name: 'Premium',
  price: 2499,
  period: 'mo',
  members: 1,
  perks: ['Unlimited Access', 'Group Classes'],
  featured: true,
  status: 'Active',
  category: 'Standard',
  description: 'Full access with classes.',
  restrictions: ['No guest passes'],
  sessionLimit: 8,
  facilities: ['Main floor', 'Group studio'],
  includedBenefits: ['Unlimited Access', 'Group Classes', 'Free Towels'],
  excludedBenefits: [],
  ...overrides,
});

const member = { id: 'M-1001', plan: 'Premium' };

test('comparePlans flags the member\'s current plan and computes the price diff', () => {
  const current = basePlan();
  const elite = basePlan({ name: 'Elite', price: 4500, perks: ['All Premium Perks', '1 PT Session/mo', 'Dietary Plan', 'VIP Lounge'], includedBenefits: ['All Premium Perks', '1 PT Session/mo', 'Dietary Plan', 'VIP Lounge'], facilities: ['Main floor', 'Group studio', 'PT studio', 'VIP lounge'] });
  const diff = comparePlans(current, elite, member);
  assert.equal(diff.isCurrent, false);
  assert.equal(diff.priceDiff, 2001);
  assert.equal(diff.isUpgrade, true);
  assert.equal(diff.isDowngrade, false);
});

test('comparePlans reports benefits that are added, removed, and shared vs current', () => {
  const current = basePlan();
  const lite = basePlan({
    name: 'Basic',
    price: 1200,
    perks: ['Gym Access', 'Locker Use'],
    includedBenefits: ['Gym Access', 'Locker Use'],
    facilities: ['Main floor'],
    sessionLimit: 4,
    restrictions: ['No group classes'],
  });
  const diff = comparePlans(current, lite, member);
  assert.deepEqual(diff.addedBenefits.sort(), ['Gym Access', 'Locker Use'].sort());
  assert.deepEqual(diff.removedBenefits.sort(), ['Free Towels', 'Group Classes', 'Unlimited Access'].sort());
  assert.equal(diff.sharedBenefits.length, 0);
  assert.equal(diff.sessionLimitDiff, -4);
  assert.deepEqual(diff.newRestrictions, ['No group classes']);
});

test('comparePlans marks the current plan with isCurrent and zero diffs', () => {
  const current = basePlan();
  const diff = comparePlans(current, current, member);
  assert.equal(diff.isCurrent, true);
  assert.equal(diff.priceDiff, 0);
  assert.equal(diff.addedBenefits.length, 0);
  assert.equal(diff.removedBenefits.length, 0);
});

test('comparePlans surfaces an active promo discount when one applies to the new plan', () => {
  const current = basePlan();
  const elite = basePlan({ name: 'Elite', price: 4500, includedBenefits: ['All Premium Perks', 'PT', 'Diet'] });
  const promotions = [{
    id: 'p1', status: 'Published', code: 'WELCOME20', discountType: 'Percentage', discount: '20',
    validFrom: '2026-01-01', validUntil: '2026-12-31', plan: 'Any', minSpend: 0,
    maxRedemptions: 100, redemptions: 0,
  }];
  const redemptions = [{ memberId: 'M-1001', promotionId: 'p1' }];
  const diff = comparePlans(current, elite, member, promotions, redemptions, '2026-06-01');
  assert.equal(diff.discount.discountedPrice, 3600);
  assert.equal(diff.discount.savings, 900);
  assert.equal(diff.discount.promo.code, 'WELCOME20');
});

test('comparePlans leaves discount null when no promo applies', () => {
  const current = basePlan();
  const lite = basePlan({ name: 'Basic', price: 1200, includedBenefits: ['Gym'] });
  const diff = comparePlans(current, lite, member, [], [], '2026-06-01');
  assert.equal(diff.discount, null);
});

test('planDurationMonths derives 1 for mo and 12 for yr', () => {
  assert.equal(planDurationMonths({ period: 'mo' }), 1);
  assert.equal(planDurationMonths({ period: 'year' }), 12);
  assert.equal(planDurationMonths({ period: 'yr' }), 12);
  assert.equal(planDurationMonths({}), 1);
});

test('buildCancelConfirmation returns the destructive intent and member state', () => {
  const conf = buildCancelConfirmation(member, basePlan(), { reason: 'Too expensive' });
  assert.equal(conf.intent, 'cancel');
  assert.equal(conf.memberId, 'M-1001');
  assert.equal(conf.planName, 'Premium');
  assert.equal(conf.reason, 'Too expensive');
  assert.match(conf.summary, /Cancel Premium/);
});
