import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { authRequestContext } from '@/src/auth/request-context';
import { accountProjection, completeAccount } from '@/src/auth/completion';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const headers = { 'cache-control': 'private, no-store', 'x-request-id': requestId };
  try {
    const status = (await authRequestContext.run({ requestId, accountId: null },
      () => readSession(requestSessionToken(request))))?.status;
    if (!status) return Response.json({ code: 'UNAUTHENTICATED', message: 'Sign in to view your Account.', requestId }, { status: 401, headers });
    return Response.json(accountProjection(status), { headers });
  } catch {
    return Response.json({ code: 'UNAVAILABLE', message: 'Account status is temporarily unavailable.', requestId }, { status: 503, headers });
  }
}

export async function PATCH(request: NextRequest) {
  return completeAccount(request, 'account.profile-completed', async (tx, accountId, body) => {
    if (Object.keys(body).sort().join(',') !== 'name,phone'
      || typeof body.name !== 'string' || typeof body.phone !== 'string') {
      return { status: 400, error: 'INVALID_REQUEST', message: 'Provide only your full name and contact phone.' };
    }
    const name = body.name.trim().replace(/\s+/g, ' ');
    const phone = body.phone.trim();
    if (name.length < 2 || name.length > 120 || phone.length > 25
      || !/^[+\d()\s.-]+$/.test(phone) || (phone.match(/\d/g)?.length ?? 0) < 7) {
      return { status: 400, error: 'INVALID_PROFILE', message: 'Enter a full name and a valid contact phone.' };
    }
    const account = await tx.authUser.update({ where: { id: accountId }, data: { name, phone } });
    if (account.gymUserId !== null) await tx.user.update({ where: { id: account.gymUserId }, data: { name } });
    return null;
  });
}
