import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/backend/generated/prisma/client';
import { normalizeEmail } from '@/src/auth/account';
import { writeAudit } from '@/src/auth/audit';
import { apiError, hasSameOrigin } from '@/src/auth/http';
import { hashPassword } from '@/src/auth/password';
import { prisma } from '@/src/auth/prisma';
import { authRequestContext } from '@/src/auth/request-context';
import { setSessionCookie } from '@/src/auth/session-cookie';
import { createSession } from '@/src/auth/sessions';
import { CURRENT_TERMS_VERSION } from '@/src/auth/terms';
import { issueEmailVerification } from '@/src/auth/email-verification';
import { sendVerificationEmail, verificationMailConfigured } from '@/src/auth/verification-mail';
import { normalizeRegistrationPhone } from '@/src/auth/registration-phone';
import { createSupabaseUser, deleteSupabaseUser, findSupabaseUser, legacyAuthTestMode,
  supabaseAuthConfigured } from '@/src/auth/supabase-auth';

export const runtime = 'nodejs';

type Registration = {
  firstName?: unknown; middleName?: unknown; lastName?: unknown; suffix?: unknown;
  email?: unknown; phone?: unknown; password?: unknown;
  termsAccepted?: unknown; termsVersion?: unknown;
};

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!hasSameOrigin(request)) return apiError(403, 'ORIGIN_REJECTED', 'The request origin could not be verified.', requestId);
  let body: Registration;
  try {
    if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('JSON required');
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  } catch { return apiError(400, 'INVALID_REQUEST', 'Enter your registration details.', requestId); }

  const { firstName, middleName, lastName, suffix, email, phone, password, termsAccepted, termsVersion } = body;
  if ([firstName, middleName, lastName, suffix, email, phone, password, termsVersion].some(value => typeof value !== 'string')) {
    return apiError(400, 'INVALID_REQUEST', 'Enter your registration details.', requestId);
  }
  const name = [firstName, middleName, lastName, suffix].map(value => (value as string).trim()).filter(Boolean).join(' ');
  const normalizedEmail = normalizeEmail(email as string);
  const contactPhone = normalizeRegistrationPhone(phone as string);
  if (!(firstName as string).trim() || !(lastName as string).trim() || name.length > 120)
    return apiError(400, 'INVALID_NAME', 'Enter your first and last name, up to 120 characters total.', requestId);
  if (normalizedEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(normalizedEmail))
    return apiError(400, 'INVALID_EMAIL', 'Enter a valid email address.', requestId);
  if (!contactPhone)
    return apiError(400, 'INVALID_PHONE', 'Enter a phone number with 7 to 15 digits.', requestId);
  if ((password as string).length < 8 || (password as string).length > 128)
    return apiError(400, 'INVALID_PASSWORD', 'Use a password of 8 to 128 characters.', requestId);
  if (termsVersion !== CURRENT_TERMS_VERSION || termsAccepted !== true) {
    return apiError(400, 'TERMS_REQUIRED', 'Read and accept the current Terms of Use.', requestId);
  }
  if (!verificationMailConfigured()) {
    return apiError(503, 'EMAIL_UNAVAILABLE', 'Email verification is not configured yet. Please contact the gym.', requestId);
  }

  let newSupabaseUserId: string | null = null;
  let persisted = false;
  try {
    const useSupabase = supabaseAuthConfigured();
    if (!useSupabase && !legacyAuthTestMode())
      return apiError(503, 'AUTH_CONFIGURATION', 'Registration is temporarily unavailable.', requestId);
    const accountId = randomUUID();
    if (useSupabase) {
      if (await findSupabaseUser(normalizedEmail))
        return apiError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists. Sign in or contact the gym.', requestId);
      const user = await createSupabaseUser(normalizedEmail, password as string, false, accountId);
      newSupabaseUserId = user.id;
    }
    const passwordHash = useSupabase ? null : await hashPassword(password as string);
    const created = await authRequestContext.run({ requestId, accountId: null }, () => prisma.$transaction(async tx => {
      // Share the address lock with Google sign-in and reject existing gym records
      // rather than claiming a record whose owner has not proved their identity.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'email:' + normalizedEmail}, 0))`;
      const [accountExists, gymUserExists] = await Promise.all([
        tx.authUser.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
        tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      ]);
      if (accountExists || gymUserExists) {
        await writeAudit(tx, { actor: null, action: 'account.conflict', target: null, result: 'rejected', requestId });
        return null;
      }

      const gymUser = await tx.user.create({ data: { email: normalizedEmail, name, phone: contactPhone } });
      const account = await tx.authUser.create({ data: {
        id: accountId,
        email: normalizedEmail, name, phone: contactPhone, gymUserId: gymUser.id,
        establishedAt: new Date(), passwordHash,
        termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: new Date(),
      } });
      const profile = await tx.roleProfile.create({ data: { gymUserId: gymUser.id, role: 'member' } });
      await tx.memberProfile.create({ data: { profileId: profile.id } });
      await tx.assignedRole.create({ data: { accountId: account.id, role: 'member', profileId: profile.id } });
      authRequestContext.getStore()!.accountId = account.id;
      await writeAudit(tx, { actor: account.id, action: 'account.created', target: account.id, result: 'success', requestId });
      await writeAudit(tx, { actor: account.id, action: 'account.established', target: account.id, result: 'success', requestId });
      await writeAudit(tx, { actor: account.id, action: 'password.register', target: account.id, result: 'success', requestId });
      const verificationToken = await issueEmailVerification(tx, normalizedEmail);
      const session = await createSession(tx, { accountId: account.id });
      return { session, verificationToken };
    }, { timeout: 20_000 }));
    if (!created) {
      if (newSupabaseUserId) await deleteSupabaseUser(newSupabaseUserId);
      return apiError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists. Sign in or contact the gym.', requestId);
    }
    persisted = true;
    let delivered = true;
    try { await sendVerificationEmail(normalizedEmail, created.verificationToken); }
    catch (error) {
      delivered = false;
      console.error('Verification email delivery failed.', { requestId,
        code: error && typeof error === 'object' && 'code' in error ? error.code : undefined });
    }
    const response = NextResponse.json({ next: delivered ? '/account?check-email=1' : '/account?delivery=failed' }, {
      status: delivered ? 201 : 202,
      headers: { 'x-request-id': requestId, 'cache-control': 'private, no-store' },
    });
    setSessionCookie(response, created.session);
    return response;
  } catch (error) {
    if (newSupabaseUserId && !persisted) await deleteSupabaseUser(newSupabaseUserId).catch(() => {});
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return apiError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists. Sign in or contact the gym.', requestId);
    }
    console.error('Member registration failed.', { requestId,
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined });
    return apiError(503, 'UNAVAILABLE', 'Registration is temporarily unavailable. Please retry.', requestId);
  }
}
