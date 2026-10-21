// Copied into app/ only while building the isolated integration application.
// This trusted test driver exercises future password/challenge service callers
// over HTTP. It is never part of a normal source build or a public sign-in API.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/auth/prisma';
import { createSession, readSession, rotateSession, revokeAccountSessions, hasFreshAuthentication } from '@/src/auth/sessions';
import { setSessionCookie, requestSessionToken } from '@/src/auth/session-cookie';
import { withBusinessAuthorization } from '@/src/auth/http';

export async function POST(request: NextRequest) {
  if (!process.env.INTEGRATION_SESSION_KEY || request.headers.get('x-test-key') !== process.env.INTEGRATION_SESSION_KEY) {
    return new NextResponse(null, { status: 404 });
  }
  const input = await request.json();
  if (input.action === 'business') return withBusinessAuthorization(request, ['member'], async () => NextResponse.json({ allowed: true }));
  if (input.action === 'fresh') {
    const record = await readSession(requestSessionToken(request));
    return NextResponse.json({ fresh: Boolean(record && hasFreshAuthentication(record.session)) });
  }
  try {
    const session = await prisma.$transaction(async (tx) => {
      if (input.action === 'issue') return createSession(tx, { accountId: input.accountId });
      if (input.action === 'rotate') return rotateSession(tx, {
        accountId: input.accountId, sessionToken: requestSessionToken(request) ?? '',
        primaryAuthenticated: input.primaryAuthenticated, mfaVerified: input.mfaVerified,
      });
      if (input.action === 'revoke-all') {
        await revokeAccountSessions(tx, input.accountId);
        return null;
      }
      throw new Error('Unknown fixture command');
    });
    const response = NextResponse.json({ ok: true });
    if (session) setSessionCookie(response, session);
    return response;
  } catch { return NextResponse.json({ ok: false }, { status: 409 }); }
}
