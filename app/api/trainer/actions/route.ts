import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { MAX_AVAILABILITY_SLOTS_PER_DAY, validateAvailabilityWindow } from '@/src/trainer/availability';

export const runtime = 'nodejs';

function gymDateTime(day: unknown, time: unknown) {
  if (typeof day !== 'string' || typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const calendarDate = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== day) return null;
  const value = new Date(`${day}T${time}:00+08:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['trainer'], async (tx, requestId) => {
    const accountId = authRequestContext.getStore()?.accountId;
    const assignment = accountId && await tx.assignedRole.findFirst({ where: { accountId, role: 'trainer',
      profile: { archivedAt: null, status: 'Active' } } });
    if (!assignment) return apiError(403, 'FORBIDDEN', 'An active trainer profile is required.', requestId);
    let body: { action?: string; id?: string; date?: string; startTime?: string; endTime?: string;
      status?: string; reason?: string; requestedStartsAt?: string; name?: string; email?: string;
      specialty?: string; bio?: string; avatarUrl?: string };
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Enter a valid trainer change.', requestId); }
    if (!body || typeof body.action !== 'string') return apiError(400, 'INVALID_REQUEST', 'Enter a valid trainer change.', requestId);
    const trainerId = assignment.profileId;
    const fail = (message: string) => apiError(400, 'INVALID_INPUT', message, requestId);
    if (body.action === 'session.complete' || body.action === 'session.cancel') {
      const session = body.id && await tx.coachingSession.findFirst({ where: { id: body.id, trainerId } });
      if (!session || ['Completed', 'Cancelled'].includes(session.status)) return fail('Choose an active assigned session.');
      if (body.action === 'session.cancel' && (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 500))
        return fail('Enter a cancellation reason.');
      await tx.coachingSession.update({ where: { id: session.id }, data: body.action === 'session.complete'
        ? { status: 'Completed', completedAt: new Date() }
        : { status: 'Cancelled', cancelledAt: new Date(), cancellationReason: body.reason!.trim() } });
    } else if (body.action === 'session.request-change') {
      const session = body.id && await tx.coachingSession.findFirst({ where: { id: body.id, trainerId } });
      const requestedStartsAt = typeof body.requestedStartsAt === 'string' ? new Date(body.requestedStartsAt) : null;
      if (!session || ['Completed', 'Cancelled'].includes(session.status) || !requestedStartsAt
        || Number.isNaN(requestedStartsAt.getTime()) || requestedStartsAt <= new Date()
        || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 500)
        return fail('Choose an active session, future date, and reason.');
      await tx.scheduleChangeRequest.create({ data: { coachingSessionId: session.id,
        requestedByAccountId: accountId, requestedStartsAt, reason: body.reason.trim() } });
    } else if (body.action === 'availability.save') {
      const startsAt = gymDateTime(body.date, body.startTime);
      const endsAt = gymDateTime(body.date, body.endTime);
      if (!startsAt || !endsAt || startsAt >= endsAt || startsAt < new Date()
        || (body.status !== 'available' && body.status !== 'unavailable')) return fail('Choose a future time range and status.');
      const windowError = validateAvailabilityWindow(body.startTime!, body.endTime!);
      if (windowError) return fail(windowError);
      const dayStart = gymDateTime(body.date, '00:00')!;
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const existingSlots = await tx.trainerAvailability.count({ where: { trainerId,
        ...(body.id ? { id: { not: body.id } } : {}),
        startsAt: { gte: dayStart, lt: dayEnd } } });
      if (existingSlots >= MAX_AVAILABILITY_SLOTS_PER_DAY)
        return fail(`A trainer can have at most ${MAX_AVAILABILITY_SLOTS_PER_DAY} schedule slots per day.`);
      const conflicting = await tx.trainerAvailability.findFirst({ where: { trainerId,
        ...(body.id ? { id: { not: body.id } } : {}), startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
      if (conflicting) return fail('This time overlaps another availability entry.');
      if (body.status === 'unavailable') {
        const booking = await tx.coachingSession.findFirst({ where: { trainerId,
          status: { notIn: ['Cancelled', 'Completed'] }, startsAt: { gte: startsAt, lt: endsAt } } });
        if (booking) return fail('This time includes an active booking.');
      }
      if (body.id) {
        const existing = await tx.trainerAvailability.findFirst({ where: { id: body.id, trainerId } });
        if (!existing) return fail('Availability entry not found.');
        await tx.trainerAvailability.update({ where: { id: body.id }, data: { startsAt, endsAt, status: body.status } });
      } else await tx.trainerAvailability.create({ data: { trainerId, startsAt, endsAt, status: body.status } });
    } else if (body.action === 'availability.delete') {
      const existing = body.id && await tx.trainerAvailability.findFirst({ where: { id: body.id, trainerId } });
      if (!existing) return fail('Availability entry not found.');
      await tx.trainerAvailability.delete({ where: { id: existing.id } });
    } else if (body.action === 'profile.update') {
      const account = await tx.authUser.findUnique({ where: { id: accountId! } });
      if (!account?.gymUserId || body.email !== account.email || typeof body.name !== 'string'
        || !body.name.trim() || body.name.length > 120 || typeof body.specialty !== 'string'
        || body.specialty.length > 120 || typeof body.bio !== 'string' || body.bio.length > 1000)
        return fail('Enter a valid name, specialty, and bio. Email changes require verification.');
      if (body.avatarUrl !== undefined && (typeof body.avatarUrl !== 'string' || body.avatarUrl.length > 2_100_000
        || !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(body.avatarUrl))) return fail('Choose a valid photo.');
      await tx.user.update({ where: { id: account.gymUserId }, data: { name: body.name.trim(),
        ...(body.avatarUrl ? { avatarUrl: body.avatarUrl } : {}) } });
      await tx.authUser.update({ where: { id: account.id }, data: { name: body.name.trim() } });
      await tx.trainerProfile.update({ where: { profileId: trainerId }, data: { specialty: body.specialty.trim(), bio: body.bio.trim() } });
    } else return fail('This trainer action is unavailable.');
    await tx.auditEvent.create({ data: { actor: accountId, actorRole: 'trainer', action: body.action,
      target: body.id ?? trainerId, result: 'success', requestId } });
    return NextResponse.json({ ok: true });
  });
}
