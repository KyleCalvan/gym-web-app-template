import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, hasSameOrigin } from '@/src/auth/http';
import { prisma } from '@/src/auth/prisma';
import { lookupSession, rotateSession } from '@/src/auth/sessions';
import { requestSessionToken, setSessionCookie } from '@/src/auth/session-cookie';
import { decryptTotpSecret, encryptTotpSecret, newTotpSecret, verifyTotpCode } from '@/src/auth/totp';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const record = await prisma.$transaction((tx) => lookupSession(tx, requestSessionToken(request)));
  if (!record) return apiError(401, 'UNAUTHENTICATED', 'Sign in to manage two-step verification.', randomUUID());
  return NextResponse.json({ enabled: Boolean(record.user.mfaEnabledAt) }, { headers: { 'cache-control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!hasSameOrigin(request)) return apiError(403, 'ORIGIN_REJECTED', 'The request origin could not be verified.', requestId);
  try {
    return await prisma.$transaction(async (tx) => {
      const record = await lookupSession(tx, requestSessionToken(request));
      if (!record) return apiError(401, 'UNAUTHENTICATED', 'Sign in to set up two-step verification.', requestId);
      if (record.user.mfaEnabledAt) return apiError(409, 'ALREADY_ENABLED', 'Two-step verification is already enabled.', requestId);
      if (!record.user.emailVerified || !record.user.emailVerifiedProvider)
        return apiError(403, 'EMAIL_UNVERIFIED', 'Verify your email before setting up two-step verification.', requestId);
      const authenticatedAt = record.session.primaryAuthenticatedAt?.getTime() ?? 0;
      if (Date.now() - authenticatedAt > 5 * 60_000)
        return apiError(403, 'REAUTH_REQUIRED', 'Sign in again before setting up two-step verification.', requestId);
      const secret = newTotpSecret();
      await tx.authUser.update({ where: { id: record.user.id }, data: { mfaSecretEncrypted: encryptTotpSecret(secret) } });
      return NextResponse.json({ secret }, { headers: { 'cache-control': 'private, no-store' } });
    });
  } catch {
    return apiError(503, 'UNAVAILABLE', 'Two-step setup is temporarily unavailable.', requestId);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();
  if (!hasSameOrigin(request)) return apiError(403, 'ORIGIN_REJECTED', 'The request origin could not be verified.', requestId);
  let body: { code?: unknown; mode?: unknown };
  try { body = await request.json(); }
  catch { return apiError(400, 'INVALID_REQUEST', 'Enter the six-digit authenticator code.', requestId); }
  if (!body || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)
    || (body.mode !== 'setup' && body.mode !== 'challenge'))
    return apiError(400, 'INVALID_REQUEST', 'Enter the six-digit authenticator code.', requestId);
  const code = body.code;
  const mode = body.mode;
  try {
    return await prisma.$transaction(async (tx) => {
      const record = await lookupSession(tx, requestSessionToken(request));
      if (!record) return apiError(401, 'UNAUTHENTICATED', 'Sign in to verify your code.', requestId);
      if (!record.user.mfaSecretEncrypted || (mode === 'setup') === Boolean(record.user.mfaEnabledAt))
        return apiError(409, 'INVALID_STATE', 'Two-step verification is not ready for this action.', requestId);
      const throttleKey = `mfa:${record.user.id}`;
      const throttle = await tx.passwordLoginThrottle.findUnique({ where: { key: throttleKey } });
      const now = new Date();
      if (throttle?.blockedUntil && throttle.blockedUntil > now)
        return apiError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Try again later.', requestId);
      const valid = verifyTotpCode(decryptTotpSecret(record.user.mfaSecretEncrypted), code);
      if (!valid) {
        const inWindow = throttle && now.getTime() - throttle.windowStart.getTime() < 15 * 60_000;
        const failures = inWindow ? throttle.failures + 1 : 1;
        await tx.passwordLoginThrottle.upsert({ where: { key: throttleKey }, create: {
          key: throttleKey, failures, windowStart: now,
          blockedUntil: failures >= 5 ? new Date(now.getTime() + 15 * 60_000) : null,
        }, update: { failures, windowStart: inWindow ? throttle.windowStart : now,
          blockedUntil: failures >= 5 ? new Date(now.getTime() + 15 * 60_000) : null } });
        return apiError(401, 'INVALID_CODE', 'Invalid authenticator code. Try again.', requestId);
      }
      await tx.passwordLoginThrottle.deleteMany({ where: { key: throttleKey } });
      if (mode === 'setup') await tx.authUser.update({ where: { id: record.user.id }, data: { mfaEnabledAt: now } });
      const session = await rotateSession(tx, { accountId: record.user.id,
        sessionToken: record.session.sessionToken, mfaVerified: true });
      const response = NextResponse.json({ enabled: true }, { headers: { 'cache-control': 'private, no-store' } });
      setSessionCookie(response, session);
      return response;
    });
  } catch {
    return apiError(503, 'UNAVAILABLE', 'Two-step verification is temporarily unavailable.', requestId);
  }
}
