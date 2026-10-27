import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@/backend/generated/prisma/client/index.js';
import { prisma } from './prisma';
import { writeAudit } from './audit';
import { getAccountStatus } from './account';
import { authRequestContext } from './request-context';

type Transaction = Prisma.TransactionClient;
const requestId = () => authRequestContext.getStore()?.requestId ?? randomUUID();
const DAY = 86_400_000;
// The pg adapter qualifies ORM tables but does not set search_path for raw SQL.
const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? 'public';
const quotedSchema = `"${schema.replace(/"/g, '""')}"`;
// Schema is configuration-controlled and quoted as an identifier; IDs stay bound parameters.
const accountLockSql = `SELECT "id" FROM ${quotedSchema}."AuthUser" WHERE "id" = $1 FOR UPDATE`;
const sessionLockSql = `SELECT "id" FROM ${quotedSchema}."AuthSession" WHERE "sessionToken" = $1 FOR UPDATE`;

async function lockAccount(tx: Transaction, accountId: string) {
  await tx.$queryRawUnsafe(accountLockSql, accountId);
}

function limits(roles: { role: string }[]) {
  return roles.some(({ role }) => role !== 'member')
    ? { idle: 30 * 60_000, absolute: 12 * 60 * 60_000 }
    : { idle: 7 * DAY, absolute: 30 * DAY };
}

// Callers run issuance/revocation in the same transaction as credential or
// security changes. No HTTP endpoint accepts client-supplied proof timestamps.
export async function createSession(tx: Transaction, input: {
  accountId: string; sessionToken?: string;
}) {
  await lockAccount(tx, input.accountId);
  const user = await tx.authUser.findUniqueOrThrow({ where: { id: input.accountId }, include: { assignedRoles: true } });
  if (user.status !== 'enabled') throw new Error('Account unavailable');
  const now = new Date();
  const session = await tx.authSession.create({ data: {
    userId: user.id, sessionToken: input.sessionToken ?? randomBytes(32).toString('base64url'),
    createdAt: now, lastActiveAt: now, primaryAuthenticatedAt: now,
    expires: new Date(now.getTime() + limits(user.assignedRoles).absolute),
  } });
  await writeAudit(tx, { actor: user.id, action: 'session.created', target: user.id, result: 'success', requestId: requestId() });
  return session;
}

export async function revokeAccountSessions(tx: Transaction, accountId: string) {
  // Issuance takes the same Account lock, so a concurrent sign-in cannot
  // escape a committed disablement or credential/security transition.
  await lockAccount(tx, accountId);
  await tx.authSession.deleteMany({ where: { userId: accountId } });
  await writeAudit(tx, { actor: authRequestContext.getStore()?.accountId ?? null, action: 'session.revoked-all',
    target: accountId, result: 'success', requestId: requestId() });
}

export async function revokeSession(tx: Transaction, sessionToken: string) {
  const session = await tx.authSession.findUnique({ where: { sessionToken } });
  if (!session) return null;
  await lockAccount(tx, session.userId);
  await tx.authSession.deleteMany({ where: { id: session.id, sessionToken } });
  await writeAudit(tx, { actor: session.userId, action: 'session.revoked', target: session.userId,
    result: 'success', requestId: requestId() });
  return session;
}

export async function lookupSession(tx: Transaction, sessionToken: string | undefined) {
  if (!sessionToken) return null;
  // Always lock Account before session, shared by issuance and revocation.
  const owner = await tx.authSession.findUnique({ where: { sessionToken }, select: { userId: true } });
  if (!owner) return null;
  await lockAccount(tx, owner.userId);
  // Serialize lookup, rotation and revocation on the row. Polls never touch idle.
  await tx.$queryRawUnsafe(sessionLockSql, sessionToken);
  const record = await tx.authSession.findUnique({ where: { sessionToken }, include: { user: { include: { assignedRoles: true } } } });
  if (!record) return null;
  if (record.user.status === 'disabled') {
    await revokeAccountSessions(tx, record.userId);
    return null;
  }
  const now = new Date();
  const policy = limits(record.user.assignedRoles);
  const expires = new Date(Math.min(record.expires.getTime(), record.createdAt.getTime() + policy.absolute));
  if (now >= expires || now.getTime() >= record.lastActiveAt.getTime() + policy.idle) {
    await revokeSession(tx, sessionToken);
    return null;
  }
  const { user, ...session } = record;
  session.expires = expires;
  const status = await getAccountStatus(user.id, session, tx);
  return { session, user, status: status! };
}

export async function readSession(sessionToken: string | undefined) {
  if (!sessionToken) return null;
  return prisma.$transaction((tx) => lookupSession(tx, sessionToken));
}

// Only a trusted authentication/challenge service may supply proof. Preserve
// original lifetime and idle age; rotation cannot renew absolute expiration.
export async function rotateSession(tx: Transaction, input: {
  accountId: string; sessionToken: string; primaryAuthenticated?: boolean; mfaVerified?: boolean;
}) {
  const current = await lookupSession(tx, input.sessionToken);
  if (!current || current.user.id !== input.accountId) throw new Error('Session unavailable');
  const now = new Date();
  if (input.mfaVerified && !current.user.mfaEnabledAt) throw new Error('Authenticator enrollment required');
  const session = await tx.authSession.update({ where: { id: current.session.id }, data: {
    sessionToken: randomBytes(32).toString('base64url'),
    ...(input.primaryAuthenticated ? { primaryAuthenticatedAt: now } : {}),
    ...(input.mfaVerified ? { mfaVerifiedAt: now } : {}),
  } });
  await writeAudit(tx, { actor: input.accountId, action: 'session.rotated', target: input.accountId,
    result: 'success', requestId: requestId() });
  return session;
}

export function hasFreshAuthentication(session: { primaryAuthenticatedAt: Date | null }, now = new Date()) {
  const proof = session.primaryAuthenticatedAt?.getTime();
  return proof !== undefined && proof <= now.getTime() && now.getTime() - proof < 5 * 60_000;
}
