import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseOAuthClient } from '@/src/auth/supabase-oauth';
import { establishGoogleAccount, normalizeEmail } from '@/src/auth/account';
import { authRequestContext } from '@/src/auth/request-context';
import { prisma } from '@/src/auth/prisma';
import { readSession, createSession } from '@/src/auth/sessions';
import { requestSessionToken, setSessionCookie } from '@/src/auth/session-cookie';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const base = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
  const failure = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, base));
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return failure('OAuthCallback');
  try {
    const { client } = supabaseOAuthClient(request);
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user?.email || !data.user.email_confirmed_at) return failure('OAuthCallback');
    const identity = data.user.identities?.find(({ provider }) => provider === 'google');
    const subject = identity?.identity_data?.sub;
    if (typeof subject !== 'string' || !subject) return failure('OAuthCallback');
    const email = normalizeEmail(data.user.email);
    const existing = await readSession(requestSessionToken(request));
    return await authRequestContext.run({ requestId: randomUUID(), accountId: existing?.user.id ?? null }, async () => {
      const established = await establishGoogleAccount({ sub: subject, email,
        name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
        email_verified: true });
      if (established !== true) return failure(established ? 'AccountConflict' : 'AccessDenied');
      const account = await prisma.authUser.findUnique({ where: { email }, select: { id: true } });
      if (!account) return failure('OAuthCallback');
      const session = await prisma.$transaction((tx) => createSession(tx, { accountId: account.id }));
      const response = NextResponse.redirect(new URL('/account', base));
      response.headers.set('cache-control', 'private, no-store');
      // The app uses its short-lived database session after the verified
      // Supabase exchange; do not retain a second browser session cookie.
      for (const { name } of request.cookies.getAll()) {
        if (name.startsWith('sb-')) response.cookies.set(name, '', { path: '/', maxAge: 0 });
      }
      setSessionCookie(response, session);
      return response;
    });
  } catch {
    return failure('OAuthCallback');
  }
}
