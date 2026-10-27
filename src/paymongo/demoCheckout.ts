import { prisma } from '@/src/auth/prisma';
import { hasPaidGCashPayment, type CheckoutSession } from './validation';
import { expireCheckout, retrieveCheckout } from './checkout';

export async function fulfillDemoCheckout(session: CheckoutSession) {
  const reference = session.attributes.reference_number;
  if (!reference?.startsWith('DEMO-') || session.attributes.livemode !== false) return false;
  const transaction = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!transaction || transaction.paymongoCheckoutId !== session.id || !transaction.isSimulated) return false;
  if (transaction.status === 'Paid') return true;
  if (transaction.status !== 'Pending') return false;
  if (!hasPaidGCashPayment(session, reference, Math.round(Number(transaction.amount) * 100))) return false;
  const result = await prisma.paymentTransaction.updateMany({
    where: { id: transaction.id, status: 'Pending' },
    data: { status: 'Paid', paymentState: 'Successful', paidAt: new Date() },
  });
  return result.count === 1;
}

export async function cancelDemoCheckout(reference: string, customerName: string): Promise<'Paid' | 'Pending' | 'Failed'> {
  const transaction = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!transaction || !transaction.isSimulated || transaction.customerName !== customerName
    || !reference.startsWith('DEMO-')) throw new Error('Checkout was not found.');
  if (transaction.status !== 'Pending') return transaction.status === 'Paid' ? 'Paid' : 'Failed';
  if (!transaction.paymongoCheckoutId) return 'Pending';
  try {
    await expireCheckout(transaction.paymongoCheckoutId);
  } catch {
    const current = await retrieveCheckout(transaction.paymongoCheckoutId);
    if (await fulfillDemoCheckout(current)) return 'Paid';
    if (current.attributes.status !== 'expired') return 'Pending';
  }
  await prisma.paymentTransaction.updateMany({ where: { id: transaction.id, status: 'Pending' },
    data: { status: 'Failed', paymentState: 'Failed' } });
  return 'Failed';
}
