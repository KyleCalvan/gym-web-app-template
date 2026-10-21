import NextAuth from 'next-auth';
import { authOptions } from '@/src/auth/options';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/src/auth/prisma';
import { authRequestContext } from '@/src/auth/request-context';

export const runtime = 'nodejs';

const nextAuthHandler = NextAuth(authOptions);
async function handler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const requestId = randomUUID();
  const token = request.cookies.get('__Secure-next-auth.session-token')?.value
    ?? request.cookies.get('next-auth.session-token')?.value;
  const session = token ? await prisma.authSession.findUnique({ where: { sessionToken: token } }) : null;
  const accountId = session && session.expires > new Date() ? session.userId : null;
  return authRequestContext.run({ requestId, accountId }, async () => {
    const response = await nextAuthHandler(request, context);
    response.headers.set('x-request-id', requestId);
    return response;
  });
}
export { handler as GET, handler as POST };
