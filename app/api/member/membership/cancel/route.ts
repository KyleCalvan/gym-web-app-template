import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';
import { hasActiveMembership } from '@/src/member/activeMembership';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const allowedOrigin = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== allowedOrigin) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const session = await readSession(requestSessionToken(request));
  if (!session) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (session.status.restricted || !session.status.roles.includes('member')) {
    return Response.json({ error: 'Member access is required.' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const reason = (body as { reason?: unknown } | null)?.reason;
  if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 500)) {
    return Response.json({ error: 'Cancellation reason must be 500 characters or fewer.' }, { status: 400 });
  }

  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: session.user.id, role: 'member' } },
    include: { profile: { include: { member: true } } },
  });
  const memberId = assignment?.profile.member?.profileId;
  if (!memberId) return Response.json({ error: 'Member profile is unavailable.' }, { status: 404 });

  const membership = await prisma.membership.findFirst({
    where: { memberId }, orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, endsAt: true, cancelledAt: true },
  });
  if (!membership) return Response.json({ error: 'No membership to cancel.' }, { status: 404 });
  if (membership.cancelledAt) {
    return Response.json({ error: 'This membership is already scheduled for cancellation.' }, { status: 409 });
  }
  if (!hasActiveMembership(membership)) {
    return Response.json({ error: 'Only an active membership can be cancelled.' }, { status: 409 });
  }

  const normalizedReason = typeof reason === 'string' ? reason.trim() || null : null;
  const updated = await prisma.$executeRaw`
    UPDATE "Membership"
    SET "cancelledAt" = NOW(), "cancellationReason" = ${normalizedReason}, "updatedAt" = NOW()
    WHERE id = ${membership.id} AND "memberId" = ${memberId}
      AND "cancelledAt" IS NULL AND status IN ('Active', 'Expiring') AND "endsAt" > NOW()
  `;
  if (updated !== 1) {
    return Response.json({ error: 'Membership changed. Refresh and try again.' }, { status: 409 });
  }
  const result = await prisma.membership.findUniqueOrThrow({ where: { id: membership.id },
    select: { planName: true, status: true, endsAt: true, cancelledAt: true } });
  return Response.json({ membership: { planName: result.planName, status: result.status,
    endsAt: result.endsAt.toISOString(), cancellationScheduled: result.cancelledAt !== null } });
}
