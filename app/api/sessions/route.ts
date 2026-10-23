import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';

/**
 * Live sessions for the super-admin Sessions screen, plus revocation.
 *
 * AuthSession is the only source of truth: a row exists while the cookie is
 * still usable, and deleting the row signs that device out on its next request
 * (lookupSession finds no record). `expires` is filtered here because expired
 * rows are only swept when their cookie is presented again.
 */
type UiRole = 'member' | 'staff' | 'trainer' | 'admin' | 'superadmin';

const ROLE_RANK: Record<UiRole, number> = {
  member: 0,
  staff: 1,
  trainer: 1,
  admin: 2,
  superadmin: 3,
};

function primaryRole(roles: UiRole[]): UiRole {
  return roles.reduce<UiRole>((best, role) => (ROLE_RANK[role] > ROLE_RANK[best] ? role : best), 'member');
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'superadmin'] as GymRole[], async (tx) => {
    const rows = await tx.authSession.findMany({
      where: { expires: { gt: new Date() } },
      include: { user: { include: { assignedRoles: true, gymUser: true } } },
      orderBy: { lastActiveAt: 'desc' },
      take: 200,
    });

    const sessions = rows.map((s) => ({
      id: s.id,
      // The UI shows this under the user's name and uses it to collapse
      // duplicate logins, so it must be stable per account, not per session.
      userId: s.user.id,
      userName: s.user.gymUser?.name ?? s.user.name ?? s.user.email ?? 'Unknown user',
      role: primaryRole(s.user.assignedRoles.map((a) => a.role as UiRole)),
      loginAt: s.createdAt.toISOString(),
      lastActiveAt: s.lastActiveAt.toISOString(),
    }));

    return NextResponse.json({ sessions, total: sessions.length });
  });
}

/**
 * Revokes one session: DELETE /api/sessions?id=<sessionId>
 *
 * The id travels as a query parameter rather than a dynamic segment so the
 * collection and its revocation share one file and one authorization wrapper.
 * A caller may not revoke a session belonging to their own account — that is
 * what sign-out is for, and it keeps an admin from locking themselves out of
 * the very console they are using.
 */
export async function DELETE(request: NextRequest) {
  return withBusinessAuthorization(
    request,
    ['admin', 'superadmin'] as GymRole[],
    async (tx, requestId, caller) => {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json({ error: 'A session id is required.', requestId }, { status: 400 });
      }

      const session = await tx.authSession.findUnique({ where: { id } });
      if (!session) {
        return NextResponse.json({ error: 'Session not found.', requestId }, { status: 404 });
      }

      if (session.userId === caller.accountId) {
        return NextResponse.json(
          { error: 'Refusing to revoke a session on your own account. Use sign-out instead.', requestId },
          { status: 409 },
        );
      }

      await tx.authSession.delete({ where: { id } });
      await tx.auditEvent.create({
        data: {
          actor: caller.accountId,
          action: 'session.revoked',
          target: session.userId,
          result: 'success',
          requestId,
        },
      });

      return NextResponse.json({ revoked: id });
    },
  );
}
