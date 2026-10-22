import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function availabilityToJson(a: {
  id: string;
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    trainerId: a.trainerId,
    date: a.date,
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer', 'member'] as GymRole[], async (tx, requestId) => {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Prisma.TrainerAvailabilityWhereInput = { trainerId: id };
    if (from) where.date = { gte: from };
    if (to) where.date = { ...where.date, lte: to };

    const slots = await tx.trainerAvailability.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({ availability: slots.map(availabilityToJson) });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'trainer'] as GymRole[], async (tx, requestId) => {
    const trainer = await tx.trainerProfile.findUnique({ where: { id } });
    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found.', requestId }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    const slots = Array.isArray(body) ? body : [body];
    if (slots.length === 0) {
      return NextResponse.json({ error: 'At least one availability slot is required.', requestId }, { status: 400 });
    }

    const created: { id: string; trainerId: string; date: string; startTime: string; endTime: string; status: string; createdAt: Date; updatedAt: Date }[] = [];

    for (const slot of slots) {
      const s = slot as Record<string, unknown>;
      const date = typeof s.date === 'string' ? s.date : '';
      const startTime = typeof s.startTime === 'string' ? s.startTime : '';
      const endTime = typeof s.endTime === 'string' ? s.endTime : '';

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: `Invalid date format: ${date}. Use YYYY-MM-DD.`, requestId }, { status: 400 });
      }
      if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
        return NextResponse.json({ error: 'Invalid time format. Use HH:MM.', requestId }, { status: 400 });
      }
      if (startTime >= endTime) {
        return NextResponse.json({ error: 'startTime must be before endTime.', requestId }, { status: 400 });
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'availability:' + id + ':' + date}, 0))`;

      const existing = await tx.trainerAvailability.findUnique({
        where: { trainerId_date_startTime_endTime: { trainerId: id, date, startTime, endTime } },
      });

      if (!existing) {
        const slot = await tx.trainerAvailability.create({
          data: { trainerId: id, date, startTime, endTime, status: 'available' },
        });
        created.push(slot);
      }
    }

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'trainer.availability.created',
        target: id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ availability: created.map(availabilityToJson) }, { status: 201 });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'trainer'] as GymRole[], async (tx, requestId) => {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');

    if (!slotId) {
      return NextResponse.json({ error: 'slotId is required.', requestId }, { status: 400 });
    }

    const slot = await tx.trainerAvailability.findUnique({
      where: { id: slotId, trainerId: id },
    });

    if (!slot) {
      return NextResponse.json({ error: 'Availability slot not found.', requestId }, { status: 404 });
    }

    if (slot.status === 'booked') {
      return NextResponse.json({ error: 'Cannot delete a booked slot.', requestId }, { status: 400 });
    }

    await tx.trainerAvailability.delete({ where: { id: slotId } });

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'trainer.availability.deleted',
        target: slotId,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ deleted: true });
  });
}
