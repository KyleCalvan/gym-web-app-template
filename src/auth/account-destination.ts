import type { GymRole } from '@/backend/generated/prisma/client';

const ROLE_PRIORITY: readonly GymRole[] = ['superadmin', 'admin', 'staff', 'trainer', 'member'];

export function accountPortalRole(status: {
  account: { status: string };
  roles: readonly GymRole[];
  profiles: readonly { role: GymRole; profileId: string }[];
}): GymRole | null {
  if (status.account.status !== 'enabled') return null;
  return ROLE_PRIORITY.find((role) => status.roles.includes(role)
    && status.profiles.some((profile) => profile.role === role && profile.profileId)) ?? null;
}
