import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import { prisma } from '@/src/auth/prisma';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/backend/generated/prisma/client';
import type { GymRole } from '@/backend/generated/prisma/client';

function memberDisplayNumber(id: number): string {
  return `M-${String(id).padStart(4, '0')}`;
}

function validateMemberInput(body: unknown): { valid: true; data: Omit<Prisma.MemberProfileCreateInput, 'displayNumber'> } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be an object.' };
  const input = body as Record<string, unknown>;

  const gymUserId = typeof input.gymUserId === 'number' ? input.gymUserId : null;
  if (gymUserId === null) return { valid: false, error: 'gymUserId (number) is required.' };

  const phone = typeof input.phone === 'string' ? input.phone.trim() || null : null;
  const emergencyContactName = typeof input.emergencyContactName === 'string' ? input.emergencyContactName.trim() || null : null;
  const emergencyContactPhone = typeof input.emergencyContactPhone === 'string' ? input.emergencyContactPhone.trim() || null : null;
  const dateOfBirth = typeof input.dateOfBirth === 'string' ? new Date(input.dateOfBirth) : null;
  if (dateOfBirth && isNaN(dateOfBirth.getTime())) return { valid: false, error: 'Invalid dateOfBirth.' };
  const gender = typeof input.gender === 'string' ? input.gender.trim() || null : null;
  const address = typeof input.address === 'string' ? input.address.trim() || null : null;
  const weightKg = typeof input.weightKg === 'number' ? input.weightKg : null;
  const heightCm = typeof input.heightCm === 'number' ? input.heightCm : null;

  return {
    valid: true,
    data: {
      gymUser: { connect: { id: gymUserId } },
      phone,
      emergencyContactName,
      emergencyContactPhone,
      dateOfBirth,
      gender,
      address,
      weightKg,
      heightCm,
    },
  };
}

function memberToJson(profile: {
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
}) {
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
    user: profile.gymUser ? {
      id: profile.gymUser.id,
      email: profile.gymUser.email,
      name: profile.gymUser.name,
    } : null,
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer'] as GymRole[], async (tx, requestId, caller) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.MemberProfileWhereInput = {};
    if (status === 'active') where.deletedAt = null;

    const [profiles, total] = await Promise.all([
      tx.memberProfile.findMany({
        where,
        include: { gymUser: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.memberProfile.count({ where }),
    ]);

    return NextResponse.json({ members: profiles.map(memberToJson), total, limit, offset });
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

    const validation = validateMemberInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error, requestId }, { status: 400 });
    }

    const existing = await tx.memberProfile.findUnique({
      where: { gymUserId: validation.data.gymUser?.connect?.id ?? 0 },
    });
    if (existing) {
      return NextResponse.json({ error: 'Member profile already exists for this user.', requestId }, { status: 409 });
    }

    const gymUser = await tx.user.findUnique({
      where: { id: validation.data.gymUser?.connect?.id ?? 0 },
      select: { id: true },
    });
    if (!gymUser) {
      return NextResponse.json({ error: 'User not found.', requestId }, { status: 404 });
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'member:' + gymUser.id}, 0))`;

    const profile = await tx.memberProfile.create({
      data: {
        ...validation.data,
        displayNumber: memberDisplayNumber(gymUser.id),
      },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'member.created',
        target: profile.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ member: memberToJson(profile) }, { status: 201 });
  });
}
