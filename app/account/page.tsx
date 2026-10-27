import { cookies } from 'next/headers';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import AccountStatus from '@/src/auth/AccountStatus';
import { accountProjection } from '@/src/auth/completion';
import { prisma } from '@/src/auth/prisma';
import MemberPortal from '@/src/member/MemberPortal';
import RolePortal from '@/src/auth/RolePortal';
import AdminPortal from '@/src/auth/AdminPortal';
import { loadAdminData } from '@/src/auth/admin-data';
import TrainerPortal from '@/src/auth/TrainerPortal';
import { loadTrainerData } from '@/src/auth/trainer-data';
import StaffPortal from '@/src/auth/StaffPortal';
import { loadStaffData } from '@/src/auth/staff-data';
import SuperAdminPortal from '@/src/auth/SuperAdminPortal';
import { loadSuperAdminData } from '@/src/auth/superadmin-data';
import '@/src/auth/account-status.css';

export default async function AccountPage() {
  const current = await readSession(requestSessionToken({ cookies: await cookies() }));
  const status = current?.status;
  if (!status) return <main className="account-status"><h1>Your Account</h1><a href="/login">Sign in to continue</a></main>;
  const memberProfileId = status.profiles.find(({ role }) => role === 'member')?.profileId;
  const memberReady = status.account.status === 'enabled' && memberProfileId
    && status.nextSteps.every((step) => step === 'verify-email');
  if (memberReady) {
    const [member, membership] = await Promise.all([
      prisma.memberProfile.findUniqueOrThrow({ where: { profileId: memberProfileId },
        select: { joinedAt: true, emergencyContact: true,
          profile: { select: { gymUser: { select: { avatarUrl: true } } } } } }),
      prisma.membership.findFirst({ where: { memberId: memberProfileId }, orderBy: { endsAt: 'desc' },
        select: { planName: true, status: true, endsAt: true } }),
    ]);
    const [sessions, payments, promotions, links] = await Promise.all([
      prisma.coachingSession.findMany({ where: { memberId: memberProfileId }, orderBy: { startsAt: 'desc' }, take: 20,
        select: { id: true, startsAt: true, type: true, status: true,
          trainer: { select: { profile: { select: { gymUser: { select: { name: true } } } } } } } }),
      prisma.paymentTransaction.findMany({ where: { memberId: memberProfileId }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, type: true, amount: true, status: true, createdAt: true } }),
      prisma.promotion.findMany({ where: { status: 'Published', deletedAt: null,
        validFrom: { lte: new Date() }, validUntil: { gte: new Date() },
        OR: [{ planName: null }, ...(membership ? [{ planName: membership.planName }] : [])] },
        orderBy: { validUntil: 'asc' }, take: 12,
        select: { id: true, title: true, description: true, code: true, validUntil: true } }),
      prisma.gymQrDestination.findMany({ orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, url: true } }),
    ]);
    return <MemberPortal data={{
      memberId: memberProfileId, joinedAt: member.joinedAt.toISOString(),
      phone: status.account.phone ?? '', emergencyContact: member.emergencyContact ?? '',
      avatarUrl: member.profile.gymUser.avatarUrl ?? undefined,
      name: status.account.name ?? 'Member', email: status.account.email ?? '',
      emailVerified: status.account.emailVerified,
      membership: membership && { planName: membership.planName, status: membership.status, endsAt: membership.endsAt.toISOString() },
      sessions: sessions.map((item) => ({ id: item.id, startsAt: item.startsAt.toISOString(), type: item.type,
        status: item.status, trainer: item.trainer.profile.gymUser.name ?? 'Trainer' })),
      payments: payments.map((item) => ({ id: item.id, type: item.type, amount: item.amount.toNumber(),
        status: item.status, createdAt: item.createdAt.toISOString() })),
      promotions: promotions.map((item) => ({ ...item, validUntil: item.validUntil.toISOString() })),
      links,
    }} />;
  }
  const staffRole = (['superadmin', 'admin', 'staff', 'trainer'] as const)
    .find((role) => status.roles.includes(role));
  if (staffRole && status.account.status === 'enabled'
    && status.nextSteps.every((step) => step === 'set-up-two-step-verification')) {
    const profileId = status.profiles.find(({ role }) => role === staffRole)?.profileId;
    if (staffRole === 'admin' && profileId) {
      const data = await loadAdminData();
      return <AdminPortal data={data} name={status.account.name ?? 'Manager'}
        email={status.account.email ?? ''} profileId={profileId} />;
    }
    if (staffRole === 'trainer' && profileId) {
      const data = await loadTrainerData(profileId);
      return <TrainerPortal data={data} />;
    }
    if (staffRole === 'staff' && profileId) {
      const data = await loadStaffData(profileId, status.account.id);
      return <StaffPortal data={data} />;
    }
    if (staffRole === 'superadmin' && profileId && current) {
      const data = await loadSuperAdminData(profileId);
      return <SuperAdminPortal data={data} currentSessionId={current.session.id} />;
    }
    const now = new Date();
    const [members, trainers, staff, admins, accounts, sessions, ownSessions,
      transactions, plans, promotions, activeSessions, auditEvents] = await Promise.all([
      prisma.memberProfile.count(), prisma.trainerProfile.count(), prisma.staffProfile.count(),
      prisma.roleProfile.count({ where: { role: 'admin', archivedAt: null } }),
      prisma.authUser.count(), prisma.coachingSession.count(),
      staffRole === 'trainer' && profileId ? prisma.coachingSession.count({ where: { trainerId: profileId } }) : Promise.resolve(0),
      prisma.paymentTransaction.count(), prisma.gymPlan.count(), prisma.promotion.count({ where: { status: 'Published', deletedAt: null } }),
      prisma.authSession.count({ where: { expires: { gt: now } } }), prisma.auditEvent.count(),
    ]);
    return <RolePortal role={staffRole} roles={status.roles} name={status.account.name ?? 'User'}
      email={status.account.email ?? ''} setupRequired={status.nextSteps.includes('set-up-two-step-verification')}
      counts={{ members, trainers, staff, admins, accounts, sessions, ownSessions,
        transactions, plans, promotions, activeSessions, auditEvents }} />;
  }
  return <AccountStatus initialStatus={accountProjection(status)} />;
}
