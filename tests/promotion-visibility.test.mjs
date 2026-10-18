import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseLoginPromotion } from '../src/member/promotionVisibility.ts';

const promotion = (id, overrides = {}) => ({
  id,
  title: `Offer ${id}`,
  discountType: 'Percentage',
  discount: '10',
  validFrom: '2026-10-01',
  validUntil: '2026-10-31',
  plan: 'Any',
  code: id.toUpperCase(),
  maxRedemptions: 10,
  redemptions: 0,
  minSpend: 0,
  status: 'Published',
  ...overrides,
});

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test('a member sees each eligible login promotion at most once', () => {
  const storage = new MemoryStorage();
  const member = { id: 'M-1', plan: 'Premium' };
  const promos = [promotion('one'), promotion('two')];

  assert.equal(chooseLoginPromotion(promos, member, storage, '2026-10-17')?.id, 'one');
  assert.equal(chooseLoginPromotion(promos, member, storage, '2026-10-17')?.id, 'two');
  assert.equal(chooseLoginPromotion(promos, member, storage, '2026-10-17'), null);
});

test('a promotion dismissed by one member does not suppress it for another member', () => {
  const storage = new MemoryStorage();
  const offer = promotion('one');

  chooseLoginPromotion([offer], { id: 'M-1', plan: 'Premium' }, storage, '2026-10-17');
  assert.equal(chooseLoginPromotion([offer], { id: 'M-2', plan: 'Premium' }, storage, '2026-10-17')?.id, 'one');
});
