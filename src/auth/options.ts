import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { authAdapter } from './adapter';
import { prisma } from './prisma';
import { getAssignedRoles } from './roles';

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
        // Never silently merge OAuth identities by email. Existing gym users
        // are linked separately below, only after Google's verified-email claim.
        allowDangerousEmailAccountLinking: false,
      })]
    : [],
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return false;

      const email = user.email?.trim().toLowerCase();
      const emailVerified = (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      if (!email || !emailVerified) return false;

      try {
        await prisma.$transaction(async (tx) => {
          const authUser = await tx.authUser.findUnique({ where: { id: user.id } });
          if (!authUser || authUser.gymUserId !== null) return;

          // Link an existing gym identity only to a Google-verified email. If
          // there is no matching record, create the member identity once.
          let gymUser = await tx.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
          });
          if (!gymUser) {
            gymUser = await tx.user.create({
              data: { email, name: user.name?.trim() || null },
            });
          }

          await tx.authUser.update({
            where: { id: authUser.id },
            data: { gymUserId: gymUser.id },
          });
        });
        return true;
      } catch (error) {
        // Do not emit profile data, email addresses, or OAuth tokens to logs.
        console.error('Google sign-in could not link the gym account.');
        return false;
      }
    },
    async session({ session, user }) {
      if (session.user) {
        const authUser = await prisma.authUser.findUnique({
          where: { id: user.id },
          select: { gymUserId: true },
        });
        const roles = getAssignedRoles(session.user.email);
        if (roles.length === 0) throw new Error('The authenticated account has no assigned application roles.');
        session.user.id = user.id;
        session.user.roles = roles;
        session.user.role = roles.includes('member') ? 'member' : roles[0];
        session.user.gymUserId = authUser?.gymUserId ?? null;
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
