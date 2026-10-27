import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/src/auth/prisma';
import { lookupSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { apiError, hasSameOrigin } from '@/src/auth/http';
import { issueEmailVerification } from '@/src/auth/email-verification';
import { sendVerificationEmail, verificationMailConfigured } from '@/src/auth/verification-mail';
import { writeAudit } from '@/src/auth/audit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!hasSameOrigin(request)) return apiError(403, 'ORIGIN_REJECTED', 'The request origin could not be verified.', requestId);
  if (!verificationMailConfigured()) return apiError(503, 'EMAIL_UNAVAILABLE', 'Verification email is not configured yet.', requestId);
  try {
    const result = await prisma.$transaction(async tx => {
      const record = await lookupSession(tx, requestSessionToken(request));
      if (!record) return { code: 'UNAUTHENTICATED' as const };
      if (!record.user.passwordHash || !record.user.email || record.user.emailVerified) return { code: 'NOT_REQUIRED' as const };
      const latest = await tx.authVerificationToken.findFirst({ where: { identifier: record.user.email },
        orderBy: { expires: 'desc' } });
      if (latest && latest.expires > new Date(Date.now() + 24 * 60 * 60_000 - 60_000)) {
        return { code: 'TOO_SOON' as const };
      }
      const token = await issueEmailVerification(tx, record.user.email);
      await writeAudit(tx, { actor: record.user.id, action: 'email.verification-requested',
        target: record.user.id, result: 'success', requestId });
      return { code: 'READY' as const, email: record.user.email, token };
    });
    if (result.code === 'UNAUTHENTICATED') return apiError(401, 'UNAUTHENTICATED', 'Sign in to resend verification.', requestId);
    if (result.code === 'NOT_REQUIRED') return apiError(400, 'NOT_REQUIRED', 'Email verification is not required.', requestId);
    if (result.code === 'TOO_SOON') return apiError(429, 'TOO_SOON', 'Please wait a minute before requesting another email.', requestId);
    await sendVerificationEmail(result.email, result.token);
    return Response.json({ message: 'A new verification link has been sent.' }, {
      headers: { 'x-request-id': requestId, 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Verification resend failed.', { requestId,
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined });
    return apiError(503, 'UNAVAILABLE', 'The verification email could not be sent. Please retry.', requestId);
  }
}
