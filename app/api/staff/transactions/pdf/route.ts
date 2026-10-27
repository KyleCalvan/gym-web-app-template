import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { hasActiveStaffProfile } from '@/src/auth/staff-access';
import { createTransactionPdf } from '@/src/staff/transaction-pdf';
import { getReceiptReference } from '@/src/receipt';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['staff'], async (tx, requestId) => {
    const accountId = authRequestContext.getStore()?.accountId ?? null;
    if (!await hasActiveStaffProfile(tx, accountId))
      return apiError(403, 'FORBIDDEN', 'An active staff profile is required.', requestId);

    let input: unknown;
    try { input = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Choose a transaction to download.', requestId); }
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return apiError(400, 'INVALID_REQUEST', 'Choose a transaction to download.', requestId);
    const { transactionId, documentType } = input as Record<string, unknown>;
    if (typeof transactionId !== 'string' || !transactionId || transactionId.length > 100
      || (documentType !== 'Receipt' && documentType !== 'Invoice'))
      return apiError(400, 'INVALID_REQUEST', 'Choose a valid transaction and document type.', requestId);

    const transaction = await tx.paymentTransaction.findFirst({
      where: { id: transactionId, cashierAccountId: accountId! },
      include: { items: true, member: { include: { profile: { include: { gymUser: true } } } } },
    });
    if (!transaction)
      return apiError(404, 'TRANSACTION_NOT_FOUND', 'This transaction is unavailable.', requestId);

    const reference = getReceiptReference({ id: transaction.id,
      receiptNumber: transaction.receiptNumber ?? undefined });
    const pdf = await createTransactionPdf({
      documentType, reference,
      transactionReference: transaction.reference,
      date: new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila',
        month: 'short', day: '2-digit', year: 'numeric' }).format(transaction.createdAt),
      method: transaction.method, status: transaction.status, paymentState: transaction.paymentState,
      customerName: transaction.customerName, memberId: transaction.memberId ?? undefined,
      email: transaction.member?.profile.gymUser.email ?? undefined,
      phone: transaction.member?.profile.gymUser.phone ?? undefined,
      items: transaction.items.map((item) => ({ description: item.description,
        quantity: item.quantity, total: item.total.toNumber() })),
      amount: transaction.amount.toNumber(), fees: transaction.fees.toNumber(),
      isSimulated: transaction.isSimulated,
    });
    const safeReference = reference.replace(/[^A-Za-z0-9_-]/g, '_');
    return new NextResponse(new Uint8Array(pdf), { headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="VinAthletics-${documentType.toLowerCase()}-${safeReference}.pdf"`,
    } });
  });
}
