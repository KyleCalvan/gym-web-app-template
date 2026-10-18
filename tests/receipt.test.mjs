import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiptReference, getReceiptReference } from '../src/receipt.ts';

test('receipt references include a date and unique secure UUID', () => {
  const timestamp = new Date('2026-10-18T03:00:00.000Z');
  const first = createReceiptReference(timestamp);
  const second = createReceiptReference(timestamp);

  assert.match(first, /^VA-20261018-[0-9A-F-]{36}$/);
  assert.notEqual(first, second);
});

test('receipt references remain stable for legacy transactions without one', () => {
  const first = getReceiptReference({ id: 'TXN-8821' });
  assert.equal(first, getReceiptReference({ id: 'TXN-8821' }));
  assert.notEqual(first, getReceiptReference({ id: 'TXN-8822' }));
});
