import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function promotionToJson(p: {
  id: string;
  title: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  validFrom: Date;
  validUntil: Date;
  planNames: string[];
  minSpendCentavos: number | null;
  maxRedemptions: number | null;
  redemptions: number;
  status: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    title: p.title,
    code: p.code,
    description: p.description,
    discountType: p.discountType,
    discountValue: p.discountValue,
    validFrom: p.validFrom.toISOString(),
    validUntil: p.validUntil.toISOString(),
    planNames: p.planNames,
    minSpendCentavos: p.minSpendCentavos,
    maxRedemptions: p.maxRedemptions,
    redemptions: p.redemptions,
    status: p.status,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// Accept either the promotion id or its public code in the same segment.
async function resolvePromotion(tx: Prisma.TransactionClient, value: string) {
  return tx.promotion.findFirst({
    where: { OR: [{ id: value }, { code: value.trim().toUpperCase() }] },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const existing = await resolvePromotion(tx, id);
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found.', requestId }, { status: 404 });
    }

    const input = body as Record<string, unknown>;
    const data: Prisma.PromotionUpdateInput = {};

    if ('title' in input) data.title = typeof input.title === 'string' ? input.title.trim() : '';
    if ('description' in input) data.description = typeof input.description === 'string' ? input.description.trim() || null : null;
    if ('discountValue' in input) data.discountValue = typeof input.discountValue === 'number' ? input.discountValue : 0;
    if ('validFrom' in input) {
      const date = new Date(input.validFrom as string);
      if (!isNaN(date.getTime())) data.validFrom = date;
    }
    if ('validUntil' in input) {
      const date = new Date(input.validUntil as string);
      if (!isNaN(date.getTime())) data.validUntil = date;
    }
    if ('planNames' in input && Array.isArray(input.planNames)) {
      data.planNames = input.planNames.filter((p): p is string => typeof p === 'string');
    }
    if ('minSpendCentavos' in input) data.minSpendCentavos = typeof input.minSpendCentavos === 'number' ? input.minSpendCentavos : null;
    if ('maxRedemptions' in input) data.maxRedemptions = typeof input.maxRedemptions === 'number' ? input.maxRedemptions : null;
    if ('imageUrl' in input) data.imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() || null : null;

    // Handle publish action
    const action = typeof input.action === 'string' ? input.action : '';
    if (action === 'publish') {
      data.status = 'Published';
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.', requestId }, { status: 400 });
    }

    const promotion = await tx.promotion.update({
      where: { id: existing.id },
      data,
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: action === 'publish' ? 'promotion.published' : 'promotion.updated',
        target: promotion.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ promotion: promotionToJson(promotion) });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId, caller) => {
    const promotion = await resolvePromotion(tx, id);
    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found.', requestId }, { status: 404 });
    }

    if (promotion.status === 'Published') {
      return NextResponse.json({ error: 'Cannot delete a published promotion.', requestId }, { status: 400 });
    }

    await tx.promotion.delete({ where: { id: promotion.id } });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'promotion.deleted',
        target: promotion.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ deleted: true });
  });
}
