import { prisma } from './prisma';
import { BOOKING_TIME_ZONE, getBookingToday } from '../member/bookingDates';
import type { Member, Plan, Staff, Trainer, TrainerAvailability, Transaction } from '../types';
import { roleDisplayId } from '../shared/roleDisplayId';

const displayDate = (date: Date) => new Intl.DateTimeFormat('en-US',
  { timeZone: BOOKING_TIME_ZONE, month: 'short', day: '2-digit', year: 'numeric' }).format(date);

function localPart(value: Date, part: Intl.DateTimeFormatPartTypes) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value).find((item) => item.type === part)?.value ?? '';
}

const localDate = (date: Date) =>
  `${localPart(date, 'year')}-${localPart(date, 'month')}-${localPart(date, 'day')}`;
const localTime = (date: Date) => `${localPart(date, 'hour')}:${localPart(date, 'minute')}`;

export async function loadStaffData(profileId: string, accountId: string) {
  const today = getBookingToday();
  const [staffRow, memberRows, planRows, trainerRows, transactionRows, checkInsToday] = await Promise.all([
    prisma.staffProfile.findUniqueOrThrow({ where: { profileId },
      include: { profile: { include: { gymUser: true } } } }),
    prisma.memberProfile.findMany({ include: {
      profile: { include: { gymUser: true } },
      memberships: { orderBy: { endsAt: 'desc' }, take: 1 },
    }, take: 500 }),
    prisma.gymPlan.findMany({ orderBy: { price: 'asc' } }),
    prisma.trainerProfile.findMany({ include: {
      profile: { include: { gymUser: true } },
      availability: { orderBy: { startsAt: 'asc' }, take: 500 },
    }, take: 500 }),
    prisma.paymentTransaction.findMany({ where: { cashierAccountId: accountId },
      orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.attendance.count({ where: { visitDate: new Date(`${today}T00:00:00.000Z`) } }),
  ]);
  const staff: Staff = {
    id: staffRow.profileId, displayId: roleDisplayId('staff', staffRow.profile.gymUserId), name: staffRow.profile.gymUser.name ?? 'Staff',
    email: staffRow.profile.gymUser.email, phone: staffRow.profile.gymUser.phone ?? '',
    phoneSecondary: staffRow.profile.gymUser.phoneSecondary ?? '',
    role: staffRow.jobRole === 'FrontDesk' ? 'Front Desk' : staffRow.jobRole,
    shift: staffRow.shift, status: staffRow.profile.status === 'Active' ? 'Active' : 'Inactive',
    hireDate: displayDate(staffRow.hiredAt), avatarUrl: staffRow.profile.gymUser.avatarUrl ?? undefined,
    deletedAt: staffRow.profile.archivedAt?.toISOString() ?? null,
  };
  const members: Member[] = memberRows.map((row) => ({
    id: row.profileId, displayId: roleDisplayId('member', row.profile.gymUserId), name: row.profile.gymUser.name ?? 'Member',
    email: row.profile.gymUser.email, phone: row.profile.gymUser.phone ?? '',
    plan: row.memberships[0]?.planName ?? 'No plan', status: row.memberships[0]?.status ?? 'Expired',
    joined: displayDate(row.joinedAt), avatarUrl: row.profile.gymUser.avatarUrl ?? undefined,
    membershipValidUntil: row.memberships[0]?.endsAt.toISOString() ?? null,
    deletedAt: row.profile.archivedAt?.toISOString() ?? null,
  }));
  const plans: Plan[] = planRows.map((row) => ({
    name: row.name, price: row.price, period: row.period,
    members: members.filter((item) => item.plan === row.name).length,
    perks: row.perks, featured: row.featured, status: row.status === 'Active' ? 'Active' : 'Inactive',
    category: row.category, description: row.description, restrictions: row.restrictions,
    sessionLimit: row.sessionLimit === 'unlimited' ? 'unlimited' : Number(row.sessionLimit) || 0,
    facilities: row.facilities, includedBenefits: row.includedBenefits,
    excludedBenefits: row.excludedBenefits, terms: row.terms ?? undefined,
  }));
  const trainers: Trainer[] = trainerRows.map((row) => ({
    id: row.profileId, displayId: roleDisplayId('trainer', row.profile.gymUserId), name: row.profile.gymUser.name ?? 'Trainer',
    specialty: row.specialty, certs: row.certifications, rating: 0, sessionsWeek: 0,
    status: row.profile.status === 'Active' ? 'Active' : 'Inactive',
    sessionPrice: row.sessionPrice.toNumber(), reviews: [],
    avatarUrl: row.profile.gymUser.avatarUrl ?? undefined,
    deletedAt: row.profile.archivedAt?.toISOString() ?? null,
  }));
  const trainerAvailability: TrainerAvailability[] = trainerRows.flatMap((row) =>
    row.availability.map((item) => ({
      id: item.id, trainerId: row.profileId, date: localDate(item.startsAt),
      startTime: localTime(item.startsAt), endTime: localTime(item.endsAt), status: item.status,
    })));
  const transactions: Transaction[] = transactionRows.map((row) => ({
    id: row.id, receiptNumber: row.receiptNumber ?? undefined, transactionReference: row.reference,
    member: row.customerName, type: row.type, amount: row.amount.toNumber(), fees: row.fees.toNumber(),
    paymentState: row.paymentState, isSimulated: row.isSimulated,
    method: row.method, date: displayDate(row.createdAt), status: row.status,
  }));
  return { staff, members, plans, trainers, trainerAvailability, transactions, checkInsToday };
}
