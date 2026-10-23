import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function staffToJson(s: {
  id: string;
  gymUserId: number;
  displayNumber: string;
  jobRole: string;
  shift: string;
  phone: string | null;
  phoneSecondary: string | null;
  status: string;
  hireDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  gymUser: { id: number; email: string; name: string | null } | null;
}) {
  return {
    id: s.id,
    gymUserId: s.gymUserId,
    displayNumber: s.displayNumber,
    jobRole: s.jobRole,
    shift: s.shift,
    phone: s.phone,
    phoneSecondary: s.phoneSecondary,
    status: s.status,
    hireDate: s.hireDate?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    deletedAt: s.deletedAt?.toISOString() ?? null,
    user: s.gymUser ? { id: s.gymUser.id, email: s.gymUser.email, name: s.gymUser.name } : null,
  };
}

async function resolveStaff(tx: Prisma.TransactionClient, value: string) {
  return tx.staffProfile.findFirst({
    where: { OR: [{ id: value }, { displayNumber: value }] },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId, caller) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be an object.', requestId }, { status: 400 });
    }

    const existing = await resolveStaff(tx, id);
    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found.', requestId }, { status: 404 });
    }

    const input = body as Record<string, unknown>;
    const data: Prisma.StaffProfileUpdateInput = {};

    if ('jobRole' in input && typeof input.jobRole === 'string') {
      if (!['Front Desk', 'Sales', 'Manager'].includes(input.jobRole)) {
        return NextResponse.json({ error: 'Invalid jobRole. Use Front Desk, Sales, or Manager.', requestId }, { status: 400 });
      }
      data.jobRole = input.jobRole;
    }
    if ('shift' in input && typeof input.shift === 'string') {
      if (!['Morning', 'Evening', 'Night'].includes(input.shift)) {
        return NextResponse.json({ error: 'Invalid shift. Use Morning, Evening, or Night.', requestId }, { status: 400 });
      }
      data.shift = input.shift;
    }
    if ('status' in input && typeof input.status === 'string') {
      if (!['Active', 'On Leave', 'Inactive'].includes(input.status)) {
        return NextResponse.json({ error: 'Invalid status. Use Active, On Leave, or Inactive.', requestId }, { status: 400 });
      }
      data.status = input.status as Prisma.StaffProfileUpdateInput['status'];
    }
    if ('phone' in input) data.phone = typeof input.phone === 'string' ? input.phone.trim() || null : null;
    if ('phoneSecondary' in input) data.phoneSecondary = typeof input.phoneSecondary === 'string' ? input.phoneSecondary.trim() || null : null;

    // The staff member's display name lives on the canonical User account.
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name) {
      await tx.user.update({ where: { id: existing.gymUserId }, data: { name } });
    }

    if (Object.keys(data).length === 0 && !name) {
      return NextResponse.json({ error: 'No valid fields to update.', requestId }, { status: 400 });
    }

    const staff = await tx.staffProfile.update({
      where: { id: existing.id },
      data,
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'staff.updated',
        target: staff.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ staff: staffToJson(staff) });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId, caller) => {
    const existing = await resolveStaff(tx, id);
    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found.', requestId }, { status: 404 });
    }

    const staff = await tx.staffProfile.update({
      where: { id: existing.id },
      data: { status: 'Inactive', deletedAt: new Date() },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'staff.deleted',
        target: staff.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ staff: staffToJson(staff) });
  });
}
