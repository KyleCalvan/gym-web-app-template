import { NextRequest } from 'next/server';
import { prisma } from '@/src/auth/prisma';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { hasSameOrigin } from '@/src/auth/http';
import { getBookingCurrentTime, getBookingToday } from '@/src/member/bookingDates';
import { timeInMinutes } from '@/src/trainer/availability';
import type { Prisma } from '@/backend/generated/prisma/client';

export const runtime = 'nodejs';

const noStore = { 'cache-control': 'private, no-store' };
const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
});
const localTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function dateOf(value: Date) {
  const parts = localDate.formatToParts(value);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function timestamp(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`);
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: noStore });
}

async function trainerFor(request: NextRequest) {
  const record = await readSession(requestSessionToken(request));
  if (!record) return { denied: error(401, 'Sign in to continue.') };
  if (record.status.restricted || !record.status.roles.includes('trainer')) {
    return { denied: error(403, 'Trainer access is required.') };
  }
  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: record.user.id, role: 'trainer' } },
    select: { profile: { select: { trainer: { select: { profileId: true } },
      gymUser: { select: { name: true } } } } },
  });
  const trainerId = assignment?.profile.trainer?.profileId;
  if (!trainerId) return { denied: error(404, 'Trainer profile is unavailable.') };
  return { trainerId, trainerName: assignment.profile.gymUser.name ?? 'Trainer' };
}

function toSlot(slot: { id: string; trainerId: string; startsAt: Date; endsAt: Date; status: string }) {
  return { id: slot.id, trainerId: slot.trainerId, date: dateOf(slot.startsAt),
    startTime: localTime.format(slot.startsAt), endTime: localTime.format(slot.endsAt), status: slot.status };
}

export async function GET(request: NextRequest) {
  try {
    const { trainerId, trainerName, denied } = await trainerFor(request);
    if (denied) return denied;
    const [availability, sessions] = await Promise.all([
      prisma.trainerAvailability.findMany({ where: { trainerId }, orderBy: { startsAt: 'asc' } }),
      prisma.coachingSession.findMany({ where: { trainerId }, orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, type: true, status: true, amount: true,
          member: { select: { profile: { select: { gymUser: { select: { name: true, email: true, phone: true } } } } } } },
      }),
    ]);
    return Response.json({ trainerId, trainerName, availability: availability.map(toSlot),
      sessions: sessions.map(session => ({
        id: session.id, member: session.member.profile.gymUser.name ?? 'Member',
        memberEmail: session.member.profile.gymUser.email,
        memberPhone: session.member.profile.gymUser.phone,
        trainer: trainerName, date: dateOf(session.startsAt), time: localTime.format(session.startsAt),
        type: session.type, status: session.status, paid: session.status !== 'Pending',
        amount: Number(session.amount),
      })) }, { headers: noStore });
  } catch (cause) {
    console.error('Could not load trainer availability.', cause);
    return error(503, 'Schedule could not be loaded.');
  }
}

type Slot = { id: string; startsAt: Date; endsAt: Date; status: 'available' | 'unavailable' };

function validateDay(slots: Slot[], bookings: { id: string; startsAt: Date }[], date: string) {
  const daySlots = slots.filter(slot => dateOf(slot.startsAt) === date);
  for (const slot of daySlots) {
    if (slot.endsAt <= slot.startsAt || dateOf(slot.endsAt) !== date) {
      return 'Enter a valid start and end time on the same date.';
    }
    if (daySlots.some(other => other.id !== slot.id
      && slot.startsAt < other.endsAt && other.startsAt < slot.endsAt)) {
      return 'This time overlaps another availability schedule.';
    }
  }
  for (const booking of bookings.filter(item => dateOf(item.startsAt) === date)) {
    const bookingEnd = new Date(booking.startsAt.getTime() + 3_600_000);
    if (!daySlots.some(slot => slot.status === 'available'
      && slot.startsAt <= booking.startsAt && slot.endsAt >= bookingEnd)
      || daySlots.some(slot => slot.status === 'unavailable'
        && slot.startsAt < bookingEnd && slot.endsAt > booking.startsAt)) {
      return `This change conflicts with booking ${booking.id}. Keep an available hour around that booking.`;
    }
  }
  return null;
}

async function mutate(request: NextRequest, method: 'POST' | 'PATCH' | 'DELETE') {
  if (!hasSameOrigin(request)) return error(403, 'Invalid request origin.');
  try {
    const { trainerId, denied } = await trainerFor(request);
    if (denied) return denied;
    let body: unknown;
    try { body = await request.json(); } catch { return error(400, 'Invalid schedule request.'); }
    if (!body || typeof body !== 'object') return error(400, 'Invalid schedule request.');
    const payload = body as Record<string, unknown>;
    const id = payload.id;
    if (method !== 'POST' && (typeof id !== 'string' || !id || id.length > 120)) {
      return error(400, 'Choose an availability schedule.');
    }
    if (method !== 'DELETE' && (!validDate(payload.date) || !validTime(payload.startTime)
      || !validTime(payload.endTime) || !['available', 'unavailable'].includes(String(payload.status)))) {
      return error(400, 'Enter a valid date, time, and schedule status.');
    }
    const date = method === 'DELETE' ? null : payload.date as string;
    const start = date ? timestamp(date, payload.startTime as string) : null;
    const end = date ? timestamp(date, payload.endTime as string) : null;
    if (start && end && (start >= end || dateOf(start) !== date || dateOf(end) !== date)) {
      return error(400, 'End time must be later than start time on the same date.');
    }
    if (date && (date < getBookingToday() || (date === getBookingToday()
      && timeInMinutes(payload.startTime as string)! <= timeInMinutes(getBookingCurrentTime())!))) {
      return error(400, 'Availability must start at a future date and time.');
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'trainer-availability:' + trainerId}, 0))`;
      const existing = await tx.trainerAvailability.findMany({ where: { trainerId } });
      const original = method === 'POST' ? null : existing.find(slot => slot.id === id);
      if (method !== 'POST' && !original) return error(404, 'Availability schedule was not found.');
      if (original && dateOf(original.startsAt) < getBookingToday()) {
        return error(409, 'Past availability schedules cannot be changed.');
      }
      const candidate: Slot[] = existing.filter(slot => slot.id !== id).map(slot => ({
        id: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, status: slot.status,
      }));
      if (start && end) candidate.push({ id: typeof id === 'string' ? id : 'new', startsAt: start,
        endsAt: end, status: payload.status as Slot['status'] });
      const affectedDates = [...new Set([date, original && dateOf(original.startsAt)].filter((item): item is string => Boolean(item)))];
      const sortedDates = [...affectedDates].sort();
      const bookings = await tx.coachingSession.findMany({
        where: { trainerId, status: { in: ['Pending', 'Confirmed'] },
          startsAt: { gte: timestamp(sortedDates[0], '00:00'),
            lt: new Date(timestamp(sortedDates[sortedDates.length - 1], '00:00').getTime() + 86_400_000) } },
        select: { id: true, startsAt: true },
      });
      for (const affected of affectedDates) {
        const conflict = validateDay(candidate, bookings, affected);
        if (conflict) return error(409, conflict);
      }
      if (method === 'DELETE') {
        await tx.trainerAvailability.delete({ where: { id: original!.id } });
        return Response.json({ deleted: true }, { headers: noStore });
      }
      const data = { startsAt: start!, endsAt: end!, status: payload.status as Slot['status'] };
      const saved = method === 'POST'
        ? await tx.trainerAvailability.create({ data: { ...data, trainerId } })
        : await tx.trainerAvailability.update({ where: { id: original!.id }, data });
      return Response.json({ availability: toSlot(saved) }, { status: method === 'POST' ? 201 : 200, headers: noStore });
    });
  } catch (cause) {
    console.error('Could not save trainer availability.', cause);
    return error(503, 'Schedule could not be saved.');
  }
}

export async function POST(request: NextRequest) { return mutate(request, 'POST'); }
export async function PATCH(request: NextRequest) { return mutate(request, 'PATCH'); }
export async function DELETE(request: NextRequest) { return mutate(request, 'DELETE'); }
