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

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff', 'member'] as GymRole[], async (tx, requestId) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const code = searchParams.get('code');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.PromotionWhereInput = {};
    if (status) where.status = status as Prisma.EnumPromotionStatusFilter;
    if (code) where.code = { equals: code.trim().toUpperCase() };

    const [promotions, total] = await Promise.all([
      tx.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.promotion.count({ where }),
    ]);

    return NextResponse.json({ promotions: promotions.map(promotionToJson), total, limit, offset });
  });
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId) => {
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
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
    const discountType = typeof input.discountType === 'string' ? input.discountType : '';
    const discountValue = typeof input.discountValue === 'number' ? input.discountValue : 0;
    const validFrom = typeof input.validFrom === 'string' ? new Date(input.validFrom) : new Date();
    const validUntil = typeof input.validUntil === 'string' ? new Date(input.validUntil) : new Date();

    if (!title || !code) {
      return NextResponse.json({ error: 'title and code are required.', requestId }, { status: 400 });
    }

    if (!['Percentage', 'Fixed', 'Bundle'].includes(discountType)) {
      return NextResponse.json({ error: 'Invalid discountType. Use Percentage, Fixed, or Bundle.', requestId }, { status: 400 });
    }

    if (discountType === 'Percentage' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json({ error: 'Percentage discount must be between 0 and 100.', requestId }, { status: 400 });
    }

    if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) {
      return NextResponse.json({ error: 'Invalid date format.', requestId }, { status: 400 });
    }

    const existing = await tx.promotion.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: 'Promotion code already exists.', requestId }, { status: 409 });
    }

    const planNames = Array.isArray(input.planNames)
      ? input.planNames.filter((p): p is string => typeof p === 'string')
      : [];
    const minSpendCentavos = typeof input.minSpendCentavos === 'number' ? Math.round(input.minSpendCentavos) : null;
    const maxRedemptions = typeof input.maxRedemptions === 'number' ? Math.round(input.maxRedemptions) : null;
    const description = typeof input.description === 'string' ? input.description.trim() || null : null;
    const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() || null : null;

    const promotion = await tx.promotion.create({
      data: {
        title,
        code,
        description,
        discountType: discountType as Prisma.DiscountType,
        discountValue,
        validFrom,
        validUntil,
        planNames,
        minSpendCentavos,
        maxRedemptions,
        status: 'Draft',
        imageUrl,
      },
    });

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'promotion.created',
        target: promotion.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ promotion: promotionToJson(promotion) }, { status: 201 });
  });
}
