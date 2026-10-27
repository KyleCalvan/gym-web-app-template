import { prisma } from './prisma';
import { loadAdminData } from './admin-data';
import type { ActiveSession, Admin } from '../types';

export async function loadSuperAdminData(profileId: string) {
  const [management, profile, sessionRows] = await Promise.all([
    loadAdminData(),
    prisma.roleProfile.findUniqueOrThrow({ where: { id: profileId }, include: { gymUser: true } }),
    prisma.authSession.findMany({ where: { expires: { gt: new Date() } },
      include: { user: { select: { name: true, assignedRoles: { select: { role: true } } } } },
      orderBy: { lastActiveAt: 'desc' }, take: 500 }),
  ]);
  const superadmin: Admin = {
    id: profile.id, name: profile.gymUser.name ?? 'Super Admin', email: profile.gymUser.email,
    phone: profile.gymUser.phone ?? '', phoneSecondary: profile.gymUser.phoneSecondary ?? '',
    status: profile.archivedAt ? 'Inactive' : 'Active',
    createdAt: profile.createdAt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    avatarUrl: profile.gymUser.avatarUrl ?? undefined,
    deletedAt: profile.archivedAt?.toISOString() ?? null,
  };
  const activeSessions: ActiveSession[] = sessionRows.map((row) => ({
    id: row.id, userId: row.userId, userName: row.user.name ?? 'User',
    role: row.user.assignedRoles[0]?.role ?? 'member',
    loginAt: row.createdAt.toISOString(), lastActiveAt: row.lastActiveAt.toISOString(),
  }));
  return { ...management, superadmin, activeSessions };
}
