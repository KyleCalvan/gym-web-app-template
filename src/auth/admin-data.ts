import { prisma } from './prisma';
import type { Admin, AuditLogEntry, Member, Plan, Promotion, QrDestination, Session, Staff, Trainer, Transaction } from '../types';
import { roleDisplayId } from '../shared/roleDisplayId';

const day = (value: Date) => value.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

export async function loadAdminData() {
  const [memberRows, trainerRows, staffRows, adminRows, planRows, transactionRows,
    sessionRows, promotionRows, qrRows, auditRows, availabilityRows] = await Promise.all([
    prisma.memberProfile.findMany({ include: { profile: { include: { gymUser: true } },
      memberships: { orderBy: { endsAt: 'desc' }, take: 1 } }, take: 500 }),
    prisma.trainerProfile.findMany({ include: { profile: { include: { gymUser: true } },
      coachingSessions: { select: { startsAt: true, rating: true } } }, take: 500 }),
    prisma.staffProfile.findMany({ include: { profile: { include: { gymUser: true } } }, take: 500 }),
    prisma.roleProfile.findMany({ where: { role: 'admin' }, include: { gymUser: true }, take: 500 }),
    prisma.gymPlan.findMany({ orderBy: { price: 'asc' } }),
    prisma.paymentTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.coachingSession.findMany({ include: {
      member: { include: { profile: { include: { gymUser: true } } } },
      trainer: { include: { profile: { include: { gymUser: true } } } },
    }, orderBy: { startsAt: 'desc' }, take: 500 }),
    prisma.promotion.findMany({ where: { deletedAt: null }, include: { _count: { select: { redemptions: true } } }, take: 500 }),
    prisma.gymQrDestination.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.auditEvent.findMany({ orderBy: { occurredAt: 'desc' }, take: 500 }),
    prisma.trainerAvailability.findMany({ take: 500 }),
  ]);

  const members: Member[] = memberRows.map((row) => ({
    id: row.profileId, displayId: roleDisplayId('member', row.profile.gymUserId), name: row.profile.gymUser.name ?? 'Member', email: row.profile.gymUser.email,
    phone: row.profile.gymUser.phone ?? '', plan: row.memberships[0]?.planName ?? 'No plan',
    status: row.memberships[0]?.status ?? 'Expired', joined: day(row.joinedAt),
    avatarUrl: row.profile.gymUser.avatarUrl ?? undefined,
    membershipValidUntil: row.memberships[0]?.endsAt.toISOString() ?? null,
    weightKg: row.weightKg?.toNumber(), heightCm: row.heightCm?.toNumber(),
    deletedAt: row.profile.archivedAt?.toISOString() ?? null,
  }));
  const trainers: Trainer[] = trainerRows.map((row) => {
    const rated = row.coachingSessions.filter((item) => item.rating !== null);
    const weekAgo = Date.now() - 7 * 86_400_000;
    return {
      id: row.profileId, displayId: roleDisplayId('trainer', row.profile.gymUserId), name: row.profile.gymUser.name ?? 'Trainer', specialty: row.specialty,
      certs: row.certifications, rating: rated.length
        ? rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length : 0,
      sessionsWeek: row.coachingSessions.filter((item) => item.startsAt.getTime() >= weekAgo).length,
      status: row.profile.status === 'Active' ? 'Active' : 'Inactive',
      sessionPrice: row.sessionPrice.toNumber(), reviews: [],
      avatarUrl: row.profile.gymUser.avatarUrl ?? undefined,
      deletedAt: row.profile.archivedAt?.toISOString() ?? null,
    };
  });
  const staff: Staff[] = staffRows.map((row) => ({
    id: row.profileId, displayId: roleDisplayId('staff', row.profile.gymUserId), name: row.profile.gymUser.name ?? 'Staff', email: row.profile.gymUser.email,
    phone: row.profile.gymUser.phone ?? '', phoneSecondary: row.profile.gymUser.phoneSecondary ?? '',
    role: row.jobRole === 'FrontDesk' ? 'Front Desk' : row.jobRole,
    shift: row.shift, status: row.profile.status === 'Active' ? 'Active' : 'Inactive',
    hireDate: day(row.hiredAt), avatarUrl: row.profile.gymUser.avatarUrl ?? undefined,
    deletedAt: row.profile.archivedAt?.toISOString() ?? null,
  }));
  const admins: Admin[] = adminRows.map((row) => ({
    id: row.id, displayId: roleDisplayId('admin', row.gymUserId), name: row.gymUser.name ?? 'Manager', email: row.gymUser.email,
    phone: row.gymUser.phone ?? '', phoneSecondary: row.gymUser.phoneSecondary ?? '',
    status: row.archivedAt ? 'Inactive' : 'Active', createdAt: day(row.createdAt),
    avatarUrl: row.gymUser.avatarUrl ?? undefined, deletedAt: row.archivedAt?.toISOString() ?? null,
  }));
  const plans: Plan[] = planRows.map((row) => ({
    name: row.name, price: row.price, period: row.period, members: members.filter((item) => item.plan === row.name).length,
    perks: row.perks, featured: row.featured, status: row.status === 'Active' ? 'Active' : 'Inactive',
    category: row.category, description: row.description, restrictions: row.restrictions,
    sessionLimit: row.sessionLimit === 'unlimited' ? 'unlimited' : Number(row.sessionLimit) || 0,
    facilities: row.facilities, includedBenefits: row.includedBenefits,
    excludedBenefits: row.excludedBenefits, terms: row.terms ?? undefined,
  }));
  const transactions: Transaction[] = transactionRows.map((row) => ({
    id: row.id, receiptNumber: row.receiptNumber ?? undefined, transactionReference: row.reference,
    member: row.customerName, type: row.type, amount: row.amount.toNumber(), fees: row.fees.toNumber(),
    paymentState: row.paymentState, isSimulated: row.isSimulated,
    method: row.method, date: day(row.createdAt), status: row.status,
  }));
  const sessions: Session[] = sessionRows.map((row) => ({
    id: row.id, member: row.member.profile.gymUser.name ?? 'Member',
    trainer: row.trainer.profile.gymUser.name ?? 'Trainer', date: day(row.startsAt),
    time: row.startsAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    type: row.type, status: row.status, paid: false, amount: row.amount.toNumber(),
    rated: row.rating !== null, rating: row.rating ?? undefined,
  }));
  const promotions: Promotion[] = promotionRows.map((row) => ({
    id: row.id, title: row.title, discountType: row.discountType, discount: row.discount,
    validFrom: day(row.validFrom), validUntil: day(row.validUntil), plan: row.planName ?? 'Any Plan',
    code: row.code, maxRedemptions: row.maxRedemptions, redemptions: row._count.redemptions,
    minSpend: row.minSpend.toNumber(), status: row.status,
    imageUrl: row.imageUrl ?? undefined, description: row.description ?? undefined,
  }));
  const qrDestinations: QrDestination[] = qrRows.map((row) => ({ id: row.id, label: row.label, url: row.url }));
  const auditLog: AuditLogEntry[] = auditRows.map((row) => ({
    id: row.id, at: row.occurredAt.toISOString(), level: row.level === 'error' ? 'error' : row.level === 'warn' ? 'warn' : 'info',
    actor: row.actor ?? 'System', actorRole: row.actorRole ?? 'admin',
    action: row.action, details: row.details ?? undefined, result: row.result,
  }));
  const trainerAvailability = availabilityRows.map((row) => ({
    id: row.id, trainerId: row.trainerId, date: row.startsAt.toISOString().slice(0, 10),
    startTime: row.startsAt.toISOString().slice(11, 16), endTime: row.endsAt.toISOString().slice(11, 16),
    status: row.status,
  }));
  return { members, trainers, staff, admins, plans, transactions, sessions,
    promotions, qrDestinations, auditLog, trainerAvailability };
}
