import NextAuth from 'next-auth';
import { authOptions } from '@/src/auth/options';
import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { readSession, rotateSession } from '@/src/auth/sessions';
import { requestSessionToken, setSessionCookie, sessionCookiePolicy } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';
import { logout } from '@/src/auth/logout';
import { apiError } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';

export const runtime = 'nodejs';

const nextAuthHandler = NextAuth(authOptions);
async function handler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const requestId = randomUUID();
  const { nextauth } = await context.params;
  if (request.method === 'POST' && nextauth.length === 1 && nextauth[0] === 'signout') {
    return authRequestContext.run({ requestId, accountId: null }, () => logout(request, requestId));
  }
  return authRequestContext.run({ requestId, accountId: null }, async () => {
    try {
      const record = await readSession(requestSessionToken(request));
      authRequestContext.getStore()!.accountId = record?.user.id ?? null;
      const result = await nextAuthHandler(request, context);
      const response = new NextResponse(result.body, { status: result.status, statusText: result.statusText, headers: result.headers });
      const authenticatedId = authRequestContext.getStore()?.googleAuthenticatedAccountId;
      if (record && authenticatedId === record.user.id && nextauth[0] === 'callback'
        && nextauth[1] === 'google' && response.status < 400) {
        // NextAuth reuses a same-Account session on Google reauthentication.
        // Rotate that credential and record fresh primary proof ourselves.
        const session = await prisma.$transaction((tx) => rotateSession(tx, {
          accountId: authenticatedId, sessionToken: record.session.sessionToken, primaryAuthenticated: true,
        }));
        setSessionCookie(response, session);
      } else if (record && nextauth[0] === 'session' && response.status === 200
        && response.cookies.get(sessionCookiePolicy().name)?.value === record.session.sessionToken) {
        // v4 emits a rolling cookie expiry even when updateSession is a no-op.
        setSessionCookie(response, record.session);
      }
      response.headers.set('x-request-id', requestId);
      return response;
    } catch (error) {
      console.error('Authentication request failed.', { requestId,
        code: error && typeof error === 'object' && 'code' in error ? error.code : undefined });
      return apiError(503, 'UNAVAILABLE', 'Authentication is temporarily unavailable.', requestId);
    }
  });
}
export { handler as GET, handler as POST };
