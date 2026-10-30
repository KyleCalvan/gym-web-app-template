import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import AccountStatus from '@/src/auth/AccountStatus';
import { accountProjection } from '@/src/auth/completion';
import { prisma } from '@/src/auth/prisma';
import MemberPortal from '@/src/member/MemberPortal';
import AdminPortal from '@/src/auth/AdminPortal';
import { loadAdminData } from '@/src/auth/admin-data';
import TrainerPortal from '@/src/auth/TrainerPortal';
import { loadTrainerData } from '@/src/auth/trainer-data';
import StaffPortal from '@/src/auth/StaffPortal';
import { loadStaffData } from '@/src/auth/staff-data';
import SuperAdminPortal from '@/src/auth/SuperAdminPortal';
import { loadSuperAdminData } from '@/src/auth/superadmin-data';
import '@/src/auth/account-status.css';
import { roleDisplayId } from '@/src/shared/roleDisplayId';
import { accountPortalRole } from '@/src/auth/account-destination';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const current = await readSession(requestSessionToken({ cookies: await cookies() }));
  const status = current?.status;
  if (!status) redirect('/login');
  if ((await searchParams).setup === '1' && status.restricted)
    return <AccountStatus initialStatus={accountProjection(status)} />;
  const portalRole = accountPortalRole(status);
  const memberProfileId = portalRole === 'member'
    ? status.profiles.find(({ role }) => role === 'member')?.profileId : undefined;
  if (memberProfileId) {
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
      prisma.paymentTransaction.findMany({ where: { memberId: memberProfileId, isSimulated: false }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, type: true, amount: true, status: true, createdAt: true } }),
      prisma.promotion.findMany({ where: { status: 'Published', deletedAt: null,
        validFrom: { lte: new Date() }, validUntil: { gte: new Date() },
        OR: [{ planName: null }, ...(membership ? [{ planName: membership.planName }] : [])] },
        orderBy: { validUntil: 'asc' }, take: 12,
        select: { id: true, title: true, description: true, code: true, validUntil: true } }),
      prisma.gymQrDestination.findMany({ orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, url: true } }),
    ]);
    return <MemberPortal setupSteps={status.nextSteps} data={{
      memberId: memberProfileId, displayMemberId: roleDisplayId('member', status.account.gymUserId!), joinedAt: member.joinedAt.toISOString(),
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
  const staffRole = portalRole === 'member' ? null : portalRole;
  if (staffRole) {
    const profileId = status.profiles.find(({ role }) => role === staffRole)?.profileId;
    if (staffRole === 'admin' && profileId) {
      const data = await loadAdminData();
      return <AdminPortal data={data} setupSteps={status.nextSteps} name={status.account.name ?? 'Manager'}
        email={status.account.email ?? ''} profileId={profileId} />;
    }
    if (staffRole === 'trainer' && profileId) {
      const data = await loadTrainerData(profileId);
      return <TrainerPortal data={data} setupSteps={status.nextSteps} />;
    }
    if (staffRole === 'staff' && profileId) {
      const data = await loadStaffData(profileId, status.account.id);
      return <StaffPortal data={data} setupSteps={status.nextSteps} />;
    }
    if (staffRole === 'superadmin' && profileId && current) {
      const data = await loadSuperAdminData(profileId);
      return <SuperAdminPortal data={data} currentSessionId={current.session.id} setupSteps={status.nextSteps} />;
    }
  }
  return <AccountStatus initialStatus={accountProjection(status)} />;
}
