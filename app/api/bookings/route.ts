import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function bookingToJson(b: {
  id: string;
  memberId: number;
  trainerId: string;
  orderId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  priceCentavos: number;
  paid: boolean;
  notes: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  completedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  member: { id: number; email: string; name: string | null } | null;
  trainer: { id: string; displayNumber: string; gymUser: { name: string | null } | null } | null;
}) {
  return {
    id: b.id,
    memberId: b.memberId,
    trainerId: b.trainerId,
    orderId: b.orderId,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    priceCentavos: b.priceCentavos,
    paid: b.paid,
    notes: b.notes,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    cancellationReason: b.cancellationReason,
    completedAt: b.completedAt?.toISOString() ?? null,
    confirmedAt: b.confirmedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    member: b.member,
    trainer: b.trainer?.gymUser?.name ?? b.trainer?.displayNumber ?? null,
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer', 'member'] as GymRole[], async (tx, requestId, caller) => {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const trainerId = searchParams.get('trainerId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.BookingWhereInput = {};
    if (memberId) where.memberId = Number(memberId);
    if (trainerId) where.trainerId = trainerId;
    if (date) where.date = date;
    if (status) where.status = status as Prisma.EnumBookingStatusFilter;

    const [bookings, total] = await Promise.all([
      tx.booking.findMany({
        where,
        include: {
          member: { select: { id: true, email: true, name: true } },
          trainer: { select: { id: true, displayNumber: true, gymUser: { select: { name: true } } } },
        },
        orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
        take: limit,
        skip: offset,
      }),
      tx.booking.count({ where }),
    ]);

    return NextResponse.json({ bookings: bookings.map(bookingToJson), total, limit, offset });
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
    const trainerId = typeof input.trainerId === 'string' ? input.trainerId : '';
    const date = typeof input.date === 'string' ? input.date : '';
    const startTime = typeof input.startTime === 'string' ? input.startTime : '';
    const endTime = typeof input.endTime === 'string' ? input.endTime : '';
    const notes = typeof input.notes === 'string' ? input.notes.trim() || null : null;

    if (!memberId || !trainerId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'memberId, trainerId, date, startTime, and endTime are required.', requestId }, { status: 400 });
    }

    // The UI addresses trainers by display number ("T-0004"); accept either.
    const trainer = await tx.trainerProfile.findFirst({
      where: { OR: [{ id: trainerId }, { displayNumber: trainerId }] },
      include: { gymUser: { select: { name: true } } },
    });
    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found.', requestId }, { status: 404 });
    }

    if (trainer.status !== 'Active') {
      return NextResponse.json({ error: 'Trainer is not available for booking.', requestId }, { status: 400 });
    }

    // Admins may assign a session on another member's behalf without a slot,
    // but booking for themselves is a member action and consumes a real slot.
    const assigningForOther = caller.roles.includes('admin') && memberId !== caller.gymUserId;
    let availability: { id: string; status: 'available' | 'unavailable' | 'booked' } | null = null;
    if (!assigningForOther) {
      availability = await tx.trainerAvailability.findUnique({
        where: { trainerId_date_startTime_endTime: { trainerId: trainer.id, date, startTime, endTime } },
      });
      if (!availability || availability.status !== 'available') {
        return NextResponse.json({ error: 'Time slot not available.', requestId }, { status: 400 });
      }
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'booking:' + trainerId + ':' + date}, 0))`;

    const booking = await tx.booking.create({
      data: {
        memberId,
        trainerId: trainer.id,
        date,
        startTime,
        endTime,
        status: 'Pending',
        priceCentavos: trainer.sessionRate,
        paid: false,
        notes,
      },
      include: {
        member: { select: { id: true, email: true, name: true } },
        trainer: { select: { id: true, displayNumber: true, gymUser: { select: { name: true } } } },
      },
    });

    // Mark availability as booked (when a slot was required and found)
    if (availability) {
      await tx.trainerAvailability.update({
        where: { id: availability.id },
        data: { status: 'booked' },
      });
    }

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'booking.created',
        target: booking.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ booking: bookingToJson(booking) }, { status: 201 });
  });
}
