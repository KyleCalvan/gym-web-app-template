import { createHmac, timingSafeEqual } from 'node:crypto';

export type CheckoutSession = {
  id: string;
  attributes: {
    checkout_url?: string;
    livemode?: boolean;
    reference_number?: string;
    payments?: {
      attributes?: { amount?: number; currency?: string; status?: string; source?: { type?: string } };
    }[];
  };
};

export function hasPaidGCashPayment(session: CheckoutSession, reference: string, expectedCentavos: number) {
  return session.attributes.livemode === false
    && session.attributes.reference_number === reference
    && session.attributes.payments?.some(payment =>
      payment.attributes?.status === 'paid'
      && payment.attributes.currency === 'PHP'
      && payment.attributes.amount === expectedCentavos
      && payment.attributes.source?.type === 'gcash') === true;
}

export function validTestWebhookSignature(header: string | null, body: string, secret: string) {
  const parts = Object.fromEntries((header ?? '').split(',').map(part => part.trim().split('=')));
  const timestamp = parts.t;
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const actual = parts.te;
  if (!actual || !/^[0-9a-f]{64}$/i.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}
