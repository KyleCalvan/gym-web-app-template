import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { hasPaidGCashPayment, validTestWebhookSignature } from '../src/paymongo/validation.ts';

test('a checkout is paid only for the matching test order, amount, and GCash method', () => {
  const session = { id: 'cs_example', attributes: { livemode: false, reference_number: 'MEM-order',
    payments: [{ attributes: { amount: 150000, currency: 'PHP', status: 'paid', source: { type: 'gcash' } } }] } };
  assert.equal(hasPaidGCashPayment(session, 'MEM-order', 150000), true);
  assert.equal(hasPaidGCashPayment(session, 'MEM-other', 150000), false);
  assert.equal(hasPaidGCashPayment(session, 'MEM-order', 100000), false);
  assert.equal(hasPaidGCashPayment({ ...session, attributes: { ...session.attributes, livemode: true } }, 'MEM-order', 150000), false);
  assert.equal(hasPaidGCashPayment({ ...session, attributes: { ...session.attributes,
    payments: [{ attributes: { ...session.attributes.payments[0].attributes, status: 'pending' } }] } }, 'MEM-order', 150000), false);
});

test('test webhooks require an intact and recent te signature', () => {
  const body = JSON.stringify({ data: { type: 'event' } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const secret = 'whsec_test';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const header = `t=${timestamp},te=${signature},li=`;
  assert.equal(validTestWebhookSignature(header, body, secret), true);
  assert.equal(validTestWebhookSignature(header, `${body} `, secret), false);
  assert.equal(validTestWebhookSignature(`t=${Number(timestamp) - 600},te=${signature},li=`, body, secret), false);
  assert.equal(validTestWebhookSignature(`t=${timestamp},te=,li=${signature}`, body, secret), false);
});
