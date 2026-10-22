import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

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
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['member', 'admin', 'staff', 'trainer'] as GymRole[], async (tx, requestId) => {
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

    const profile = await tx.memberProfile.findUnique({
      where: { gymUserId: account.gymUserId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
    }

    return NextResponse.json({ profile: memberToJson(profile) });
  });
}

export async function PATCH(request: NextRequest) {
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

    const profile = await tx.memberProfile.findUnique({
      where: { gymUserId: account.gymUserId },
    });

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
    const data: Prisma.MemberProfileUpdateInput = {};

    // Members can only update certain fields about themselves
    if ('phone' in input) data.phone = typeof input.phone === 'string' ? input.phone.trim() || null : null;
    if ('emergencyContactName' in input) data.emergencyContactName = typeof input.emergencyContactName === 'string' ? input.emergencyContactName.trim() || null : null;
    if ('emergencyContactPhone' in input) data.emergencyContactPhone = typeof input.emergencyContactPhone === 'string' ? input.emergencyContactPhone.trim() || null : null;
    if ('dateOfBirth' in input) {
      const dob = typeof input.dateOfBirth === 'string' ? new Date(input.dateOfBirth) : null;
      if (dob && isNaN(dob.getTime())) {
        return NextResponse.json({ error: 'Invalid dateOfBirth.', requestId }, { status: 400 });
      }
      data.dateOfBirth = dob;
    }
    if ('gender' in input) data.gender = typeof input.gender === 'string' ? input.gender.trim() || null : null;
    if ('address' in input) data.address = typeof input.address === 'string' ? input.address.trim() || null : null;
    if ('weightKg' in input) data.weightKg = typeof input.weightKg === 'number' ? input.weightKg : null;
    if ('heightCm' in input) data.heightCm = typeof input.heightCm === 'number' ? input.heightCm : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.', requestId }, { status: 400 });
    }

    const updated = await tx.memberProfile.update({
      where: { id: profile.id },
      data,
    });

    await tx.auditEvent.create({
      data: {
        actor: accountId,
        action: 'member.profile.updated',
        target: updated.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ profile: memberToJson(updated) });
  });
}
