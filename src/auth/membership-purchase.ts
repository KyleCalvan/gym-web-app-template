/* Member self-service membership purchase.
 *
 * A member may buy a new membership or renew their current one without a staff
 * member at the desk. Everything that matters is decided here, on the server:
 *
 *   - The price comes from `GymPlan.price` (peso float) and is converted to
 *     integer centavos. The browser never supplies a price.
 *   - The order is always attributed to the caller's own `gymUserId`, so a
 *     member can never record a purchase in someone else's name.
 *   - The membership row is only created when the payment actually succeeded.
 *     There is no path that grants an Active membership without a paid order.
 *   - A renewal extends from the current expiry, not from today, so renewing
 *     early never shortens the term the member already paid for.
 *
 * The whole thing runs inside the caller's `withBusinessAuthorization`
 * transaction, so order + payment + membership + audit commit together or not
 * at all.
 *
 * PAYMENTS: this project has no gateway yet (see docs/backend-explained.md).
 * `Cash` is recorded as Successful immediately, exactly like the staff POS
 * does. `GCash` and `Card` are recorded as Pending and deliberately do NOT
 * activate a membership -- a human has to confirm the money arrived.
 */

import type { Prisma } from '@/backend/generated/prisma/client';

export const MEMBERSHIP_PAYMENT_METHODS = ['Cash', 'GCash', 'Card'] as const;
export type MembershipPaymentMethod = (typeof MEMBERSHIP_PAYMENT_METHODS)[number];

export function isMembershipPaymentMethod(value: unknown): value is MembershipPaymentMethod {
  return typeof value === 'string' && (MEMBERSHIP_PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * `GymPlan.price` is a peso float (e.g. 1500 or 1499.5). Every API money value
 * is an integer number of centavos, so this is the one place the two meet.
 */
export function planPriceCentavos(priceInPesos: number): number {
  if (typeof priceInPesos !== 'number' || !Number.isFinite(priceInPesos)) return 0;
  return Math.round(priceInPesos * 100);
}

const PERIOD_PATTERN = /^(\d+)\s*(day|week|month|year)s?$/i;

/** Add months without letting Jan 31 + 1 month become Mar 3. */
function addMonthsClamped(from: Date, months: number): Date {
  const day = from.getDate();
  const next = new Date(from.getTime());
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

/**
 * `GymPlan.period` is free text ("1 month", "30 days", "1 year"). Anything we
 * cannot parse falls back to one month, matching the admin route's behaviour,
 * so a membership can never end up with no expiry at all.
 */
export function addPlanPeriod(from: Date, period: string | null | undefined): Date {
  const match = PERIOD_PATTERN.exec((period ?? '').trim());
  if (!match) return addMonthsClamped(from, 1);

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return addMonthsClamped(from, 1);

  if (unit === 'day') {
    const next = new Date(from.getTime());
    next.setDate(next.getDate() + amount);
    return next;
  }
  if (unit === 'week') {
    const next = new Date(from.getTime());
    next.setDate(next.getDate() + amount * 7);
    return next;
  }
  if (unit === 'year') {
    const next = new Date(from.getTime());
    next.setFullYear(next.getFullYear() + amount);
    return next;
  }
  return addMonthsClamped(from, amount);
}

export class MembershipPurchaseError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'MembershipPurchaseError';
    this.status = status;
    this.code = code;
  }
}

export interface MembershipPurchaseInput {
  planName: string;
  method: MembershipPaymentMethod;
}

export interface MembershipPurchaseCaller {
  gymUserId: number;
  accountId: string;
  requestId: string;
}

export interface PurchasedMembership {
  id: string;
  planName: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  plan: { name: string; price: number; period: string } | null;
}

export interface MembershipPurchaseResult {
  orderId: string;
  totalAmount: number;
  paymentStatus: 'Successful' | 'Pending';
  /** Present only when the payment succeeded and the membership is live. */
  membership: PurchasedMembership | null;
}

function receiptNumberFor(orderId: string): string {
  const tail = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase();
  return `RCP-${tail || 'MEMBER'}`;
}

export async function purchaseMembership(
  tx: Prisma.TransactionClient,
  caller: MembershipPurchaseCaller,
  input: MembershipPurchaseInput,
): Promise<MembershipPurchaseResult> {
  const plan = await tx.gymPlan.findUnique({ where: { name: input.planName } });
  if (!plan) {
    throw new MembershipPurchaseError(404, 'PLAN_NOT_FOUND', `No membership plan named "${input.planName}".`);
  }
  if (plan.status !== 'Active') {
    throw new MembershipPurchaseError(409, 'PLAN_INACTIVE', `${plan.name} is not currently offered.`);
  }

  const amount = planPriceCentavos(plan.price);
  if (amount <= 0) {
    throw new MembershipPurchaseError(409, 'PLAN_NOT_SELLABLE', `${plan.name} has no price configured.`);
  }

  // One purchase per member at a time: two rapid clicks cannot create two
  // memberships or double-extend the expiry. Released when the tx ends.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'membership:' + caller.gymUserId}, 0))`;

  const now = new Date();
  const current = await tx.membership.findFirst({
    where: { memberId: caller.gymUserId },
    orderBy: { createdAt: 'desc' },
  });

  const stillActive = current !== null && current.status === 'Active' && current.expiresAt.getTime() > now.getTime();
  // Renewing early extends the term already paid for; starting fresh begins today.
  const termStartsAt = stillActive && current ? current.expiresAt : now;
  const expiresAt = addPlanPeriod(termStartsAt, plan.period);

  const order = await tx.order.create({
    data: {
      memberId: caller.gymUserId,
      source: 'MemberCheckout',
      status: 'Pending',
      totalAmount: amount,
      lines: {
        create: [
          {
            itemType: 'membership',
            itemName: plan.name,
            description: `Membership ${plan.name} (${plan.period})`,
            quantity: 1,
            unitPrice: amount,
            totalPrice: amount,
          },
        ],
      },
    },
  });

  const paid = input.method === 'Cash';
  await tx.payment.create({
    data: {
      orderId: order.id,
      method: input.method,
      amount,
      status: paid ? 'Successful' : 'Pending',
      receiptNumber: paid ? receiptNumberFor(order.id) : null,
      confirmedAt: paid ? now : null,
      confirmedBy: paid ? caller.accountId : null,
    },
  });

  if (!paid) {
    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'membership.purchase_pending',
        target: order.id,
        result: 'success',
        requestId: caller.requestId,
      },
    });

    return {
      orderId: order.id,
      totalAmount: amount,
      paymentStatus: 'Pending',
      membership: null,
    };
  }

  await tx.order.update({ where: { id: order.id }, data: { status: 'Paid' } });

  const membership = await tx.membership.create({
    data: {
      memberId: caller.gymUserId,
      planName: plan.name,
      status: 'Active',
      startedAt: now,
      expiresAt,
    },
    include: { plan: { select: { name: true, price: true, period: true } } },
  });

  // `GymPlan.members` counts people currently on the plan, not renewals.
  if (!stillActive) {
    await tx.gymPlan.update({ where: { name: plan.name }, data: { members: { increment: 1 } } });
  }

  await tx.auditEvent.create({
    data: {
      actor: caller.accountId,
      action: stillActive ? 'membership.renewed' : 'membership.purchased',
      target: membership.id,
      result: 'success',
      requestId: caller.requestId,
    },
  });

  return {
    orderId: order.id,
    totalAmount: amount,
    paymentStatus: 'Successful',
    membership: {
      id: membership.id,
      planName: membership.planName,
      status: membership.status,
      startedAt: membership.startedAt.toISOString(),
      expiresAt: membership.expiresAt.toISOString(),
      plan: membership.plan
        ? { name: membership.plan.name, price: membership.plan.price, period: membership.plan.period }
        : null,
    },
  };
}
