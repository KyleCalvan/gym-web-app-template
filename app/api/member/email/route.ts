import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail } from '@/src/auth/account';
import { issueEmailVerification, verificationTokenHash } from '@/src/auth/email-verification';
import { hasSameOrigin } from '@/src/auth/http';
import { prisma } from '@/src/auth/prisma';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { readSession } from '@/src/auth/sessions';
import { sendEmailChangeVerification, verificationMailConfigured } from '@/src/auth/verification-mail';
import { writeAudit } from '@/src/auth/audit';

export const runtime = 'nodejs';

const prefix = 'member-email-change:';

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return Response.json({ message: 'Request origin could not be verified.' }, { status: 403 });
  if (!verificationMailConfigured()) return Response.json({ message: 'Email verification is unavailable.' }, { status: 503 });

  let record: Awaited<ReturnType<typeof readSession>>;
  try { record = await readSession(requestSessionToken(request)); }
  catch { return Response.json({ message: 'Your account is temporarily unavailable. Please retry.' }, { status: 503 }); }
  if (!record) return Response.json({ message: 'Sign in to update your email.' }, { status: 401 });
  if (record.status.restricted || !record.status.roles.includes('member')) {
    return Response.json({ message: 'Your account cannot update its email.' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: 'Enter a valid email address.' }, { status: 400 }); }
  const rawEmail = (body as { email?: unknown } | null)?.email;
  if (typeof rawEmail !== 'string') return Response.json({ message: 'Enter a valid email address.' }, { status: 400 });
  const email = normalizeEmail(rawEmail);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ message: 'Enter a valid email address.' }, { status: 400 });
  }
  if (email === record.user.email) return Response.json({ message: 'This is already your email address.' }, { status: 400 });

  try {
    const identifier = prefix + JSON.stringify({ id: record.user.id, old: record.user.email, email });
    const result = await prisma.$transaction(async tx => {
      if (await tx.authUser.findFirst({ where: { email, id: { not: record.user.id } }, select: { id: true } })
        || await tx.user.findFirst({ where: { email, id: { not: record.user.gymUserId ?? -1 } }, select: { id: true } })) {
        return { conflict: true as const };
      }
      const latest = await tx.authVerificationToken.findFirst({ where: { identifier }, orderBy: { expires: 'desc' } });
      if (latest && latest.expires > new Date(Date.now() + 24 * 60 * 60_000 - 60_000)) {
        return { tooSoon: true as const };
      }
      const token = await issueEmailVerification(tx, identifier);
      await writeAudit(tx, { actor: record.user.id, action: 'email.verification-requested',
        target: record.user.id, result: 'success', requestId: randomUUID() });
      return { token };
    });
    if ('conflict' in result) return Response.json({ message: 'This email address is already in use.' }, { status: 409 });
    if ('tooSoon' in result) return Response.json({ message: 'Please wait a minute before requesting another link.' }, { status: 429 });
    await sendEmailChangeVerification(email, result.token);
    return Response.json({ message: 'Check your new email address for a verification link.' },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch {
    return Response.json({ message: 'Verification email could not be sent. Please retry.' }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const destination = (status: string) => {
    const response = NextResponse.redirect(new URL(`/account?email-change=${status}`, process.env.NEXTAUTH_URL ?? request.url));
    response.headers.set('cache-control', 'private, no-store');
    response.headers.set('referrer-policy', 'no-referrer');
    return response;
  };
  const token = request.nextUrl.searchParams.get('token');
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return destination('invalid');

  try {
    const result = await prisma.$transaction(async tx => {
      const hash = verificationTokenHash(token);
      const proof = await tx.authVerificationToken.findUnique({ where: { token: hash } });
      if (!proof || proof.expires <= new Date() || !proof.identifier.startsWith(prefix)) return false;
      let change: unknown;
      try { change = JSON.parse(proof.identifier.slice(prefix.length)); } catch { return false; }
      if (!change || typeof change !== 'object' || !('id' in change) || typeof change.id !== 'string'
        || !('old' in change) || typeof change.old !== 'string'
        || !('email' in change) || typeof change.email !== 'string'
        || !change.id || !change.old || !change.email) return false;
      const account = await tx.authUser.findUnique({ where: { id: change.id }, select: { id: true, email: true, gymUserId: true, status: true } });
      if (!account || account.status !== 'enabled' || account.email !== change.old || account.gymUserId === null) return false;
      const consumed = await tx.authVerificationToken.deleteMany({ where: { token: hash, expires: { gt: new Date() } } });
      if (consumed.count !== 1) return false;
      await tx.user.update({ where: { id: account.gymUserId }, data: { email: change.email } });
      await tx.authUser.update({ where: { id: account.id }, data: {
        email: change.email, emailVerified: new Date(),
        emailVerifiedProvider: 'member-email-change', emailVerifiedSubject: change.email,
      } });
      await tx.authVerificationToken.deleteMany({ where: { identifier: proof.identifier } });
      await writeAudit(tx, { actor: account.id, action: 'email.verified', target: account.id,
        result: 'success', requestId: randomUUID() });
      return true;
    });
    return destination(result ? 'updated' : 'invalid');
  } catch {
    return destination('error');
  }
}
