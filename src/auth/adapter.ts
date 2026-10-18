import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';

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

export const authAdapter = PrismaAdapter(
  authClient as unknown as Parameters<typeof PrismaAdapter>[0],
);
