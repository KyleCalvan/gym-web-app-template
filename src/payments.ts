import type { PaymentState, Transaction } from './types.ts';
import { createReceiptReference } from './receipt.ts';

export type PaymentMethod = 'GCash' | 'Card' | 'Cash';

export function getConfiguredPaymentFee(method: string, amount: number): number {
  if (method.trim().toLowerCase() !== 'gcash') return 0;
  const configuredFee = Number(process.env.NEXT_PUBLIC_GCASH_TEST_FEE_PHP || 0);
  if (!Number.isFinite(configuredFee) || configuredFee < 0 || !Number.isFinite(amount) || amount < 0) {
    throw new Error('The configured test fee and payment amount must be non-negative finite numbers.');
  }
  return configuredFee;
}

export function createSimulatedTransaction(input: {
  member: string;
  type: string;
  amount: number;
  method: string;
  date: string;
  fees?: number;
}): Transaction {
  const receiptNumber = createReceiptReference();
  const transactionReference = `PAY-${receiptNumber.slice('VA-'.length)}`;
  return {
    id: transactionReference,
    transactionReference,
    receiptNumber,
    member: input.member,
    type: input.type,
    amount: input.amount,
    fees: input.fees || 0,
    method: input.method,
    date: input.date,
    status: 'Pending',
    paymentState: 'Pending',
    isSimulated: true,
  };
}

export function updateSimulatedTransaction(
  transaction: Transaction,
  paymentState: PaymentState,
): Transaction {
  if (!transaction.isSimulated) {
    throw new Error('Only simulated transactions can be updated by the payment simulator.');
  }
  const currentState = transaction.paymentState || transaction.status;
  const validNextStates: Record<string, PaymentState[]> = {
    Pending: ['Processing', 'Failed'],
    Processing: ['Pending', 'Successful', 'Failed'],
    Failed: ['Processing'],
    Successful: [],
  };
  if (!validNextStates[currentState]?.includes(paymentState)) {
    throw new Error(`Invalid simulated payment transition: ${currentState} → ${paymentState}.`);
  }
  return {
    ...transaction,
    paymentState,
    status: paymentState === 'Successful' ? 'Paid' : paymentState === 'Failed' ? 'Failed' : 'Pending',
  };
}
