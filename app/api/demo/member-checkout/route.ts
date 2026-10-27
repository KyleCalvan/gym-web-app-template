import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/src/auth/prisma';
import { DEMO_SESSION_COOKIE, isDemoLoginEnabled, readDemoSessionToken } from '@/src/auth/demo-session';
import { createTestCheckout } from '@/src/paymongo/checkout';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isDemoLoginEnabled()) return Response.json({ error: 'Demo checkout is unavailable.' }, { status: 404 });
  const origin = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const session = readDemoSessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
  if (session?.role !== 'member') return Response.json({ error: 'Member demo access is required.' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const data = body as { description?: unknown; amount?: unknown } | null;
  const description = data?.description;
  const amount = data?.amount;
  const centavos = typeof amount === 'number' ? Math.round(amount * 100) : NaN;
  if (typeof description !== 'string' || !description.trim() || description.length > 150
    || !Number.isSafeInteger(centavos) || centavos < 100 || centavos > 10_000_000) {
    return Response.json({ error: 'Invalid test payment.' }, { status: 400 });
  }
  if (!process.env.PAYMONGO_SECRET_KEY?.trim().startsWith('sk_test_')) {
    return Response.json({ error: 'PayMongo test checkout is not configured yet.' }, { status: 503 });
  }
  const reference = `DEMO-${randomUUID()}`;
  const transaction = await prisma.paymentTransaction.create({ data: {
    reference, customerName: session.name, type: description.trim(), method: 'GCash',
    amount: centavos / 100, status: 'Pending', paymentState: 'Pending', isSimulated: true,
    items: { create: { description: description.trim(), quantity: 1,
      unitPrice: centavos / 100, total: centavos / 100 } },
  } });
  try {
    const checkout = await createTestCheckout({ reference, description: description.trim(),
      amountCentavos: centavos, email: session.email, name: session.name, returnPath: '/login' });
    await prisma.paymentTransaction.update({ where: { id: transaction.id },
      data: { paymongoCheckoutId: checkout.id } });
    return Response.json({ checkoutUrl: checkout.url, reference });
  } catch (error) {
    console.error('PayMongo demo checkout could not start:', error);
    await prisma.paymentTransaction.update({ where: { id: transaction.id },
      data: { status: 'Failed', paymentState: 'Failed' } });
    return Response.json({ error: 'Checkout could not start. Please try again.' }, { status: 502 });
  }
}
