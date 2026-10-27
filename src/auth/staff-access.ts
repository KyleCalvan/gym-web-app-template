import type { Prisma } from '@/backend/generated/prisma/client';

export async function hasActiveStaffProfile(tx: Prisma.TransactionClient, accountId: string | null) {
  if (!accountId) return false;
  const assignment = await tx.assignedRole.findUnique({
    where: { accountId_role: { accountId, role: 'staff' } },
    include: { profile: true },
  });
  return Boolean(assignment && !assignment.profile.archivedAt && assignment.profile.status === 'Active');
}
