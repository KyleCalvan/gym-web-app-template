import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';

/**
 * Refunds the most recent successful payment on an order.
 *
 * The Payment ledger already carries refundedAt/refundReason and the
 * PaymentStatus/OrderStatus enums already have Refunded members, so the refund
 * is a state transition on existing rows rather than a new table. A partial
 * refund is deliberately not modelled yet: the admin UI refunds a whole
 * transaction, so this rejects an order with nothing left to refund.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId, caller) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'A refund reason is required.', requestId }, { status: 400 });
    }

    const order = await tx.order.findUnique({
      where: { id },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found.', requestId }, { status: 404 });
    }

    const target = order.payments.find((p) => p.status === 'Successful');
    if (!target) {
      return NextResponse.json(
        { error: 'This order has no successful payment to refund.', requestId },
        { status: 409 },
      );
    }

    // Serialize concurrent refunds of the same order.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'order:' + order.id}, 0))`;

    const now = new Date();
    const payment = await tx.payment.update({
      where: { id: target.id },
      data: { status: 'Refunded', refundedAt: now, refundReason: reason },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'Refunded' },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'payment.refunded',
        target: payment.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({
      payment: {
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        refundedAt: payment.refundedAt?.toISOString() ?? null,
        refundReason: payment.refundReason,
      },
      order: { id: order.id, status: 'Refunded' },
    });
  });
}
