import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';
import { fulfillCheckout, retrieveCheckout } from '@/src/paymongo/checkout';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await readSession(requestSessionToken(request));
  if (!session) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (session.status.restricted || !session.status.roles.includes('member')) {
    return Response.json({ error: 'Member access is required.' }, { status: 403 });
  }
  const reference = request.nextUrl.searchParams.get('reference');
  if (!reference || !/^MEM-[0-9a-f-]{36}$/.test(reference)) {
    return Response.json({ error: 'Invalid checkout reference.' }, { status: 400 });
  }
  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: session.user.id, role: 'member' } },
    include: { profile: { include: { member: true } } },
  });
  const transaction = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!transaction || transaction.memberId !== assignment?.profile.member?.profileId) {
    return Response.json({ error: 'Checkout was not found.' }, { status: 404 });
  }
  if (transaction.status === 'Pending' && transaction.paymongoCheckoutId) {
    try {
      await fulfillCheckout(await retrieveCheckout(transaction.paymongoCheckoutId));
    } catch (error) {
      console.error('PayMongo test checkout status could not be verified:', error);
      return Response.json({ error: 'Payment status could not be verified. Please retry.' }, { status: 502 });
    }
  }
  const updated = await prisma.paymentTransaction.findUniqueOrThrow({ where: { reference },
    select: { status: true } });
  return Response.json({ status: updated.status });
}
