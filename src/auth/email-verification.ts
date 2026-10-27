import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@/backend/generated/prisma/client';

const LINK_LIFETIME_MS = 24 * 60 * 60_000;

export function verificationTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueEmailVerification(tx: Prisma.TransactionClient, email: string) {
  const token = randomBytes(32).toString('base64url');
  // Keep already delivered links usable if the new SMTP delivery fails.
  await tx.authVerificationToken.deleteMany({ where: { identifier: email, expires: { lte: new Date() } } });
  await tx.authVerificationToken.create({ data: {
    identifier: email, token: verificationTokenHash(token),
    expires: new Date(Date.now() + LINK_LIFETIME_MS),
  } });
  return token;
}

export function verificationUrl(token: string) {
  const url = new URL('/api/verify-email', process.env.NEXTAUTH_URL ?? 'http://localhost:3000');
  url.searchParams.set('token', token);
  return url.toString();
}
