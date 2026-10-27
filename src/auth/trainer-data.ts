import { prisma } from './prisma';
import { BOOKING_TIME_ZONE } from '../member/bookingDates';
import type { Member, QrDestination, Session, Trainer, TrainerAvailability } from '../types';

function datePart(value: Date, part: Intl.DateTimeFormatPartTypes) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value).find((item) => item.type === part)?.value ?? '';
}

function localDate(value: Date) {
  return `${datePart(value, 'year')}-${datePart(value, 'month')}-${datePart(value, 'day')}`;
}

function localTime(value: Date) {
  return `${datePart(value, 'hour')}:${datePart(value, 'minute')}`;
}

export async function loadTrainerData(profileId: string) {
  const [profile, qrRows] = await Promise.all([
    prisma.trainerProfile.findUniqueOrThrow({ where: { profileId }, include: {
      profile: { include: { gymUser: true } },
      coachingSessions: { include: { member: { include: { profile: { include: { gymUser: true } } } } },
        orderBy: { startsAt: 'asc' }, take: 500 },
      availability: { orderBy: { startsAt: 'asc' }, take: 500 },
    } }),
    prisma.gymQrDestination.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  const rated = profile.coachingSessions.filter((item) => item.rating !== null);
  const trainer: Trainer & { email: string; bio: string } = {
    id: profile.profileId, name: profile.profile.gymUser.name ?? 'Trainer',
    email: profile.profile.gymUser.email, bio: profile.bio,
    specialty: profile.specialty, certs: profile.certifications,
    rating: rated.length ? rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length : 0,
    sessionsWeek: profile.coachingSessions.filter((item) => item.startsAt.getTime() >= Date.now() - 7 * 86_400_000).length,
    status: profile.profile.status === 'Active' ? 'Active' : 'Inactive',
    sessionPrice: profile.sessionPrice.toNumber(), reviews: [],
    avatarUrl: profile.profile.gymUser.avatarUrl ?? undefined,
    deletedAt: profile.profile.archivedAt?.toISOString() ?? null,
  };
  const sessions: Session[] = profile.coachingSessions.map((row) => ({
    id: row.id, member: row.member.profile.gymUser.name ?? 'Member', trainer: trainer.name,
    date: localDate(row.startsAt), time: localTime(row.startsAt), type: row.type, status: row.status,
    paid: false, amount: row.amount.toNumber(), rated: row.rating !== null, rating: row.rating ?? undefined,
  }));
  const members: Member[] = Array.from(new Map(profile.coachingSessions.map((row) => {
    const user = row.member.profile.gymUser;
    const member: Member = {
      id: row.memberId, name: user.name ?? 'Member', email: user.email, phone: user.phone ?? '',
      plan: '', status: 'Expired', joined: '', avatarUrl: user.avatarUrl ?? undefined,
    };
    return [row.memberId, member];
  })).values());
  const trainerAvailability: TrainerAvailability[] = profile.availability.map((row) => ({
    id: row.id, trainerId: profile.profileId, date: localDate(row.startsAt),
    startTime: localTime(row.startsAt), endTime: localTime(row.endsAt), status: row.status,
  }));
  const qrDestinations: QrDestination[] = qrRows.map((row) => ({ id: row.id, label: row.label, url: row.url }));
  return { trainer, sessions, members, trainerAvailability, qrDestinations };
}
