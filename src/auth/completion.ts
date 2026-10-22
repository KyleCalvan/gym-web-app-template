import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { Prisma } from '@/backend/generated/prisma/client';
import { prisma } from './prisma';
import { lookupSession } from './sessions';
import { requestSessionToken } from './session-cookie';
import { getAccountStatus } from './account';
import { apiError, hasSameOrigin } from './http';
import { writeAudit } from './audit';

export function accountProjection(status: NonNullable<Awaited<ReturnType<typeof getAccountStatus>>>) {
  if (!status.restricted) return status;
  const { roles: _roles, profiles: _profiles, ...limited } = status;
  return limited;
}

type CompletionResult = { error: string; status: number; message: string } | null;

export async function completeAccount(request: NextRequest, action: 'account.profile-completed' | 'account.terms-accepted',
  update: (tx: Prisma.TransactionClient, accountId: string, body: Record<string, unknown>) => Promise<CompletionResult>) {
  const requestId = randomUUID();
  if (!hasSameOrigin(request)) return apiError(403, 'ORIGIN_REJECTED', 'The request origin could not be verified.', requestId);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request');
  } catch { return apiError(400, 'INVALID_REQUEST', 'Request body could not be read.', requestId); }
  try {
    return await prisma.$transaction(async (tx) => {
      const record = await lookupSession(tx, requestSessionToken(request));
      if (!record) return apiError(401, 'UNAUTHENTICATED', 'Sign in to update your Account.', requestId);
      const result = await update(tx, record.user.id, body);
      if (result) return apiError(result.status, result.error, result.message, requestId);
      await writeAudit(tx, { actor: record.user.id, action, target: record.user.id, result: 'success', requestId });
      const status = await getAccountStatus(record.user.id, record.session, tx);
      if (!status) throw new Error('Account unavailable');
      return Response.json(accountProjection(status), { headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId } });
    });
  } catch {
    return apiError(503, 'UNAVAILABLE', 'Your Account could not be updated. Please retry.', requestId);
  }
}
