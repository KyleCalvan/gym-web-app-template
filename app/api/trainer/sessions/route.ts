import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { hasSameOrigin } from '@/src/auth/http';
import { prisma } from '@/src/auth/prisma';
import { gymDateISO } from '@/src/member/activityDates';

export const runtime = 'nodejs';

const gymTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

async function trainerFor(request: NextRequest) {
  const record = await readSession(requestSessionToken(request));
  if (!record) return { error: Response.json({ error: 'Sign in to continue.' }, { status: 401 }) };
  if (record.status.restricted || !record.status.roles.includes('trainer')) {
    return { error: Response.json({ error: 'Trainer access is required.' }, { status: 403 }) };
  }
  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: record.user.id, role: 'trainer' } },
    select: { profile: { select: { trainer: { select: { profileId: true } } } } },
  });
  const trainerId = assignment?.profile.trainer?.profileId;
  if (!trainerId) return { error: Response.json({ error: 'Trainer profile is unavailable.' }, { status: 404 }) };
  return { trainerId, accountId: record.user.id };
}

function invalidBody() {
  return Response.json({ error: 'Invalid session request.' }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const { trainerId, error } = await trainerFor(request);
    if (error) return error;
    const sessions = await prisma.coachingSession.findMany({
      where: { trainerId }, orderBy: { startsAt: 'desc' },
      select: {
        id: true, startsAt: true, type: true, status: true, rating: true,
        member: { select: { profile: { select: { gymUser: { select: { name: true } } } } } },
      },
    });
    return Response.json({ sessions: sessions.map(session => ({
      id: session.id,
      member: session.member.profile.gymUser.name ?? 'Member',
      date: gymDateISO(session.startsAt),
      time: gymTime.format(session.startsAt),
      type: session.type,
      status: session.status,
      rating: session.rating,
    })) }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Could not load trainer sessions.', error);
    return Response.json({ error: 'Assigned sessions could not be loaded.' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const { trainerId, error } = await trainerFor(request);
    if (error) return error;
    let body: unknown;
    try { body = await request.json(); } catch { return invalidBody(); }
    if (!body || typeof body !== 'object') return invalidBody();
    const { id, action, reason } = body as Record<string, unknown>;
    if (typeof id !== 'string' || !id || (action !== 'complete' && action !== 'cancel')
      || (action === 'cancel' && (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000))) {
      return invalidBody();
    }
    const now = new Date();
    const changed = await prisma.coachingSession.updateMany({
      where: { id, trainerId, status: 'Confirmed' },
      data: action === 'complete'
        ? { status: 'Completed', completedAt: now }
        : { status: 'Cancelled', cancelledAt: now, cancellationReason: (reason as string).trim() },
    });
    if (!changed.count) return Response.json({ error: 'This assigned session is no longer active.' }, { status: 409 });
    return Response.json({ status: action === 'complete' ? 'Completed' : 'Cancelled' },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Could not update trainer session.', error);
    return Response.json({ error: 'Session could not be updated.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const { trainerId, accountId, error } = await trainerFor(request);
    if (error) return error;
    let body: unknown;
    try { body = await request.json(); } catch { return invalidBody(); }
    if (!body || typeof body !== 'object') return invalidBody();
    const { id, newDateTime, reason } = body as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof newDateTime !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(newDateTime)
      || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) return invalidBody();
    const requestedStartsAt = new Date(`${newDateTime}:00+08:00`);
    if (!Number.isFinite(requestedStartsAt.getTime()) || requestedStartsAt <= new Date()
      || gymDateISO(requestedStartsAt) !== newDateTime.slice(0, 10)
      || gymTime.format(requestedStartsAt) !== newDateTime.slice(11)) {
      return Response.json({ error: 'Choose a valid future date and time.' }, { status: 400 });
    }
    const session = await prisma.coachingSession.findFirst({
      where: { id, trainerId, status: 'Confirmed' }, select: { id: true },
    });
    if (!session) return Response.json({ error: 'This assigned session is no longer active.' }, { status: 409 });
    await prisma.scheduleChangeRequest.create({ data: {
      coachingSessionId: id, requestedByAccountId: accountId,
      requestedStartsAt, reason: reason.trim(),
    } });
    return Response.json({ requested: true }, { status: 201,
      headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Could not request trainer schedule change.', error);
    return Response.json({ error: 'Schedule change request could not be sent.' }, { status: 503 });
  }
}
