import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole, CheckInSource } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

const BOOKING_TIME_ZONE = process.env.BOOKING_TIME_ZONE || 'Asia/Manila';

function getBusinessDate(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

function checkInToJson(c: {
  id: string;
  memberId: number;
  businessDate: string;
  checkedInAt: Date;
  source: string;
  checkedBy: string | null;
  createdAt: Date;
  member: { id: number; email: string; name: string | null } | null;
}) {
  return {
    id: c.id,
    memberId: c.memberId,
    businessDate: c.businessDate,
    checkedInAt: c.checkedInAt.toISOString(),
    source: c.source,
    checkedBy: c.checkedBy,
    createdAt: c.createdAt.toISOString(),
    member: c.member,
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer'] as GymRole[], async (tx, requestId, caller) => {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const memberId = searchParams.get('memberId');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.CheckInWhereInput = {};
    if (date) where.businessDate = date;
    if (memberId) where.memberId = Number(memberId);

    const [checkIns, total] = await Promise.all([
      tx.checkIn.findMany({
        where,
        include: { member: { select: { id: true, email: true, name: true } } },
        orderBy: { checkedInAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.checkIn.count({ where }),
    ]);

    // Get today's count if no specific date
    let todayCount = 0;
    if (!date) {
      const today = getBusinessDate(BOOKING_TIME_ZONE);
      todayCount = await tx.checkIn.count({ where: { businessDate: today } });
    }

    return NextResponse.json({
      checkIns: checkIns.map(checkInToJson),
      total,
      limit,
      offset,
      today: date || getBusinessDate(BOOKING_TIME_ZONE),
      todayCount: date ? checkIns.length : todayCount,
    });
  });
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff', 'member'] as GymRole[], async (tx, requestId, caller) => {
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
    const memberId = typeof input.memberId === 'number' ? input.memberId : null;

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required.', requestId }, { status: 400 });
    }

    const member = await tx.memberProfile.findUnique({
      where: { gymUserId: memberId },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found.', requestId }, { status: 404 });
    }

    const businessDate = getBusinessDate(BOOKING_TIME_ZONE);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'checkin:' + memberId + ':' + businessDate}, 0))`;

    const existing = await tx.checkIn.findUnique({
      where: { memberId_businessDate: { memberId, businessDate } },
    });

    if (existing) {
      return NextResponse.json({
        error: 'Member already checked in today.',
        requestId,
        checkIn: checkInToJson({ ...existing, member: member.gymUser }),
      }, { status: 409 });
    }

    // Determine source based on auth role
    const isStaff = caller.roles.some(r => r === 'admin' || r === 'staff');
    const source = isStaff ? 'Staff' : 'Self';

    const checkIn = await tx.checkIn.create({
      data: {
        memberId,
        businessDate,
        source: source as CheckInSource,
        checkedBy: source === 'Staff' ? caller.accountId : null,
      },
      include: { member: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'checkin.created',
        target: checkIn.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ checkIn: checkInToJson(checkIn) }, { status: 201 });
  });
}
