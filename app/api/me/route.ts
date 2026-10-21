import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { authRequestContext } from '@/src/auth/request-context';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const headers = { 'cache-control': 'private, no-store', 'x-request-id': requestId };
  try {
    const status = (await authRequestContext.run({ requestId, accountId: null },
      () => readSession(requestSessionToken(request))))?.status;
    if (!status) return Response.json({ code: 'UNAUTHENTICATED', message: 'Sign in to view your Account.', requestId }, { status: 401, headers });
    const { roles, profiles, ...limited } = status;
    return Response.json(status.restricted ? limited : { ...limited, roles, profiles }, { headers });
  } catch {
    return Response.json({ code: 'UNAVAILABLE', message: 'Account status is temporarily unavailable.', requestId }, { status: 503, headers });
  }
}
