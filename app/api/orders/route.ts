import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole, OrderSource } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function orderToJson(order: {
  id: string;
  memberId: number | null;
  source: string;
  cashierId: string | null;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  lines: { id: string; itemType: string; itemName: string; description: string | null; quantity: number; unitPrice: number; totalPrice: number }[];
  payments: { id: string; method: string; amount: number; status: string; receiptNumber: string | null }[];
  member: { id: number; email: string; name: string | null } | null;
}) {
  return {
    id: order.id,
    memberId: order.memberId,
    source: order.source,
    cashierId: order.cashierId,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    lines: order.lines,
    payments: order.payments,
    member: order.member ? { id: order.member.id, email: order.member.email, name: order.member.name } : null,
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId, caller) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const memberId = searchParams.get('memberId');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as Prisma.EnumOrderStatusFilter;
    if (memberId) where.memberId = Number(memberId);

    const [orders, total] = await Promise.all([
      tx.order.findMany({
        where,
        include: {
          lines: true,
          payments: { select: { id: true, method: true, amount: true, status: true, receiptNumber: true } },
          member: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.order.count({ where }),
    ]);

    return NextResponse.json({ orders: orders.map(orderToJson), total, limit, offset });
  });
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId, caller) => {
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

    const source = typeof input.source === 'string' ? input.source : 'POS';
    if (!['MemberCheckout', 'POS', 'AdminAssignment'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source.', requestId }, { status: 400 });
    }

    const memberId = typeof input.memberId === 'number' ? input.memberId : null;
    const lines = Array.isArray(input.lines) ? input.lines : [];
    if (lines.length === 0) {
      return NextResponse.json({ error: 'At least one order line is required.', requestId }, { status: 400 });
    }

    let totalAmount = 0;
    const orderLines: Prisma.OrderLineCreateWithoutOrderInput[] = [];
    for (const line of lines) {
      const l = line as Record<string, unknown>;
      const itemType = typeof l.itemType === 'string' ? l.itemType : '';
      const itemName = typeof l.itemName === 'string' ? l.itemName : '';
      const description = typeof l.description === 'string' ? l.description : null;
      const quantity = typeof l.quantity === 'number' ? Math.max(1, l.quantity) : 1;
      const unitPrice = typeof l.unitPrice === 'number' ? Math.round(l.unitPrice) : 0;
      const totalPrice = quantity * unitPrice;
      totalAmount += totalPrice;

      if (!itemType || !itemName) {
        return NextResponse.json({ error: 'Each line must have itemType and itemName.', requestId }, { status: 400 });
      }

      orderLines.push({ itemType, itemName, description, quantity, unitPrice, totalPrice });
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'order:create'}, 0))`;

    const order = await tx.order.create({
      data: {
        memberId,
        source: source as OrderSource,
        status: 'Pending',
        totalAmount,
        lines: { create: orderLines },
      },
      include: {
        lines: true,
        payments: { select: { id: true, method: true, amount: true, status: true, receiptNumber: true } },
        member: { select: { id: true, email: true, name: true } },
      },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'order.created',
        target: order.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ order: orderToJson(order) }, { status: 201 });
  });
}
