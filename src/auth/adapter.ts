import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import { normalizeEmail } from './account';
import { randomUUID } from 'node:crypto';
import { writeAudit } from './audit';
import { authRequestContext } from './request-context';

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
  async getSessionAndUser(sessionToken) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.authSession.findUnique({ where: { sessionToken }, include: { user: true } });
      if (!record) return null;
      if (record.user.status === 'disabled') {
        await tx.authSession.deleteMany({ where: { userId: record.userId } });
        await writeAudit(tx, { actor: null, action: 'session.revoked', target: record.userId, result: 'success',
          requestId: authRequestContext.getStore()?.requestId ?? randomUUID() });
        return null;
      }
      const { user, ...session } = record;
      return user.email ? { user: { ...user, email: user.email }, session } : null;
    });
  },
};
