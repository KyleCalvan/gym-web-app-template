import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole, MembershipStatus } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function membershipToJson(m: {
  id: string;
  memberId: number;
  planName: string;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  frozenAt: Date | null;
  frozenReason: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  plan: { name: string; price: number; period: string } | null;
}) {
  return {
    id: m.id,
    memberId: m.memberId,
    planName: m.planName,
    status: m.status,
    startedAt: m.startedAt.toISOString(),
    expiresAt: m.expiresAt.toISOString(),
    frozenAt: m.frozenAt?.toISOString() ?? null,
    frozenReason: m.frozenReason,
    cancelledAt: m.cancelledAt?.toISOString() ?? null,
    cancellationReason: m.cancellationReason,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    plan: m.plan,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer', 'member'] as GymRole[], async (tx, requestId, caller) => {
    const profile = await tx.memberProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
    }

    const memberships = await tx.membership.findMany({
      where: { memberId: profile.gymUserId },
      include: { plan: { select: { name: true, price: true, period: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ memberships: memberships.map(membershipToJson) });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId, caller) => {
    const profile = await tx.memberProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
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
    const planName = typeof input.planName === 'string' ? input.planName.trim() : '';
    if (!planName) {
      return NextResponse.json({ error: 'planName is required.', requestId }, { status: 400 });
    }

    const plan = await tx.gymPlan.findUnique({ where: { name: planName } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found.', requestId }, { status: 404 });
    }

    const startedAt = typeof input.startedAt === 'string' ? new Date(input.startedAt) : new Date();
    if (isNaN(startedAt.getTime())) {
      return NextResponse.json({ error: 'Invalid startedAt.', requestId }, { status: 400 });
    }

    // Calculate expiry based on plan period
    const expiresAt = new Date(startedAt);
    const periodMatch = plan.period.match(/^(\d+)\s*(day|week|month|year)s?$/i);
    if (periodMatch) {
      const amount = parseInt(periodMatch[1], 10);
      const unit = periodMatch[2].toLowerCase();
      if (unit === 'day') expiresAt.setDate(expiresAt.getDate() + amount);
      else if (unit === 'week') expiresAt.setDate(expiresAt.getDate() + amount * 7);
      else if (unit === 'month') expiresAt.setMonth(expiresAt.getMonth() + amount);
      else if (unit === 'year') expiresAt.setFullYear(expiresAt.getFullYear() + amount);
    } else {
      // Default to 1 month
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'membership:' + profile.gymUserId}, 0))`;

    const membership = await tx.membership.create({
      data: {
        memberId: profile.gymUserId,
        planName,
        status: 'Active',
        startedAt,
        expiresAt,
      },
      include: { plan: { select: { name: true, price: true, period: true } } },
    });

    await tx.gymPlan.update({
      where: { name: planName },
      data: { members: { increment: 1 } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'membership.created',
        target: membership.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ membership: membershipToJson(membership) }, { status: 201 });
  });
}

const MEMBERSHIP_STATUSES: MembershipStatus[] = ['Active', 'Expiring', 'Frozen', 'Expired', 'Cancelled'];

/**
 * Re-status the member's current membership. Freezing stamps frozenAt (keeping
 * any earlier timestamp) and clearing the freeze removes it again, so
 * freeze/unfreeze round-trips without losing history.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId, caller) => {
    const profile = await tx.memberProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
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
    const requested = typeof input.status === 'string' ? input.status.trim() : '';
    const status = MEMBERSHIP_STATUSES.find((candidate) => candidate.toLowerCase() === requested.toLowerCase());
    if (!status) {
      return NextResponse.json(
        { error: 'status must be one of ' + MEMBERSHIP_STATUSES.join(', ') + '.', requestId },
        { status: 400 },
      );
    }

    const latest = await tx.membership.findFirst({
      where: { memberId: profile.gymUserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, frozenAt: true, frozenReason: true },
    });
    if (!latest) {
      return NextResponse.json({ error: 'This member has no membership to update.', requestId }, { status: 404 });
    }

    const frozen = status === 'Frozen';
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    const membership = await tx.membership.update({
      where: { id: latest.id },
      data: {
        status,
        frozenAt: frozen ? latest.frozenAt ?? new Date() : null,
        frozenReason: frozen ? reason || latest.frozenReason : null,
      },
      include: { plan: { select: { name: true, price: true, period: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId ?? undefined,
        action: frozen ? 'membership.frozen' : 'membership.status_changed',
        target: membership.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ membership: membershipToJson(membership) });
  });
}
