import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StaffPaymentReceipt from '../src/staff/StaffPaymentReceipt';
import type { Transaction } from '../src/types';

test('staff receipt view shows the recorded sale and print action', () => {
  const transaction: Transaction = {
    id: 'payment-1', receiptNumber: 'VA-20261030-1234',
    transactionReference: 'PAY-20261030-1234', member: 'Maria Santos',
    type: 'Membership: Monthly', amount: 4500, fees: 0,
    method: 'Cash', date: 'Oct 30, 2026', status: 'Paid', paymentState: 'Successful',
  };
  const html = renderToStaticMarkup(createElement(StaffPaymentReceipt, {
    transaction, member: { id: 'member-1', name: 'Maria Santos', email: 'maria@example.test' },
    onBack: () => {}, onClose: () => {},
  }));
  assert.match(html, /Receipt no\./);
  assert.match(html, /VA-20261030-1234/);
  assert.match(html, /Maria Santos/);
  assert.match(html, /Total paid/);
  assert.match(html, /₱4,500\.00/);
  assert.match(html, /Print \/ save PDF/);
});
