import { NextRequest } from 'next/server';
import { prisma } from '@/src/auth/prisma';
import { DEMO_SESSION_COOKIE, isDemoLoginEnabled, readDemoSessionToken } from '@/src/auth/demo-session';
import { retrieveCheckout } from '@/src/paymongo/checkout';
import { fulfillDemoCheckout } from '@/src/paymongo/demoCheckout';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!isDemoLoginEnabled()) return Response.json({ error: 'Demo checkout is unavailable.' }, { status: 404 });
  const session = readDemoSessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
  if (session?.role !== 'member') return Response.json({ error: 'Member demo access is required.' }, { status: 403 });
  const reference = request.nextUrl.searchParams.get('reference');
  if (!reference || !/^DEMO-[0-9a-f-]{36}$/.test(reference)) {
    return Response.json({ error: 'Invalid checkout reference.' }, { status: 400 });
  }
  const transaction = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!transaction || transaction.customerName !== session.name || !transaction.isSimulated) {
    return Response.json({ error: 'Checkout was not found.' }, { status: 404 });
  }
  if (transaction.status === 'Pending' && transaction.paymongoCheckoutId) {
    try { await fulfillDemoCheckout(await retrieveCheckout(transaction.paymongoCheckoutId)); }
    catch (error) {
      console.error('PayMongo demo checkout status could not be verified:', error);
      return Response.json({ error: 'Payment status could not be verified. Please retry.' }, { status: 502 });
    }
  }
  const updated = await prisma.paymentTransaction.findUniqueOrThrow({ where: { reference }, select: { status: true } });
  return Response.json({ status: updated.status });
}
