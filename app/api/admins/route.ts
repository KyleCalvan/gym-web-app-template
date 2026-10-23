import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import { listRoleAccounts } from '@/src/auth/admin-accounts';
import type { GymRole } from '@/backend/generated/prisma/client';

/**
 * Reads the accounts that hold the `admin` role.
 *
 * Guarded by admin *and* superadmin: this feeds the administrator profile
 * screen, and a deployment may legitimately have no superadmin row at all
 * (the current database has exactly one admin and zero superadmins), so a
 * superadmin-only guard would make the endpoint permanently unreachable.
 */
export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'superadmin'] as GymRole[], async (tx) => {
    const admins = await listRoleAccounts(tx, 'admin');
    return NextResponse.json({ admins, total: admins.length });
  });
}
