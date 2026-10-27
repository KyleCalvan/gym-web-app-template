import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';
import { releaseAbandonedCoachingCheckouts } from '@/src/paymongo/cancelCoachingCheckout';
import { getCoachingSessionPricePhp } from '@/src/member/coachingPrice';

export const runtime = 'nodejs';

function localPart(value: Date, part: 'year' | 'month' | 'day' | 'hour' | 'minute') {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value).find(entry => entry.type === part)?.value ?? '';
}

function localDate(value: Date) {
  return `${localPart(value, 'year')}-${localPart(value, 'month')}-${localPart(value, 'day')}`;
}

function localTime(value: Date) {
  return `${localPart(value, 'hour')}:${localPart(value, 'minute')}`;
}

export async function GET(request: NextRequest) {
  try {
    const record = await readSession(requestSessionToken(request));
    if (!record) return Response.json({ code: 'UNAUTHENTICATED' }, { status: 401 });
    if (record.status.restricted || !record.status.roles.includes('member')) {
      return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
    }

    await releaseAbandonedCoachingCheckouts();

    const since = new Date(Date.now() - 86_400_000);
    const [profiles, sessions] = await Promise.all([
      prisma.trainerProfile.findMany({
        where: { profile: { archivedAt: null, status: 'Active' } },
        select: {
          profileId: true, specialty: true, certifications: true, sessionPrice: true,
          profile: { select: { status: true, gymUser: { select: { name: true } } } },
          availability: { where: { endsAt: { gte: since } }, select: { id: true, startsAt: true, endsAt: true, status: true } },
        },
      }),
      prisma.coachingSession.findMany({
        where: { startsAt: { gte: since }, status: { in: ['Pending', 'Confirmed'] } },
        select: { id: true, startsAt: true, status: true, trainer: { select: { profile: { select: { gymUser: { select: { name: true } } } } } } },
      }),
    ]);

    return Response.json({
      trainers: profiles.map(profile => ({
        id: profile.profileId, name: profile.profile.gymUser.name,
        specialty: profile.specialty, certs: profile.certifications,
        sessionPrice: getCoachingSessionPricePhp(Number(profile.sessionPrice)), status: profile.profile.status,
        rating: 0, sessionsWeek: 0, reviews: [],
      })),
      trainerAvailability: profiles.flatMap(profile => profile.availability.map(slot => ({
        id: slot.id, trainerId: profile.profileId, date: localDate(slot.startsAt),
        startTime: localTime(slot.startsAt), endTime: localTime(slot.endsAt), status: slot.status,
      }))),
      bookingSlots: sessions.map(session => ({
        id: session.id, trainer: session.trainer.profile.gymUser.name,
        date: localDate(session.startsAt), time: localTime(session.startsAt), status: session.status,
      })),
    }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Could not load coaching options.', error);
    return Response.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}
