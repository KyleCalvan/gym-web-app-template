import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSimulatedTransaction,
  getConfiguredPaymentFee,
  updateSimulatedTransaction,
} from '../src/payments.ts';

test('simulated transactions start pending with unique references and configured fees', () => {
  process.env.NEXT_PUBLIC_GCASH_TEST_FEE_PHP = '12.5';
  const first = createSimulatedTransaction({
    member: 'Test Member',
    type: 'Membership',
    amount: 1000,
    method: 'GCash',
    date: '2026-10-18',
    fees: getConfiguredPaymentFee('GCash', 1000),
  });
  const second = createSimulatedTransaction({
    member: 'Test Member',
    type: 'Membership',
    amount: 1000,
    method: 'GCash',
    date: '2026-10-18',
    fees: getConfiguredPaymentFee('GCash', 1000),
  });
  assert.equal(first.status, 'Pending');
  assert.equal(first.paymentState, 'Pending');
  assert.equal(first.fees, 12.5);
  assert.equal(first.isSimulated, true);
  assert.notEqual(first.transactionReference, second.transactionReference);
});

test('configured fees are used as configured and invalid values are rejected', () => {
  process.env.NEXT_PUBLIC_GCASH_TEST_FEE_PHP = '150';
  assert.equal(getConfiguredPaymentFee('GCash', 100), 150);
  assert.equal(getConfiguredPaymentFee('Card', 100), 0);
  process.env.NEXT_PUBLIC_GCASH_TEST_FEE_PHP = '-1';
  assert.throws(() => getConfiguredPaymentFee('GCash', 100), /non-negative/);
  delete process.env.NEXT_PUBLIC_GCASH_TEST_FEE_PHP;
});

test('only a processing simulated transaction can become paid', () => {
  const transaction = createSimulatedTransaction({
    member: 'Test Member',
    type: 'Membership',
    amount: 1000,
    method: 'Card',
    date: '2026-10-18',
  });
  assert.throws(() => updateSimulatedTransaction(transaction, 'Successful'), /Invalid simulated payment transition/);
  const processing = updateSimulatedTransaction(transaction, 'Processing');
  const paid = updateSimulatedTransaction(processing, 'Successful');
  assert.equal(paid.status, 'Paid');
  assert.equal(paid.paymentState, 'Successful');
  const failed = updateSimulatedTransaction(processing, 'Failed');
  assert.equal(failed.status, 'Failed');
  assert.equal(failed.paymentState, 'Failed');
  const retry = updateSimulatedTransaction(failed, 'Processing');
  assert.equal(updateSimulatedTransaction(retry, 'Successful').status, 'Paid');
  assert.throws(() => updateSimulatedTransaction(paid, 'Failed'), /Invalid simulated payment transition/);
});
