import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';

export const runtime = 'nodejs';

function manilaDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function GET(request: NextRequest) {
  try {
    const record = await readSession(requestSessionToken(request));
    if (!record) return Response.json({ code: 'UNAUTHENTICATED' }, { status: 401 });
    if (record.status.restricted || !record.status.roles.includes('member')) {
      return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
    }

    const assignment = await prisma.assignedRole.findUnique({
      where: { accountId_role: { accountId: record.user.id, role: 'member' } },
      include: { profile: { include: { member: true } } },
    });
    const member = assignment?.profile.member;
    if (!member) return Response.json({ code: 'MEMBER_UNAVAILABLE' }, { status: 404 });

    const membership = await prisma.membership.findFirst({
      where: { memberId: member.profileId }, orderBy: { createdAt: 'desc' },
      select: { planName: true },
    });
    const asOf = manilaDate();
    const today = new Date(`${asOf}T00:00:00.000Z`);
    const promotions = await prisma.promotion.findMany({
      where: {
        status: 'Published', deletedAt: null,
        validFrom: { lte: today }, validUntil: { gte: today },
        OR: membership?.planName
          ? [{ planName: null }, { planName: membership.planName }]
          : [{ planName: null }],
      },
      include: { _count: { select: { redemptions: true } } },
      orderBy: [{ validUntil: 'asc' }, { id: 'asc' }],
    });
    const available = promotions.filter(promotion =>
      promotion.maxRedemptions === 0 || promotion._count.redemptions < promotion.maxRedemptions);
    const promotionRedemptions = available.length > 0
      ? await prisma.promotionRedemption.findMany({
        where: { memberId: member.profileId, promotionId: { in: available.map(promotion => promotion.id) } },
        select: { id: true, memberId: true, promotionId: true, code: true, redeemedAt: true },
      })
      : [];

    return Response.json({
      asOf,
      promotions: available.map(promotion => ({
        id: promotion.id, title: promotion.title, code: promotion.code,
        discountType: promotion.discountType, discount: promotion.discount,
        validFrom: promotion.validFrom.toISOString().slice(0, 10),
        validUntil: promotion.validUntil.toISOString().slice(0, 10),
        plan: promotion.planName ?? 'Any', maxRedemptions: promotion.maxRedemptions,
        redemptions: promotion._count.redemptions, minSpend: Number(promotion.minSpend),
        status: promotion.status, imageUrl: promotion.imageUrl ?? undefined,
        description: promotion.description ?? undefined,
      })),
      promotionRedemptions: promotionRedemptions.map(redemption => ({
        ...redemption, redeemedAt: redemption.redeemedAt.toISOString(),
      })),
    });
  } catch {
    return Response.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}
