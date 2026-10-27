import { prisma } from '@/src/auth/prisma';
import { hasPaidGCashPayment, type CheckoutSession } from './validation';

export async function fulfillCoachingCheckout(session: CheckoutSession) {
  const reference = session.attributes.reference_number;
  if (!reference?.startsWith('COACH-') || session.attributes.livemode !== false) return false;
  return prisma.$transaction(async tx => {
    const transaction = await tx.paymentTransaction.findUnique({
      where: { reference }, include: { items: { select: { coachingSessionId: true } } },
    });
    if (!transaction || transaction.paymongoCheckoutId !== session.id || transaction.status === 'Failed') return false;
    if (transaction.status === 'Paid') return true;
    if (!transaction.memberId || !transaction.items.length || transaction.items.some(item => !item.coachingSessionId)) return false;
    if (!hasPaidGCashPayment(session, reference, Math.round(Number(transaction.amount) * 100))) return false;
    const claimed = await tx.paymentTransaction.updateMany({
      where: { id: transaction.id, status: 'Pending' },
      data: { status: 'Paid', paymentState: 'Successful', paidAt: new Date() },
    });
    if (claimed.count !== 1) return false;
    await tx.coachingSession.updateMany({
      where: { id: { in: transaction.items.map(item => item.coachingSessionId!) }, status: 'Pending' },
      data: { status: 'Confirmed' },
    });
    return true;
  });
}
