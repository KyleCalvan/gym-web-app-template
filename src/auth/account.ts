import { randomUUID } from 'node:crypto';
import { prisma } from './prisma';
import { writeAudit } from './audit';
import { authRequestContext } from './request-context';
import type { AccountNextStep } from './account-contract';
import type { Prisma } from '@/backend/generated/prisma/client';
import { CURRENT_TERMS_VERSION } from './terms';

export { CURRENT_TERMS_VERSION } from './terms';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

class IdentityConflict extends Error {}
class IdentityDenied extends Error {}

export async function recordGoogleRejection(result: 'rejected' | 'failed' = 'rejected', action: 'google.sign-in' | 'account.conflict' = 'google.sign-in') {
  const context = authRequestContext.getStore();
  try {
    await writeAudit(prisma, { actor: context?.accountId ?? null, action, target: null,
      result, requestId: context?.requestId ?? randomUUID() });
  } catch { console.error('Authentication audit storage is unavailable.'); }
  return false;
}

export async function establishGoogleAccount(profile: {
  sub: string; email: string; name?: string; email_verified: boolean;
}) {
  const context = authRequestContext.getStore();
  const requestId = context?.requestId ?? randomUUID();
  const email = normalizeEmail(profile.email);
  let authenticatedAccountId: string | undefined;
  if (!profile.email_verified || !email || !profile.sub) return recordGoogleRejection();

  try {
    await prisma.$transaction(async (tx) => {
      // Same subject or normalized address cannot create two identities. Unique
      // database constraints also protect against writers outside this service.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'google:' + profile.sub}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'email:' + email}, 0))`;
      const link = await tx.authAccount.findUnique({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.sub } },
        include: { user: { include: { assignedRoles: true } } },
      });
      let account = link?.user;
      // Provider addition to an existing session belongs to the deliberate
      // fresh-authentication flow. Never let NextAuth auto-link a new subject.
      if (context?.accountId && context.accountId !== account?.id) throw new IdentityDenied();
      if (account?.status === 'disabled') throw new IdentityDenied();
      // A verified member email change does not change the linked Google subject.
      const hasVerifiedChangedEmail = account?.emailVerifiedProvider === 'member-email-change'
        && account.emailVerifiedSubject === account.email;
      if (account && account.email !== email && !hasVerifiedChangedEmail) throw new IdentityConflict();
      if (!account) {
        const existingAuth = await tx.authUser.findUnique({ where: { email } });
        const existingGym = await tx.user.findUnique({ where: { email } });
        if (existingAuth || existingGym) throw new IdentityConflict();
        const gymUser = await tx.user.create({ data: { email, name: profile.name?.trim() || null } });
        account = await tx.authUser.create({
          data: { email, name: profile.name?.trim() || null, gymUserId: gymUser.id },
          include: { assignedRoles: true },
        });
        // Only the stable provider identity is required. No OAuth secrets are
        // retained because this application does not call Google APIs offline.
        await tx.authAccount.create({ data: {
          userId: account.id, type: 'oauth', provider: 'google', providerAccountId: profile.sub,
        } });
        await writeAudit(tx, { actor: account.id, action: 'account.created', target: account.id, result: 'success', requestId });
      }
      if (account.gymUserId === null) {
        if (await tx.user.findUnique({ where: { email } })) throw new IdentityConflict();
        const gymUser = await tx.user.create({ data: { email, name: account.name } });
        account = await tx.authUser.update({ where: { id: account.id }, data: { gymUserId: gymUser.id }, include: { assignedRoles: true } });
      }
      if (!account.establishedAt && account.assignedRoles.length === 0) {
        const profile = await tx.roleProfile.upsert({
          where: { gymUserId_role: { gymUserId: account.gymUserId!, role: 'member' } },
          create: { gymUserId: account.gymUserId!, role: 'member' }, update: {},
        });
        await tx.memberProfile.upsert({ where: { profileId: profile.id },
          create: { profileId: profile.id }, update: {} });
        await tx.assignedRole.create({ data: { accountId: account.id, role: 'member', profileId: profile.id } });
      }
      const existingMember = account.assignedRoles.find(assignment => assignment.role === 'member');
      if (existingMember) await tx.memberProfile.upsert({ where: { profileId: existingMember.profileId },
        create: { profileId: existingMember.profileId }, update: {} });
      if (!account.establishedAt || !account.emailVerified || (!hasVerifiedChangedEmail
        && (account.emailVerifiedProvider !== 'google' || account.emailVerifiedSubject !== profile.sub))) {
        const now = new Date();
        await tx.authUser.update({ where: { id: account.id }, data: {
          establishedAt: account.establishedAt ?? now, emailVerified: now,
          emailVerifiedProvider: 'google', emailVerifiedSubject: profile.sub,
        } });
        await writeAudit(tx, { actor: account.id, action: 'email.verified', target: account.id, result: 'success', requestId });
        await writeAudit(tx, { actor: account.id, action: 'account.established', target: account.id, result: 'success', requestId });
      }
      await writeAudit(tx, { actor: account.id, action: 'google.sign-in', target: account.id, result: 'success', requestId });
      authenticatedAccountId = account.id;
    });
    if (context) context.googleAuthenticatedAccountId = authenticatedAccountId;
    return true;
  } catch (error) {
    // Rejections survive the rolled-back account transaction. Neither the
    // response nor the event discloses which address or identity conflicted.
    const conflict = error instanceof IdentityConflict
      || (error !== null && typeof error === 'object' && 'code' in error && error.code === 'P2002');
    await recordGoogleRejection(conflict || error instanceof IdentityDenied ? 'rejected' : 'failed', conflict ? 'account.conflict' : 'google.sign-in');
    return conflict ? `/login?error=AccountConflict&requestId=${requestId}` : false;
  }
}

export async function getAccountStatus(id: string, session?: { mfaVerifiedAt: Date | null }, tx: Prisma.TransactionClient = prisma) {
  const account = await tx.authUser.findUnique({
    where: { id }, include: { assignedRoles: { include: { profile: true }, orderBy: { role: 'asc' } } },
  });
  if (!account) return null;
  const roles = account.assignedRoles.filter((assignment) =>
    assignment.profile.gymUserId === account.gymUserId && assignment.profile.role === assignment.role,
  ).map((assignment) => assignment.role);
  const nextSteps: AccountNextStep[] = [];
  if (account.status === 'disabled') nextSteps.push('contact-support');
  if (!account.establishedAt || account.gymUserId === null) nextSteps.push('sign-in-with-google');
  if (!account.email?.trim() || !account.emailVerified || !account.emailVerifiedProvider) nextSteps.push('verify-email');
  if (!account.name?.trim() || !account.phone?.trim()) nextSteps.push('complete-profile');
  if (!account.termsAcceptedAt || account.termsVersion !== CURRENT_TERMS_VERSION) nextSteps.push('accept-terms');
  if (roles.length === 0) nextSteps.push('contact-support');
  if (roles.some((role) => role === 'staff' || role === 'admin' || role === 'superadmin') && !account.mfaEnabledAt) nextSteps.push('set-up-two-step-verification');
  if (account.mfaEnabledAt && (!session?.mfaVerifiedAt || session.mfaVerifiedAt < account.mfaEnabledAt
    || session.mfaVerifiedAt > new Date())) nextSteps.push('complete-two-step-verification');
  return {
    account: { id: account.id, gymUserId: account.gymUserId, name: account.name, email: account.email,
      phone: account.phone, termsVersion: account.termsVersion, termsAcceptedAt: account.termsAcceptedAt?.toISOString() ?? null,
      status: account.status, emailVerified: Boolean(account.emailVerified && account.emailVerifiedProvider) },
    roles, profiles: account.assignedRoles.filter(({ role }) => roles.includes(role)).map(({ role, profileId }) => ({ role, profileId })),
    restricted: nextSteps.length > 0, nextSteps: [...new Set(nextSteps)],
  };
}
