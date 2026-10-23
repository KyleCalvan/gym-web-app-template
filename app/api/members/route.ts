import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

type MembershipSummary = {
  id: string;
  planName: string;
  status: string;
  expiresAt: Date;
};

type MemberRecord = {
  id: string;
  gymUserId: number;
  displayNumber: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  weightKg: number | null;
  heightCm: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  gymUser: { id: number; email: string; name: string | null } | null;
};

function memberDisplayNumber(id: number): string {
  return 'M-' + String(id).padStart(4, '0');
}

function memberToJson(profile: MemberRecord, latestMembership: MembershipSummary | null) {
  return {
    id: profile.id,
    gymUserId: profile.gymUserId,
    displayNumber: profile.displayNumber,
    phone: profile.phone,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
    gender: profile.gender,
    address: profile.address,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    deletedAt: profile.deletedAt?.toISOString() ?? null,
    user: profile.gymUser
      ? { id: profile.gymUser.id, email: profile.gymUser.email, name: profile.gymUser.name }
      : null,
    plan: latestMembership?.planName ?? null,
    membershipStatus: latestMembership?.status ?? null,
    membershipExpiresAt: latestMembership?.expiresAt.toISOString() ?? null,
    membershipId: latestMembership?.id ?? null,
  };
}

/**
 * Memberships hang off the gym user (an Int), not the member profile, so the
 * newest one per member has to be joined in code rather than through include.
 */
async function latestMembershipByMemberId(
  tx: Prisma.TransactionClient,
  memberIds: number[],
): Promise<Map<number, MembershipSummary>> {
  const summaries = new Map<number, MembershipSummary>();
  if (memberIds.length === 0) return summaries;

  const rows = await tx.membership.findMany({
    where: { memberId: { in: memberIds } },
    orderBy: { expiresAt: 'desc' },
    select: { id: true, memberId: true, planName: true, status: true, expiresAt: true },
  });

  for (const row of rows) {
    if (summaries.has(row.memberId)) continue;
    summaries.set(row.memberId, {
      id: row.id,
      planName: row.planName,
      status: row.status,
      expiresAt: row.expiresAt,
    });
  }

  return summaries;
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer'] as GymRole[], async (tx) => {
    const search = request.nextUrl.searchParams;
    const status = search.get('status');

    const where: Prisma.MemberProfileWhereInput = {};
    if (status === 'active') where.deletedAt = null;

    const requestedLimit = Number(search.get('limit'));
    const requestedOffset = Number(search.get('offset'));
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 100, 1),
      500,
    );
    const offset = Math.max(Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0, 0);

    const [members, total] = await Promise.all([
      tx.memberProfile.findMany({
        where,
        include: { gymUser: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.memberProfile.count({ where }),
    ]);

    const memberships = await latestMembershipByMemberId(
      tx,
      members.map((member) => member.gymUserId),
    );

    return NextResponse.json({
      members: members.map((member) =>
        memberToJson(member, memberships.get(member.gymUserId) ?? null),
      ),
      total,
      limit,
      offset,
    });
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
    let gymUserId = typeof input.gymUserId === 'number' ? input.gymUserId : Number(input.gymUserId);
    if (!Number.isInteger(gymUserId) || gymUserId <= 0) {
      // The admin Register form collects a name and email rather than an account
      // id, so resolve the gym account from the email and create it when needed.
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (!email) {
        return NextResponse.json(
          { error: 'A numeric gymUserId or an email is required.', requestId },
          { status: 400 },
        );
      }
      const name = typeof input.name === 'string' ? input.name.trim() || null : null;
      const account = await tx.user.upsert({
        where: { email },
        update: {},
        create: { email, name },
        select: { id: true },
      });
      gymUserId = account.id;
    }

    const existing = await tx.memberProfile.findUnique({ where: { gymUserId } });
    if (existing) {
      return NextResponse.json(
        { error: 'A member profile already exists for this account.', requestId },
        { status: 409 },
      );
    }

    const gymUser = await tx.user.findUnique({ where: { id: gymUserId }, select: { id: true } });
    if (!gymUser) {
      return NextResponse.json({ error: 'Gym user not found.', requestId }, { status: 404 });
    }

    let dateOfBirth: Date | null = null;
    if (typeof input.dateOfBirth === 'string' && input.dateOfBirth.trim()) {
      dateOfBirth = new Date(input.dateOfBirth);
      if (Number.isNaN(dateOfBirth.getTime())) {
        return NextResponse.json({ error: 'Invalid dateOfBirth.', requestId }, { status: 400 });
      }
    }

    const profile = await tx.memberProfile.create({
      data: {
        gymUserId,
        displayNumber: memberDisplayNumber(gymUserId),
        phone: typeof input.phone === 'string' ? input.phone.trim() || null : null,
        emergencyContactName:
          typeof input.emergencyContactName === 'string' ? input.emergencyContactName.trim() || null : null,
        emergencyContactPhone:
          typeof input.emergencyContactPhone === 'string' ? input.emergencyContactPhone.trim() || null : null,
        dateOfBirth,
        gender: typeof input.gender === 'string' ? input.gender.trim() || null : null,
        address: typeof input.address === 'string' ? input.address.trim() || null : null,
        weightKg: typeof input.weightKg === 'number' ? input.weightKg : null,
        heightCm: typeof input.heightCm === 'number' ? input.heightCm : null,
      },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId ?? undefined,
        action: 'member.created',
        target: profile.id,
        result: 'success',
        requestId,
      },
    });

    const memberships = await latestMembershipByMemberId(tx, [profile.gymUserId]);

    return NextResponse.json(
      { member: memberToJson(profile, memberships.get(profile.gymUserId) ?? null) },
      { status: 201 },
    );
  });
}
