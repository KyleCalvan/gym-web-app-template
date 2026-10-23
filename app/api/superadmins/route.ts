import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import { listRoleAccounts } from '@/src/auth/admin-accounts';
import type { GymRole } from '@/backend/generated/prisma/client';

/**
 * Reads the accounts that hold the `superadmin` role.
 *
 * Same shape as /api/admins because both screens render the same Admin type.
 * An empty list is a truthful answer here, not an error: no account currently
 * holds the superadmin role in this database, and the screen says so.
 */
export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'superadmin'] as GymRole[], async (tx) => {
    const superadmins = await listRoleAccounts(tx, 'superadmin');
    return NextResponse.json({ superadmins, total: superadmins.length });
  });
}
