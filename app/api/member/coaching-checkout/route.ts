import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';
import { getBookingDatesError } from '@/src/member/bookingDates';
import { getCoachingSessionPricePhp } from '@/src/member/coachingPrice';
import { createTestCheckout } from '@/src/paymongo/checkout';
import { releaseAbandonedCoachingCheckouts } from '@/src/paymongo/cancelCoachingCheckout';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const origin = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const session = await readSession(requestSessionToken(request));
  if (!session) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (session.status.restricted || !session.status.roles.includes('member')) {
    return Response.json({ error: 'Member access is required.' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const data = body as { trainerId?: unknown; dates?: unknown; time?: unknown; expectedTotal?: unknown } | null;
  const dates = data?.dates;
  const time = data?.time;
  if (typeof data?.trainerId !== 'string' || data.trainerId.length > 120
    || !Array.isArray(dates) || dates.length < 1 || dates.length > 10
    || !dates.every(date => typeof date === 'string') || getBookingDatesError(dates)
    || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return Response.json({ error: 'Choose a valid trainer, date, and time.' }, { status: 400 });
  }
  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: session.user.id, role: 'member' } },
    include: { profile: { include: { member: true } } },
  });
  const memberId = assignment?.profile.member?.profileId;
  if (!memberId) return Response.json({ error: 'Member profile is unavailable.' }, { status: 404 });
  const email = session.user.email;
  if (!email) return Response.json({ error: 'An email address is required for checkout.' }, { status: 400 });
  const trainer = await prisma.trainerProfile.findUnique({
    where: { profileId: data.trainerId },
    select: { profileId: true, sessionPrice: true,
      profile: { select: { archivedAt: true, status: true, gymUser: { select: { name: true } } } } },
  });
  const sessionPrice = Number(trainer?.sessionPrice);
  const unitCentavos = Math.round(getCoachingSessionPricePhp(sessionPrice) * 100);
  if (!trainer || trainer.profile.archivedAt || trainer.profile.status !== 'Active'
    || !Number.isSafeInteger(unitCentavos) || unitCentavos < 100) {
    return Response.json({ error: 'This trainer is unavailable for checkout.' }, { status: 400 });
  }
  const starts = dates.map(date => new Date(`${date}T${time}:00+08:00`)).sort((a, b) => a.getTime() - b.getTime());
  if (starts.some(start => !Number.isFinite(start.getTime()) || start <= new Date())) {
    return Response.json({ error: 'Choose a future session time.' }, { status: 400 });
  }
  const ends = starts.map(start => new Date(start.getTime() + 3_600_000));
  await releaseAbandonedCoachingCheckouts();
  const available = await prisma.trainerAvailability.findMany({
    where: { trainerId: trainer.profileId, startsAt: { lte: ends[ends.length - 1] },
      endsAt: { gte: starts[0] } },
    select: { startsAt: true, endsAt: true, status: true },
  });
  if (starts.some((start, i) => !available.some(slot => slot.status === 'available'
    && slot.startsAt <= start && slot.endsAt >= ends[i]
    && (start.getTime() - slot.startsAt.getTime()) % 3_600_000 === 0)
    || available.some(slot => slot.status === 'unavailable'
      && slot.startsAt < ends[i] && slot.endsAt > start))) {
    return Response.json({ error: 'A selected coaching time is no longer available.' }, { status: 409 });
  }
  const occupied = await prisma.coachingSession.findMany({
    where: { trainerId: trainer.profileId, status: { in: ['Pending', 'Confirmed'] },
      startsAt: { gte: new Date(starts[0].getTime() - 3_600_000), lt: ends[ends.length - 1] } },
    select: { startsAt: true },
  });
  if (starts.some((start, i) => occupied.some(slot =>
    slot.startsAt < ends[i] && slot.startsAt.getTime() + 3_600_000 > start.getTime()))) {
    return Response.json({ error: 'A selected coaching time was just booked.' }, { status: 409 });
  }
  if (!process.env.PAYMONGO_SECRET_KEY?.trim().startsWith('sk_test_')) {
    return Response.json({ error: 'PayMongo test checkout is not configured yet.' }, { status: 503 });
  }
  const configuredFee = Number(process.env.NEXT_PUBLIC_GCASH_TEST_FEE_PHP || 0);
  const feeCentavos = Math.round(configuredFee * 100);
  const totalCentavos = unitCentavos * starts.length + feeCentavos;
  if (!Number.isSafeInteger(feeCentavos) || feeCentavos < 0 || !Number.isSafeInteger(totalCentavos)
    || totalCentavos > 10_000_000) {
    return Response.json({ error: 'The payment amount is unavailable.' }, { status: 400 });
  }
  if (typeof data.expectedTotal !== 'number' || Math.round(data.expectedTotal * 100) !== totalCentavos) {
    return Response.json({ error: 'The coaching price changed. Review the amount before paying.' }, { status: 409 });
  }
  const reference = `COACH-${randomUUID()}`;
  let transaction: { id: string };
  try {
    transaction = await prisma.$transaction(async tx => {
      const payment = await tx.paymentTransaction.create({ data: {
        reference, memberId, customerName: session.user.name || email,
        type: `Coaching sessions with ${trainer.profile.gymUser.name}`,
        method: 'GCash', amount: totalCentavos / 100, fees: feeCentavos / 100,
        status: 'Pending', paymentState: 'Pending',
      } });
      for (const start of starts) {
        const booking = await tx.coachingSession.create({ data: {
          memberId, trainerId: trainer.profileId, startsAt: start,
          type: 'Personal Training', status: 'Pending', amount: unitCentavos / 100,
        } });
        await tx.transactionItem.create({ data: {
          transactionId: payment.id, coachingSessionId: booking.id,
          description: `Coaching session with ${trainer.profile.gymUser.name}`,
          quantity: 1, unitPrice: unitCentavos / 100, total: unitCentavos / 100,
        } });
      }
      return payment;
    });
  } catch (error) {
    console.error('Coaching slot could not be reserved:', error);
    return Response.json({ error: 'A selected coaching time was just booked. Choose another slot.' }, { status: 409 });
  }
  try {
    const checkout = await createTestCheckout({ reference,
      description: `${starts.length} coaching session${starts.length === 1 ? '' : 's'} with ${trainer.profile.gymUser.name}`,
      amountCentavos: totalCentavos, email, name: session.user.name || email, returnPath: '/account' });
    await prisma.paymentTransaction.update({ where: { id: transaction.id },
      data: { paymongoCheckoutId: checkout.id } });
    return Response.json({ checkoutUrl: checkout.url, reference });
  } catch (error) {
    console.error('PayMongo coaching checkout could not start:', error);
    await prisma.$transaction([
      prisma.paymentTransaction.update({ where: { id: transaction.id },
        data: { status: 'Failed', paymentState: 'Failed' } }),
      prisma.coachingSession.updateMany({ where: { transactionItem: { transactionId: transaction.id } },
        data: { status: 'Cancelled' } }),
    ]);
    return Response.json({ error: 'Checkout could not start. Please try again.' }, { status: 502 });
  }
}
