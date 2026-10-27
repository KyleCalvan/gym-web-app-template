import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/backend/generated/prisma/client';
import { prisma } from '@/src/auth/prisma';
import { normalizeEmail, getAccountStatus } from '@/src/auth/account';
import { verifyPassword } from '@/src/auth/password';
import { createSession } from '@/src/auth/sessions';
import { setSessionCookie } from '@/src/auth/session-cookie';
import { apiError, hasSameOrigin } from '@/src/auth/http';
import { writeAudit } from '@/src/auth/audit';
import { authRequestContext } from '@/src/auth/request-context';

export const runtime = 'nodejs';

const WINDOW_MS = 15 * 60_000;
const ACCOUNT_LIMIT = 5;
const IP_LIMIT = 30;
const INVALID_MESSAGE = 'Email or password is incorrect.';

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function requestIp(request: NextRequest) {
  // Only the hosting platform's forwarded address is trusted. Other hosts
  // share a conservative limit rather than letting clients supply their own IP.
  const forwarded = process.env.VERCEL_ENV ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : null;
  return forwarded && isIP(forwarded) ? forwarded : 'unresolved';
}

type Tx = Prisma.TransactionClient;

async function lockThrottles(tx: Tx, keys: string[]) {
  for (const key of [...keys].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

async function recordFailure(tx: Tx, key: string, limit: number, now: Date) {
  const current = await tx.passwordLoginThrottle.findUnique({ where: { key } });
  const inWindow = current && now.getTime() - current.windowStart.getTime() < WINDOW_MS;
  const failures = inWindow ? current.failures + 1 : 1;
  await tx.passwordLoginThrottle.upsert({
    where: { key },
    create: { key, failures, windowStart: now, blockedUntil: failures >= limit ? new Date(now.getTime() + WINDOW_MS) : null },
    update: { failures, windowStart: inWindow ? current.windowStart : now,
      blockedUntil: failures >= limit ? new Date(now.getTime() + WINDOW_MS) : null },
  });
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!hasSameOrigin(request)) return apiError(403, 'ORIGIN_REJECTED', 'The request origin could not be verified.', requestId);
  let body: { email?: unknown; password?: unknown };
  try {
    if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('JSON required');
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  } catch { return apiError(400, 'INVALID_REQUEST', 'Enter your email and password.', requestId); }
  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return apiError(400, 'INVALID_REQUEST', 'Enter your email and password.', requestId);
  }
  const email = normalizeEmail(body.email);
  const password = body.password;
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length > 128) {
    return apiError(400, 'INVALID_REQUEST', 'Enter a valid email and password.', requestId);
  }
  const emailKey = `email:${digest(email)}`;
  const ipKey = `ip:${digest(requestIp(request))}`;
  try {
    return await authRequestContext.run({ requestId, accountId: null }, () => prisma.$transaction(async (tx) => {
      await lockThrottles(tx, [emailKey, ipKey]);
      const now = new Date();
      const [emailThrottle, ipThrottle] = await Promise.all([
        tx.passwordLoginThrottle.findUnique({ where: { key: emailKey } }),
        tx.passwordLoginThrottle.findUnique({ where: { key: ipKey } }),
      ]);
      if ((emailThrottle?.blockedUntil && emailThrottle.blockedUntil > now)
        || (ipThrottle?.blockedUntil && ipThrottle.blockedUntil > now)) {
        await writeAudit(tx, { actor: null, action: 'password.sign-in', target: null,
          result: 'rejected', requestId });
        return apiError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Please try again later.', requestId);
      }
      const account = await tx.authUser.findUnique({ where: { email } });
      const valid = await verifyPassword(password, account?.passwordHash ?? null);
      if (!valid || !account || account.status !== 'enabled') {
        await recordFailure(tx, emailKey, ACCOUNT_LIMIT, now);
        await recordFailure(tx, ipKey, IP_LIMIT, now);
        await writeAudit(tx, { actor: account?.id ?? null, action: 'password.sign-in', target: account?.id ?? null,
          result: 'rejected', requestId });
        return apiError(401, 'INVALID_CREDENTIALS', INVALID_MESSAGE, requestId);
      }
      authRequestContext.getStore()!.accountId = account.id;
      const session = await createSession(tx, { accountId: account.id });
      await tx.passwordLoginThrottle.deleteMany({ where: { key: emailKey } });
      await writeAudit(tx, { actor: account.id, action: 'password.sign-in', target: account.id,
        result: 'success', requestId });
      const status = await getAccountStatus(account.id, session, tx);
      if (!status) throw new Error('Account unavailable');
      const response = NextResponse.json({ next: status.restricted ? '/account' : '/' }, {
        headers: { 'x-request-id': requestId, 'cache-control': 'private, no-store' },
      });
      setSessionCookie(response, session);
      return response;
    }));
  } catch {
    return apiError(503, 'UNAVAILABLE', 'Sign-in is temporarily unavailable. Please retry.', requestId);
  }
}
