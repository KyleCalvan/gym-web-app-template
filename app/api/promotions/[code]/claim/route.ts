import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  return withBusinessAuthorization(request, ['member'] as GymRole[], async (tx, requestId) => {
    const authHeader = request.headers.get('authorization');
    const accountId = authHeader?.replace(/^Bearer\s+/i, '');

    if (!accountId) {
      return NextResponse.json({ error: 'Authorization required.', requestId }, { status: 401 });
    }

    const account = await tx.authUser.findUnique({
      where: { id: accountId },
      select: { gymUserId: true },
    });

    if (!account?.gymUserId) {
      return NextResponse.json({ error: 'Account not linked to gym user.', requestId }, { status: 404 });
    }

    const promotion = await tx.promotion.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found.', requestId }, { status: 404 });
    }

    if (promotion.status !== 'Published') {
      return NextResponse.json({ error: 'Promotion is not active.', requestId }, { status: 400 });
    }

    const now = new Date();
    if (now < promotion.validFrom || now > promotion.validUntil) {
      return NextResponse.json({ error: 'Promotion is not valid at this time.', requestId }, { status: 400 });
    }

    if (promotion.maxRedemptions !== null && promotion.redemptions >= promotion.maxRedemptions) {
      return NextResponse.json({ error: 'Promotion has reached maximum redemptions.', requestId }, { status: 400 });
    }

    const existingClaim = await tx.promotionClaim.findUnique({
      where: { promotionId_memberId: { promotionId: promotion.id, memberId: account.gymUserId } },
    });

    if (existingClaim) {
      return NextResponse.json({ error: 'You have already claimed this promotion.', requestId }, { status: 409 });
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'promotion:' + promotion.id}, 0))`;

    const claim = await tx.promotionClaim.create({
      data: {
        promotionId: promotion.id,
        memberId: account.gymUserId,
      },
    });

    await tx.promotion.update({
      where: { id: promotion.id },
      data: { redemptions: { increment: 1 } },
    });

    await tx.auditEvent.create({
      data: {
        actor: accountId,
        action: 'promotion.claimed',
        target: claim.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({
      claim: {
        id: claim.id,
        promotionId: promotion.id,
        memberId: account.gymUserId,
        claimedAt: claim.claimedAt.toISOString(),
      },
      promotion: {
        id: promotion.id,
        title: promotion.title,
        code: promotion.code,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
      },
    }, { status: 201 });
  });
}
