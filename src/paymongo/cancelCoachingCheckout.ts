import { prisma } from '@/src/auth/prisma';
import { expireCheckout, retrieveCheckout } from './checkout';
import { fulfillCoachingCheckout } from './coachingCheckout';

export async function cancelCoachingCheckout(reference: string, memberId: string): Promise<'Paid' | 'Pending' | 'Failed'> {
  const transaction = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!transaction || transaction.memberId !== memberId || !reference.startsWith('COACH-')) {
    throw new Error('Checkout was not found.');
  }
  if (transaction.status !== 'Pending') return transaction.status === 'Paid' ? 'Paid' : 'Failed';
  if (!transaction.paymongoCheckoutId) return 'Pending';
  try {
    await expireCheckout(transaction.paymongoCheckoutId);
  } catch {
    const current = await retrieveCheckout(transaction.paymongoCheckoutId);
    if (await fulfillCoachingCheckout(current)) return 'Paid';
    if (current.attributes.status !== 'expired') return 'Pending';
  }
  await prisma.$transaction([
    prisma.paymentTransaction.updateMany({ where: { id: transaction.id, status: 'Pending' },
      data: { status: 'Failed', paymentState: 'Failed' } }),
    prisma.coachingSession.updateMany({
      where: { transactionItem: { transactionId: transaction.id }, status: 'Pending' },
      data: { status: 'Cancelled' },
    }),
  ]);
  return 'Failed';
}

export async function releaseAbandonedCoachingCheckouts() {
  const stale = await prisma.paymentTransaction.findMany({
    where: { reference: { startsWith: 'COACH-' }, status: 'Pending',
      createdAt: { lt: new Date(Date.now() - 30 * 60_000) }, memberId: { not: null } },
    select: { reference: true, memberId: true }, orderBy: { createdAt: 'asc' }, take: 10,
  });
  for (const transaction of stale) {
    if (!transaction.memberId) continue;
    try { await cancelCoachingCheckout(transaction.reference, transaction.memberId); }
    catch (error) { console.error('Abandoned coaching checkout could not be expired:', error); }
  }
}
