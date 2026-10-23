/* Unit tests for member self-service membership purchase.
 *
 * These tests verify the core business logic in src/auth/membership-purchase.ts
 * without needing a database or HTTP layer.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planPriceCentavos,
  addPlanPeriod,
  isMembershipPaymentMethod,
  MembershipPurchaseError,
} from '../src/auth/membership-purchase.ts';

test('planPriceCentavos converts peso floats to integer centavos', () => {
  assert.strictEqual(planPriceCentavos(1500), 150000);
  assert.strictEqual(planPriceCentavos(1499.5), 149950);
  assert.strictEqual(planPriceCentavos(0), 0);
  assert.strictEqual(planPriceCentavos(-100), -10000);
});

test('planPriceCentavos handles edge cases safely', () => {
  assert.strictEqual(planPriceCentavos(NaN), 0);
  assert.strictEqual(planPriceCentavos(Infinity), 0);
  assert.strictEqual(planPriceCentavos(-Infinity), 0);
  assert.strictEqual(planPriceCentavos(null), 0);
  assert.strictEqual(planPriceCentavos(undefined), 0);
  assert.strictEqual(planPriceCentavos('1500'), 0);
});

test('addPlanPeriod parses month periods correctly', () => {
  const from = new Date('2026-01-15T12:00:00Z');
  const result = addPlanPeriod(from, '1 month');

  assert.strictEqual(result.getMonth(), 1); // February
  assert.strictEqual(result.getDate(), 15);
});

test('addPlanPeriod parses day periods correctly', () => {
  const from = new Date('2026-01-15T12:00:00Z');
  const result = addPlanPeriod(from, '30 days');

  assert.strictEqual(result.getMonth(), 1); // February
  assert.strictEqual(result.getDate(), 14);
});

test('addPlanPeriod parses week periods correctly', () => {
  const from = new Date('2026-01-15T12:00:00Z');
  const result = addPlanPeriod(from, '2 weeks');

  assert.strictEqual(result.getDate(), 29);
});

test('addPlanPeriod parses year periods correctly', () => {
  const from = new Date('2026-01-15T12:00:00Z');
  const result = addPlanPeriod(from, '1 year');

  assert.strictEqual(result.getFullYear(), 2027);
  assert.strictEqual(result.getMonth(), 0); // January
  assert.strictEqual(result.getDate(), 15);
});

test('addPlanPeriod clamps day when adding months (Jan 31 → Feb 28)', () => {
  const from = new Date('2026-01-31T12:00:00Z');
  const result = addPlanPeriod(from, '1 month');

  // 2026 is not a leap year, so Feb has 28 days
  assert.strictEqual(result.getMonth(), 1); // February
  assert.strictEqual(result.getDate(), 28);
});

test('addPlanPeriod falls back to 1 month for unparseable periods', () => {
  const from = new Date('2026-01-15T12:00:00Z');
  const result = addPlanPeriod(from, 'forever');

  // Falls back to 1 month from the 'from' date
  assert.strictEqual(result.getMonth(), 1); // February (1 month from January)
  assert.strictEqual(result.getDate(), 15);
});

test('addPlanPeriod falls back to 1 month for null/undefined', () => {
  const from = new Date('2026-01-15T12:00:00Z');
  const resultNull = addPlanPeriod(from, null);
  const resultUndefined = addPlanPeriod(from, undefined);

  // Falls back to 1 month from the 'from' date
  assert.strictEqual(resultNull.getMonth(), 1); // February
  assert.strictEqual(resultUndefined.getMonth(), 1); // February
});

test('isMembershipPaymentMethod validates payment methods', () => {
  assert.strictEqual(isMembershipPaymentMethod('Cash'), true);
  assert.strictEqual(isMembershipPaymentMethod('GCash'), true);
  assert.strictEqual(isMembershipPaymentMethod('Card'), true);
  assert.strictEqual(isMembershipPaymentMethod('PayPal'), false);
  assert.strictEqual(isMembershipPaymentMethod(''), false);
  assert.strictEqual(isMembershipPaymentMethod(null), false);
  assert.strictEqual(isMembershipPaymentMethod(undefined), false);
  assert.strictEqual(isMembershipPaymentMethod(123), false);
});

test('MembershipPurchaseError carries status and code', () => {
  const err = new MembershipPurchaseError(404, 'PLAN_NOT_FOUND', 'No such plan.');

  assert.strictEqual(err.status, 404);
  assert.strictEqual(err.code, 'PLAN_NOT_FOUND');
  assert.strictEqual(err.message, 'No such plan.');
  assert.strictEqual(err.name, 'MembershipPurchaseError');
  assert.ok(err instanceof Error);
});
