import type { Prisma } from '@/backend/generated/prisma/client';

type AuditAction = 'account.created' | 'account.established' | 'email.verified' | 'google.sign-in'
  | 'password.sign-in' | 'password.register' | 'email.verification-requested'
  | 'session.created' | 'session.revoked' | 'session.revoked-all' | 'session.rotated'
  | 'business.authorization' | 'request.origin' | 'account.conflict'
  | 'account.profile-completed' | 'account.terms-accepted'
  | 'staff.member-registered' | 'staff.member-checked-in' | 'staff.sale-simulated' | 'staff.sale-recorded' | 'staff.profile-updated';

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
