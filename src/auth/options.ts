import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { authAdapter } from './adapter';
import { establishGoogleAccount, recordGoogleRejection } from './account';
import { sessionCookiePolicy, requestSessionToken } from './session-cookie';
import { readSession } from './sessions';
import { cookies } from 'next/headers';

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleConfigured = Boolean(googleClientId && googleClientSecret);

export const authOptions: NextAuthOptions = {
  adapter: authAdapter,
  providers: googleConfigured
    ? [GoogleProvider({
        clientId: googleClientId!,
        clientSecret: googleClientSecret!,
        authorization: { params: { prompt: 'select_account' } },
        checks: ['pkce', 'state'],
        // The canonical Account service owns deliberate identity establishment.
        allowDangerousEmailAccountLinking: false,
      })]
    : [],
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  cookies: { sessionToken: sessionCookiePolicy() },
  logger: {
    error(code) { console.error('Authentication request failed:', code); },
    warn(code) { console.warn('Authentication configuration warning:', code); },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return false;

      const googleProfile = profile as { sub?: string; email?: string; name?: string; email_verified?: boolean } | undefined;
      if (typeof googleProfile?.sub !== 'string' || typeof googleProfile.email !== 'string' || googleProfile.email_verified !== true
        || googleProfile.sub !== account.providerAccountId) return recordGoogleRejection();
      return establishGoogleAccount({ ...googleProfile, sub: googleProfile.sub, email: googleProfile.email, email_verified: true });
    },
    async session({ session, user }) {
      if (session.user) {
        // NextAuth v4 projects away adapter assurance fields before this
        // callback. Resolve the actual requesting cookie, never client updates.
        const record = await readSession(requestSessionToken({ cookies: await cookies() }));
        const status = record?.status;
        if (!status || record.user.id !== user.id) throw new Error('Account unavailable');
        const roles = status.account.status === 'enabled' ? status.roles : [];
        session.user.id = user.id;
        session.user.roles = roles;
        session.user.role = roles.includes('member') ? 'member' : roles[0] ?? null;
        session.user.gymUserId = status.account.gymUserId;
        session.user.restricted = status.restricted;
        session.user.nextSteps = status.nextSteps;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        return new URL(url).origin === baseUrl ? url : baseUrl;
      } catch {
        return baseUrl;
      }
    },
  },
};
