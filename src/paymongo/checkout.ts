import { prisma } from '@/src/auth/prisma';
import { hasPaidGCashPayment, type CheckoutSession } from './validation';

const API = 'https://api.paymongo.com';

export type { CheckoutSession } from './validation';

function secretKey() {
  const key = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!key || !key.startsWith('sk_test_')) throw new Error('PAYMONGO_TEST_KEY_MISSING');
  return key;
}

async function requestPaymongo(path: string, init?: RequestInit): Promise<CheckoutSession> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey()}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`PAYMONGO_HTTP_${response.status}`);
  const body: { data?: CheckoutSession } = await response.json();
  if (!body.data?.id || !body.data.attributes || body.data.attributes.livemode !== false) {
    throw new Error('PAYMONGO_INVALID_RESPONSE');
  }
  return body.data;
}

export async function createTestCheckout(input: {
  reference: string; description: string; amountCentavos: number; email: string; name: string;
  returnPath: '/account' | '/login'; method?: 'gcash' | 'card';
}) {
  const origin = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
  const result = await requestPaymongo('/v2/checkout_sessions', {
    method: 'POST',
    body: JSON.stringify({ data: { attributes: {
      line_items: [{ name: input.description, amount: input.amountCentavos,
        currency: 'PHP', quantity: 1 }],
      payment_method_types: [input.method ?? 'gcash'],
      success_url: `${origin}${input.returnPath}?checkout=success&reference=${encodeURIComponent(input.reference)}`,
      cancel_url: `${origin}${input.returnPath}?checkout=cancelled&reference=${encodeURIComponent(input.reference)}`,
      reference_number: input.reference,
      billing: { email: input.email, name: input.name },
    } } }),
  });
  const url = result.attributes.checkout_url;
  if (!url || new URL(url).origin !== 'https://checkout.paymongo.com') {
    throw new Error('PAYMONGO_INVALID_CHECKOUT_URL');
  }
  return { id: result.id, url };
}

export function createCheckout(input: {
  reference: string; planName: string; amountCentavos: number; email: string; name: string;
}) {
  return createTestCheckout({ ...input, description: `${input.planName} membership`, returnPath: '/account' });
}

export function retrieveCheckout(id: string) {
  if (!/^cs_[a-zA-Z0-9]+$/.test(id)) throw new Error('PAYMONGO_INVALID_SESSION_ID');
  return requestPaymongo(`/v1/checkout_sessions/${encodeURIComponent(id)}`);
}

export function expireCheckout(id: string) {
  if (!/^cs_[a-zA-Z0-9]+$/.test(id)) throw new Error('PAYMONGO_INVALID_SESSION_ID');
  return requestPaymongo(`/v1/checkout_sessions/${encodeURIComponent(id)}/expire`, { method: 'POST' });
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export async function fulfillCheckout(session: CheckoutSession) {
  const reference = session.attributes.reference_number;
  if (!reference || session.attributes.livemode !== false) return false;
  return prisma.$transaction(async tx => {
    const transaction = await tx.paymentTransaction.findUnique({
      where: { reference }, include: { items: true },
    });
    if (!transaction || (transaction.paymongoCheckoutId && transaction.paymongoCheckoutId !== session.id)
      || transaction.status === 'Failed') return false;
    if (transaction.status === 'Paid') return true;
    const item = transaction.items[0];
    if (!item?.planName || transaction.items.length !== 1) return false;
    if (!hasPaidGCashPayment(session, reference, Math.round(Number(transaction.amount) * 100))) return false;
    const plan = await tx.gymPlan.findUnique({ where: { name: item.planName } });
    if (!plan || !transaction.memberId) return false;
    const claimed = await tx.paymentTransaction.updateMany({
      where: { id: transaction.id, status: 'Pending' },
      data: { status: 'Paid', paymentState: 'Successful', paidAt: new Date(), paymongoCheckoutId: session.id },
    });
    if (claimed.count !== 1) {
      return (await tx.paymentTransaction.findUnique({ where: { id: transaction.id },
        select: { status: true } }))?.status === 'Paid';
    }
    const now = new Date();
    const prior = await tx.membership.findFirst({ where: { memberId: transaction.memberId },
      orderBy: { createdAt: 'desc' } });
    const isRenewal = prior?.planName === plan.name && prior.endsAt > now;
    const base = isRenewal ? prior.endsAt : now;
    const months = /year|^yr$|^y$/i.test(plan.period) ? 12 : 1;
    if (!isRenewal) await tx.membership.updateMany({
      where: { memberId: transaction.memberId, status: { in: ['Active', 'Expiring'] } },
      data: { status: 'Expired' },
    });
    const membership = await tx.membership.create({ data: {
      memberId: transaction.memberId, planName: plan.name, status: 'Active',
      startsAt: now, endsAt: addMonths(base, months),
    } });
    await tx.transactionItem.update({ where: { id: item.id }, data: { membershipId: membership.id } });
    return true;
  });
}
