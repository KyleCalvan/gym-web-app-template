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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer', 'member'] as GymRole[], async (tx, requestId, caller) => {
    const profile = await tx.memberProfile.findUnique({
      where: { id },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
    }

    return NextResponse.json({ member: memberToJson(profile) });
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

    const input = body as Record<string, unknown>;
    const data: Prisma.MemberProfileUpdateInput = {};

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

    const profile = await tx.memberProfile.update({
      where: { id },
      data,
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'member.updated',
        target: profile.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ member: memberToJson(profile) });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId, caller) => {
    const profile = await tx.memberProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
    }

    const updated = await tx.memberProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'member.deleted',
        target: updated.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ member: memberToJson(updated) });
  });
}
