import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';

/**
 * Reads the persisted AuditEvent ledger for the admin Activity Logs screen.
 *
 * AuditEvent stores what happened (action, target, result) but not a UI
 * severity or the actor's role, so both are derived here rather than invented
 * in the client: destructive/refunding actions surface as warnings, failed
 * requests as danger, and the role comes from the action's namespace.
 */
// Must match src/types.ts AuditLevel exactly ('info' | 'warn' | 'error').
// The explorer counts and colours rows by these three values, so an
// out-of-union level would render as an unstyled badge and vanish from the
// stat tiles rather than failing loudly.
type UiLevel = 'info' | 'warn' | 'error';

function levelFor(action: string, result: string): UiLevel {
  const lowered = `${action} ${result}`.toLowerCase();
  if (/fail|error|denied|restricted|rejected/.test(lowered)) return 'error';
  if (/delet|refund|void|suspend|deactiv/.test(lowered)) return 'warn';
  return 'info';
}

function roleFor(action: string): string {
  const prefix = action.split('.')[0];
  if (prefix === 'member' || prefix === 'trainer' || prefix === 'staff') return prefix;
  // Everything else in the ledger today is an admin-only mutation
  // (payments, promotions, plans, QR destinations, bookings).
  return 'admin';
}

function auditToJson(e: {
  id: string;
  occurredAt: Date;
  actor: string | null;
  action: string;
  target: string | null;
  result: string;
  requestId: string;
}) {
  return {
    id: e.id,
    at: e.occurredAt.toISOString(),
    level: levelFor(e.action, e.result),
    actor: e.actor ?? 'system',
    actorRole: roleFor(e.action),
    action: e.action,
    details: e.target ? `${e.target} (${e.result})` : e.result,
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId) => {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 200, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const [events, total] = await Promise.all([
      tx.auditEvent.findMany({
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.auditEvent.count(),
    ]);

    return NextResponse.json({ entries: events.map(auditToJson), total, limit, offset });
  });
}
