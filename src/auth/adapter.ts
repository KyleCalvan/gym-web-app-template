import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import { normalizeEmail } from './account';
import { createSession, readSession, revokeSession } from './sessions';

// Keep the existing integer-keyed gym User/Post schema intact. The Auth.js
// tables use string IDs, so expose them under the delegate names the official
// adapter expects without changing the existing User model.
const authClient = new Proxy(prisma, {
  get(target, property) {
    if (property === 'user') return target.authUser;
    if (property === 'account') return target.authAccount;
    if (property === 'session') return target.authSession;
    if (property === 'verificationToken') return target.authVerificationToken;
    return Reflect.get(target, property, target);
  },
});

const adapter = PrismaAdapter(
  authClient as unknown as Parameters<typeof PrismaAdapter>[0],
);

export const authAdapter: typeof adapter = {
  ...adapter,
  async getUserByEmail(email) {
    const user = await prisma.authUser.findUnique({ where: { email: normalizeEmail(email) } });
    return user?.email ? { ...user, email: user.email } : null;
  },
  // Google provisioning is committed before NextAuth's callback handler. Never
  // fall back to its separate create/link writes if that identity disappears.
  async createUser() { throw new Error('Account provisioning requires verified identity establishment.'); },
  async linkAccount() { throw new Error('Adding a sign-in method requires fresh authentication.'); },
  async createSession(session) {
    return prisma.$transaction((tx) => createSession(tx, { accountId: session.userId, sessionToken: session.sessionToken }));
  },
  async updateSession({ sessionToken }) {
    // NextAuth's rolling refresh must not extend idle or absolute lifetime.
    return (await readSession(sessionToken))?.session ?? null;
  },
  async deleteSession(sessionToken) {
    return prisma.$transaction((tx) => revokeSession(tx, sessionToken));
  },
  async getSessionAndUser(sessionToken) {
    const record = await readSession(sessionToken);
    return record?.user.email ? { user: { ...record.user, email: record.user.email }, session: record.session } : null;
  },
};
