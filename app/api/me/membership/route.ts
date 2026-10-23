/* Member self-service membership purchase endpoint.
 *
 * GET  - Returns the caller's current membership (if any)
 * POST - Purchase or renew a membership for the calling member
 *
 * This route is the answer to "a member should be able to buy or renew
 * a membership for themselves." The member's identity is enforced by
 * `withBusinessAuthorization` - the caller's gymUserId is taken from
 * their session, not from any request parameter.
 *
 * See src/auth/membership-purchase.ts for the core purchase logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import {
  purchaseMembership,
  isMembershipPaymentMethod,
  type MembershipPurchaseResult,
  MembershipPurchaseError,
} from '@/src/auth/membership-purchase';

function membershipToJson(m: {
  id: string;
  planName: string;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  plan: { name: string; price: number; period: string } | null;
}) {
  return {
    id: m.id,
    planName: m.planName,
    status: m.status,
    startedAt: m.startedAt.toISOString(),
    expiresAt: m.expiresAt.toISOString(),
    plan: m.plan ? { name: m.plan.name, price: m.plan.price, period: m.plan.period } : null,
  };
}

function purchaseResultToJson(result: MembershipPurchaseResult) {
  return {
    orderId: result.orderId,
    totalAmount: result.totalAmount,
    paymentStatus: result.paymentStatus,
    membership: result.membership
      ? {
          id: result.membership.id,
          planName: result.membership.planName,
          status: result.membership.status,
          startedAt: result.membership.startedAt,
          expiresAt: result.membership.expiresAt,
          plan: result.membership.plan,
        }
      : null,
  };
}

/** GET /api/me/membership - Fetch the caller's current membership */
export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['member'] as GymRole[], async (tx, requestId, caller) => {
    if (!caller.gymUserId) {
      return NextResponse.json({ error: 'Account not linked to gym user.', requestId }, { status: 404 });
    }

    const membership = await tx.membership.findFirst({
      where: { memberId: caller.gymUserId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true, price: true, period: true } } },
    });

    if (!membership) {
      return NextResponse.json({ membership: null });
    }

    return NextResponse.json({ membership: membershipToJson(membership) });
  });
}

/** POST /api/me/membership - Purchase or renew a membership */
export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['member'] as GymRole[], async (tx, requestId, caller) => {
    if (!caller.gymUserId) {
      return NextResponse.json({ error: 'Account not linked to gym user.', requestId }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be an object.', requestId }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    if (typeof input.planName !== 'string' || !input.planName.trim()) {
      return NextResponse.json({ error: 'planName is required and must be a non-empty string.', requestId }, { status: 400 });
    }

    if (!isMembershipPaymentMethod(input.method)) {
      return NextResponse.json({
        error: 'method must be one of: Cash, GCash, Card.',
        requestId,
      }, { status: 400 });
    }

    try {
      const result = await purchaseMembership(tx, {
        gymUserId: caller.gymUserId,
        accountId: caller.accountId,
        requestId,
      }, {
        planName: input.planName.trim(),
        method: input.method,
      });

      return NextResponse.json(purchaseResultToJson(result), { status: 201 });
    } catch (err) {
      if (err instanceof MembershipPurchaseError) {
        return NextResponse.json({ error: err.message, code: err.code, requestId }, { status: err.status });
      }
      throw err;
    }
  });
}
