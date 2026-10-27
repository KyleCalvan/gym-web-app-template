import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';

export const runtime = 'nodejs';

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
    const [membership, latestPayment, upcomingSessions, studentVerification] = await Promise.all([
      prisma.membership.findFirst({ where: { memberId: member.profileId },
        orderBy: { createdAt: 'desc' }, select: { planName: true, status: true, endsAt: true, cancelledAt: true } }),
      prisma.paymentTransaction.findFirst({ where: { memberId: member.profileId },
        orderBy: { createdAt: 'desc' }, select: { type: true, amount: true, status: true, createdAt: true, paidAt: true } }),
      prisma.coachingSession.findMany({ where: { memberId: member.profileId, startsAt: { gte: new Date() },
        status: { in: ['Pending', 'Confirmed'] } }, orderBy: { startsAt: 'asc' }, take: 4,
        select: { id: true, startsAt: true, type: true, status: true, amount: true,
          transactionItem: { select: { transaction: { select: { status: true } } } },
          trainer: { select: { profile: { select: { gymUser: { select: { name: true } } } } } } },
      }),
      prisma.studentVerification.findFirst({ where: { memberId: member.profileId },
        orderBy: { submittedAt: 'desc' }, select: { status: true } }),
    ]);
    return Response.json({
      joinedAt: member.joinedAt.toISOString(),
      membership: membership ? { planName: membership.planName,
        status: ['Active', 'Expiring'].includes(membership.status) && membership.endsAt <= new Date()
          ? 'Expired' : membership.status,
        endsAt: membership.endsAt.toISOString(), cancellationScheduled: membership.cancelledAt !== null } : null,
      latestPayment: latestPayment ? { type: latestPayment.type, amount: Number(latestPayment.amount), status: latestPayment.status,
        at: (latestPayment.paidAt ?? latestPayment.createdAt).toISOString() } : null,
      studentVerificationStatus: studentVerification?.status ?? null,
      upcomingSessions: upcomingSessions.map(session => ({ id: session.id, startsAt: session.startsAt.toISOString(),
        type: session.type, status: session.status, amount: Number(session.amount),
        paymentStatus: session.transactionItem?.transaction.status ?? null,
        trainer: session.trainer.profile.gymUser.name })),
    });
  } catch {
    return Response.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}
