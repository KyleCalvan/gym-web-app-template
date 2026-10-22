import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer'] as GymRole[], async (tx, requestId) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, email: true, name: true } },
        trainer: { select: { id: true, displayNumber: true, gymUser: { select: { name: true } } } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.', requestId }, { status: 404 });
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
    const action = typeof input.action === 'string' ? input.action : '';

    if (action === 'confirm') {
      if (booking.status !== 'Pending') {
        return NextResponse.json({ error: 'Only pending bookings can be confirmed.', requestId }, { status: 400 });
      }
      const updated = await tx.booking.update({
        where: { id },
        data: { status: 'Confirmed', confirmedAt: new Date() },
        include: {
          member: { select: { id: true, email: true, name: true } },
          trainer: { select: { id: true, displayNumber: true, gymUser: { select: { name: true } } } },
        },
      });
      await tx.auditEvent.create({
        data: { actor: requestId, action: 'booking.confirmed', target: id, result: 'success', requestId },
      });
      return NextResponse.json({ booking: bookingToJson(updated) });
    }

    if (action === 'complete') {
      if (booking.status !== 'Confirmed') {
        return NextResponse.json({ error: 'Only confirmed bookings can be completed.', requestId }, { status: 400 });
      }
      const updated = await tx.booking.update({
        where: { id },
        data: { status: 'Completed', completedAt: new Date() },
        include: {
          member: { select: { id: true, email: true, name: true } },
          trainer: { select: { id: true, displayNumber: true, gymUser: { select: { name: true } } } },
        },
      });
      await tx.auditEvent.create({
        data: { actor: requestId, action: 'booking.completed', target: id, result: 'success', requestId },
      });
      return NextResponse.json({ booking: bookingToJson(updated) });
    }

    if (action === 'cancel') {
      if (!['Pending', 'Confirmed'].includes(booking.status)) {
        return NextResponse.json({ error: 'Only pending or confirmed bookings can be cancelled.', requestId }, { status: 400 });
      }
      const reason = typeof input.reason === 'string' ? input.reason.trim() || null : null;
      const updated = await tx.booking.update({
        where: { id },
        data: { status: 'Cancelled', cancelledAt: new Date(), cancellationReason: reason },
        include: {
          member: { select: { id: true, email: true, name: true } },
          trainer: { select: { id: true, displayNumber: true, gymUser: { select: { name: true } } } },
        },
      });

      // Release the availability slot
      await tx.trainerAvailability.updateMany({
        where: { trainerId: booking.trainerId, date: booking.date, startTime: booking.startTime, endTime: booking.endTime },
        data: { status: 'available' },
      });

      await tx.auditEvent.create({
        data: { actor: requestId, action: 'booking.cancelled', target: id, result: 'success', requestId },
      });
      return NextResponse.json({ booking: bookingToJson(updated) });
    }

    if (action === 'mark-no-show') {
      if (booking.status !== 'Confirmed') {
        return NextResponse.json({ error: 'Only confirmed bookings can be marked as no-show.', requestId }, { status: 400 });
      }
      const updated = await tx.booking.update({
        where: { id },
        data: { status: 'NoShow' },
        include: {
          member: { select: { id: true, email: true, name: true } },
          trainer: { select: { id: true, displayNumber: true, gymUser: { select: { name: true } } } },
        },
      });
      await tx.auditEvent.create({
        data: { actor: requestId, action: 'booking.noshow', target: id, result: 'success', requestId },
      });
      return NextResponse.json({ booking: bookingToJson(updated) });
    }

    return NextResponse.json({ error: 'Invalid action. Use confirm, complete, cancel, or mark-no-show.', requestId }, { status: 400 });
  });
}
