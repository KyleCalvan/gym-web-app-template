import type { GymRole, Prisma } from '@/backend/generated/prisma/client';

/**
 * Administrators are not a table of their own.
 *
 * An admin is a gym `User` holding the `admin` RoleProfile, linked to a sign-in
 * identity by `AssignedRole`. The id serialized here is the **AuthUser** id —
 * the same value `/api/me` reports as the session user id — so a profile screen
 * can match the signed-in account without a second round trip.
 */
export interface AdminJson {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneSecondary?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  avatarUrl?: string;
  deletedAt: string | null;
}

export async function listRoleAccounts(
  tx: Prisma.TransactionClient,
  role: GymRole,
): Promise<AdminJson[]> {
  const rows = await tx.assignedRole.findMany({
    where: { role },
    include: {
      account: true,
      // profile.gymUser is required by the RoleProfile relation, so the gym
      // identity — name, email, avatar, creation date — is always present.
      profile: { include: { gymUser: true } },
    },
    orderBy: { accountId: 'asc' },
  });

  return rows.map(({ account, profile }) => {
    const gymUser = profile.gymUser;
    return {
      id: account.id,
      name: gymUser.name ?? account.name ?? gymUser.email,
      email: gymUser.email,
      phone: account.phone ?? undefined,
      phoneSecondary: undefined,
      // AuthUser.status is an AccountStatus enum (enabled | disabled); the UI
      // union is Active | Inactive, so map explicitly at this boundary.
      status: account.status === 'disabled' ? 'Inactive' : 'Active',
      createdAt: (account.establishedAt ?? gymUser.createdAt).toISOString(),
      // Avatars live only on the sign-in identity (AuthUser.image); the gym
      // User row has no avatarUrl column.
      avatarUrl: account.image ?? undefined,
      deletedAt: gymUser.deletedAt?.toISOString() ?? null,
    };
  });
}
