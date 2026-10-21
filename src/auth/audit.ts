import type { Prisma } from '@/backend/generated/prisma/client';

type AuditAction = 'account.created' | 'account.established' | 'email.verified' | 'google.sign-in'
  | 'session.created' | 'session.revoked' | 'session.revoked-all' | 'session.rotated'
  | 'business.authorization' | 'request.origin' | 'account.conflict';

// Deliberately accepts only identifiers and fixed outcomes, with no metadata bag
// in which callers could accidentally persist credentials or provider tokens.
export async function writeAudit(tx: Prisma.TransactionClient, event: {
  actor: string | null;
  action: AuditAction;
  target: string | null;
  result: 'success' | 'rejected' | 'failed';
  requestId: string;
}) {
  await tx.auditEvent.create({ data: event });
}
