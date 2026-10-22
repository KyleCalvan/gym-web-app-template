import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function paymentToJson(p: {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  currency: string;
  status: string;
  transactionReference: string | null;
  receiptNumber: string | null;
  providerReference: string | null;
  fees: number | null;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  failedAt: Date | null;
  failureReason: string | null;
  refundedAt: Date | null;
  refundReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    orderId: p.orderId,
    method: p.method,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    transactionReference: p.transactionReference,
    receiptNumber: p.receiptNumber,
    providerReference: p.providerReference,
    fees: p.fees,
    confirmedAt: p.confirmedAt?.toISOString() ?? null,
    confirmedBy: p.confirmedBy,
    failedAt: p.failedAt?.toISOString() ?? null,
    failureReason: p.failureReason,
    refundedAt: p.refundedAt?.toISOString() ?? null,
    refundReason: p.refundReason,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId) => {
    const payments = await tx.payment.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ payments: payments.map(paymentToJson) });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found.', requestId }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be an object.', requestId }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const method = typeof input.method === 'string' ? input.method : '';
    if (!['Cash', 'GCash', 'Card'].includes(method)) {
      return NextResponse.json({ error: 'Invalid payment method.', requestId }, { status: 400 });
    }

    const amount = typeof input.amount === 'number' ? Math.round(input.amount) : 0;
    if (amount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be positive.', requestId }, { status: 400 });
    }

    const paidSoFar = order.payments
      .filter((p) => p.status === 'Successful')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalDue = order.totalAmount - paidSoFar;
    if (amount > totalDue) {
      return NextResponse.json({ error: `Payment exceeds remaining balance of ${totalDue}.`, requestId }, { status: 400 });
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'order:' + order.id}, 0))`;

    const receiptNumber = method === 'Cash' ? `RCP-${Date.now().toString(36).toUpperCase()}` : null;

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        method: method as Prisma.PaymentMethod,
        amount,
        status: method === 'Cash' ? 'Successful' : 'Pending',
        receiptNumber,
        confirmedAt: method === 'Cash' ? new Date() : null,
      },
    });

    // Check if order is now fully paid
    const newPaidTotal = paidSoFar + amount;
    if (newPaidTotal >= order.totalAmount) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'Paid' },
      });
    } else if (newPaidTotal > 0) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'Processing' },
      });
    }

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'payment.created',
        target: payment.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ payment: paymentToJson(payment) }, { status: 201 });
  });
}
