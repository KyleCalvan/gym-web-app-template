import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/auth/prisma';
import { verificationTokenHash } from '@/src/auth/email-verification';
import { createSession } from '@/src/auth/sessions';
import { setSessionCookie } from '@/src/auth/session-cookie';
import { writeAudit } from '@/src/auth/audit';
import { authRequestContext } from '@/src/auth/request-context';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const destination = (path: string) => new URL(path, process.env.NEXTAUTH_URL ?? request.url);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return NextResponse.redirect(destination('/account?verification=invalid'));
  }
  const requestId = randomUUID();
  try {
    return await authRequestContext.run({ requestId, accountId: null }, () => prisma.$transaction(async tx => {
      const hash = verificationTokenHash(token);
      const proof = await tx.authVerificationToken.findUnique({ where: { token: hash } });
      if (!proof || proof.expires <= new Date()) return NextResponse.redirect(destination('/account?verification=invalid'));
      const consumed = await tx.authVerificationToken.deleteMany({ where: { token: hash, expires: { gt: new Date() } } });
      if (consumed.count !== 1) return NextResponse.redirect(destination('/account?verification=invalid'));
      const account = await tx.authUser.findUnique({ where: { email: proof.identifier } });
      if (!account || !account.passwordHash || account.status !== 'enabled') {
        return NextResponse.redirect(destination('/account?verification=invalid'));
      }
      // Verification consumes every outstanding link for this address.
      await tx.authVerificationToken.deleteMany({ where: { identifier: proof.identifier } });
      authRequestContext.getStore()!.accountId = account.id;
      await tx.authUser.update({ where: { id: account.id }, data: {
        emailVerified: new Date(), emailVerifiedProvider: 'password-registration',
        emailVerifiedSubject: account.email,
      } });
      await writeAudit(tx, { actor: account.id, action: 'email.verified', target: account.id, result: 'success', requestId });
      const session = await createSession(tx, { accountId: account.id });
      const response = NextResponse.redirect(destination('/account?verified=1'));
      response.headers.set('cache-control', 'private, no-store');
      response.headers.set('referrer-policy', 'no-referrer');
      setSessionCookie(response, session);
      return response;
    }));
  } catch {
    return NextResponse.redirect(destination('/account?verification=error'));
  }
}
