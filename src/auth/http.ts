import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { GymRole, Prisma } from '@/backend/generated/prisma/client';
import { prisma } from './prisma';
import { lookupSession } from './sessions';
import { requestSessionToken } from './session-cookie';
import { authRequestContext } from './request-context';
import { writeAudit } from './audit';

export function apiError(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ code, message, requestId }, {
    status, headers: { 'x-request-id': requestId, 'cache-control': 'private, no-store' },
  });
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.NEXTAUTH_URL ?? request.url).origin;
  return origin === expected && request.headers.get('sec-fetch-site') !== 'cross-site';
}

// A restricted identity is allowed to read its own limited status and log out.
// Completion/security routes must opt into their specific state when added;
// no generic restricted-session bypass exists for business operations.
export async function withBusinessAuthorization(request: NextRequest, roles: GymRole[],
  action: (tx: Prisma.TransactionClient, requestId: string) => Promise<NextResponse>) {
  const requestId = randomUUID();
  return authRequestContext.run({ requestId, accountId: null }, async () => {
    try {
      const response = await prisma.$transaction(async (tx) => {
        const record = await lookupSession(tx, requestSessionToken(request));
        const context = authRequestContext.getStore()!;
        context.accountId = record?.user.id ?? null;
        const reject = async (status: number, code: string, message: string, origin = false) => {
          await writeAudit(tx, { actor: context.accountId, action: origin ? 'request.origin' : 'business.authorization',
            target: context.accountId, result: 'rejected', requestId });
          return apiError(status, code, message, requestId);
        };
        if (!record) return reject(401, 'UNAUTHENTICATED', 'Sign in with an authorized Account.');
        if (!hasSameOrigin(request)) return reject(403, 'ORIGIN_REJECTED', 'The request origin could not be verified.', true);
        if (record.status.restricted) return reject(403, 'ACCOUNT_RESTRICTED', 'Complete the required Account steps before continuing.');
        if (!record.status.roles.some((role) => roles.includes(role))) return reject(403, 'FORBIDDEN', 'Your Assigned Roles do not permit this operation.');
        await writeAudit(tx, { actor: record.user.id, action: 'business.authorization', target: record.user.id,
          result: 'success', requestId });
        // Only deliberate, authorized business requests extend idle lifetime.
        await tx.authSession.update({ where: { id: record.session.id }, data: { lastActiveAt: new Date() } });
        return action(tx, requestId);
      });
      response.headers.set('x-request-id', requestId);
      response.headers.set('cache-control', 'private, no-store');
      return response;
    } catch (error) {
      console.error('Business operation failed.', { requestId,
        name: error instanceof Error ? error.name : 'UnknownError',
        code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
        message: process.env.INTEGRATION_SESSION_KEY && error instanceof Error ? error.message.slice(0, 600) : undefined });
      // Rejected/failed outcomes must survive the rolled-back business write.
      try {
        await writeAudit(prisma, { actor: authRequestContext.getStore()?.accountId ?? null,
          action: 'business.authorization', target: null, result: 'failed', requestId });
      } catch { console.error('Security audit storage is unavailable.'); }
      return apiError(503, 'UNAVAILABLE', 'The operation is temporarily unavailable. Please retry.', requestId);
    }
  });
}
