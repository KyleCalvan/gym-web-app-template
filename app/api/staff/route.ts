import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function staffDisplayNumber(id: string): string {
  const num = parseInt(id.slice(-4), 16) % 10000;
  return `S-${String(num).padStart(4, '0')}`;
}

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

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.StaffProfileWhereInput = {};
    if (status === 'active') where.status = 'Active';
    else if (status) where.status = status as Prisma.EnumStaffStatusFilter;

    const [staff, total] = await Promise.all([
      tx.staffProfile.findMany({
        where,
        include: { gymUser: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.staffProfile.count({ where }),
    ]);

    return NextResponse.json({ staff: staff.map(staffToJson), total, limit, offset });
  });
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId) => {
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
    const gymUserId = typeof input.gymUserId === 'number' ? input.gymUserId : null;
    const jobRole = typeof input.jobRole === 'string' ? input.jobRole.trim() : '';
    const shift = typeof input.shift === 'string' ? input.shift.trim() : '';

    if (!gymUserId) {
      return NextResponse.json({ error: 'gymUserId is required.', requestId }, { status: 400 });
    }

    if (!['Front Desk', 'Sales', 'Manager'].includes(jobRole)) {
      return NextResponse.json({ error: 'Invalid jobRole. Use Front Desk, Sales, or Manager.', requestId }, { status: 400 });
    }

    if (!['Morning', 'Evening', 'Night'].includes(shift)) {
      return NextResponse.json({ error: 'Invalid shift. Use Morning, Evening, or Night.', requestId }, { status: 400 });
    }

    const gymUser = await tx.user.findUnique({ where: { id: gymUserId } });
    if (!gymUser) {
      return NextResponse.json({ error: 'User not found.', requestId }, { status: 404 });
    }

    const existing = await tx.staffProfile.findUnique({ where: { gymUserId } });
    if (existing) {
      return NextResponse.json({ error: 'Staff profile already exists for this user.', requestId }, { status: 409 });
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'staff:' + gymUserId}, 0))`;

    const staff = await tx.staffProfile.create({
      data: {
        gymUserId,
        displayNumber: '', // Will be updated
        jobRole,
        shift,
        phone: typeof input.phone === 'string' ? input.phone.trim() || null : null,
        phoneSecondary: typeof input.phoneSecondary === 'string' ? input.phoneSecondary.trim() || null : null,
        status: 'Active',
        hireDate: typeof input.hireDate === 'string' ? new Date(input.hireDate) : null,
      },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    const updated = await tx.staffProfile.update({
      where: { id: staff.id },
      data: { displayNumber: staffDisplayNumber(staff.id) },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    // Ensure staff role
    const profile = await tx.roleProfile.upsert({
      where: { gymUserId_role: { gymUserId, role: 'staff' } },
      create: { gymUserId, role: 'staff' },
      update: {},
    });

    const account = await tx.authUser.findUnique({ where: { gymUserId } });
    if (account) {
      await tx.assignedRole.upsert({
        where: { accountId_role: { accountId: account.id, role: 'staff' } },
        create: { accountId: account.id, role: 'staff', profileId: profile.id },
        update: {},
      });
    }

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'staff.created',
        target: updated.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ staff: staffToJson(updated) }, { status: 201 });
  });
}
