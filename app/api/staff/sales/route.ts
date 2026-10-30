import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { writeAudit } from '@/src/auth/audit';
import { calculatePosPricing, MAX_STAFF_POS_AMOUNT } from '@/src/staff/posPricing';
import { getConfiguredPaymentFee } from '@/src/payments';
import { hasActiveStaffProfile } from '@/src/auth/staff-access';
import { membershipEnd } from '@/src/staff/membership-term';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['staff'], async (tx, requestId) => {
    if (!await hasActiveStaffProfile(tx, authRequestContext.getStore()?.accountId ?? null))
      return apiError(403, 'FORBIDDEN', 'An active staff profile is required.', requestId);
    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Enter the sale details.', requestId); }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return apiError(400, 'INVALID_REQUEST', 'Enter the sale details.', requestId);
    const { reference, memberId, planNames, method, taxRate, taxMode, cashReceived } = body;
    if (typeof reference !== 'string' || !/^PAY-\d{8}-[0-9A-F-]{36}$/.test(reference)
      || typeof memberId !== 'string' || memberId.length > 100
      || !Array.isArray(planNames) || planNames.length < 1 || planNames.length > 10
      || planNames.some((name) => typeof name !== 'string' || !name || name.length > 120)
      || new Set(planNames).size !== planNames.length
      || (method !== 'Cash' && method !== 'GCash')
      || typeof taxRate !== 'string' || (taxMode !== 'exclusive' && taxMode !== 'inclusive'))
      return apiError(400, 'INVALID_REQUEST', 'Enter valid sale details.', requestId);
    if (method === 'Cash' && (typeof cashReceived !== 'number' || !Number.isFinite(cashReceived)
      || cashReceived < 0 || cashReceived > MAX_STAFF_POS_AMOUNT
      || Math.abs(cashReceived - Math.round(cashReceived * 100) / 100) > 1e-8))
      return apiError(400, 'INVALID_CASH', 'Enter the cash amount received.', requestId);
    const actor = authRequestContext.getStore()?.accountId ?? null;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'staff-sale:' + reference}, 0))`;
    const existing = await tx.paymentTransaction.findUnique({ where: { reference },
      include: { items: { include: { membership: true } } } });
    if (existing) {
      const existingPlans = existing.items.map((item) => item.planName).filter((name): name is string => Boolean(name));
      if (existing.cashierAccountId !== actor || existing.isSimulated !== (method === 'GCash') || existing.method !== method
        || existing.memberId !== (memberId || null)
        || existingPlans.length !== planNames.length || existingPlans.some((name) => !planNames.includes(name)))
        return apiError(409, 'SALE_CONFLICT', 'This sale reference is already in use.', requestId);
      const previousMembership = existing.items.find((item) => item.membership)?.membership;
      return NextResponse.json({ membership: previousMembership && {
        memberId: previousMembership.memberId, planName: previousMembership.planName,
        status: previousMembership.status, endsAt: previousMembership.endsAt.toISOString(),
      }, transaction: {
        id: existing.id, transactionReference: existing.reference,
        receiptNumber: existing.receiptNumber ?? undefined, member: existing.customerName,
        type: existing.type, amount: existing.amount.toNumber(), fees: existing.fees.toNumber(),
        method: existing.method, date: new Intl.DateTimeFormat('en-US',
          { timeZone: 'Asia/Manila', month: 'short', day: '2-digit', year: 'numeric' }).format(existing.createdAt),
        status: existing.status, paymentState: existing.paymentState, isSimulated: existing.isSimulated,
      } });
    }
    const plans = await tx.gymPlan.findMany({ where: { name: { in: planNames }, status: 'Active' } });
    if (plans.length !== planNames.length)
      return apiError(409, 'PLAN_UNAVAILABLE', 'A plan in the cart is no longer available.', requestId);
    const selected = planNames.map((name) => plans.find((plan) => plan.name === name)!);
    const isTraining = (name: string) => /pt|personal training|trainer/i.test(name);
    if (selected.filter((plan) => !isTraining(plan.name)).length > 1)
      return apiError(400, 'INVALID_CART', 'Choose only one membership plan per sale.', requestId);
    let customerName = 'Walk-in';
    if (memberId) {
      const member = await tx.memberProfile.findUnique({ where: { profileId: memberId },
        include: { profile: { include: { gymUser: { select: { name: true } } } } } });
      if (!member || member.profile.archivedAt)
        return apiError(404, 'MEMBER_NOT_FOUND', 'Select an active member or a walk-in customer.', requestId);
      customerName = member.profile.gymUser.name ?? 'Member';
    }
    let pricing;
    let fees;
    try {
      pricing = calculatePosPricing(selected.reduce((sum, plan) => sum + plan.price, 0), taxRate, taxMode);
      fees = getConfiguredPaymentFee(method, pricing.total);
    } catch { return apiError(400, 'INVALID_PRICE', 'Check the sale tax and fee settings.', requestId); }
    if (pricing.total + fees > MAX_STAFF_POS_AMOUNT)
      return apiError(400, 'PRICE_LIMIT', 'The POS total cannot exceed ₱10,000,000.', requestId);
    if (method === 'Cash' && Math.round((cashReceived as number) * 100) < Math.round((pricing.total + fees) * 100))
      return apiError(400, 'INSUFFICIENT_CASH', 'Cash received must cover the total.', requestId);
    const now = new Date();
    const membershipPlan = selected.find((plan) => !isTraining(plan.name));
    let membership: { id: string; memberId: string; planName: string; endsAt: Date } | null = null;
    if (method === 'Cash' && memberId && membershipPlan) {
      const current = await tx.membership.findFirst({ where: { memberId }, orderBy: { endsAt: 'desc' } });
      const stillCurrent = current && current.endsAt > now && ['Active', 'Expiring', 'Frozen'].includes(current.status);
      if (stillCurrent && current.planName !== membershipPlan.name)
        return apiError(409, 'PLAN_CHANGE_REQUIRES_REVIEW', 'This member has a different active plan. Ask a manager to review the change.', requestId);
      if (stillCurrent && current.status === 'Frozen')
        return apiError(409, 'MEMBERSHIP_FROZEN', 'A frozen membership must be reviewed before renewal.', requestId);
      const startsAt = stillCurrent ? current.endsAt : now;
      const endsAt = membershipEnd(startsAt, membershipPlan.period);
      if (!endsAt) return apiError(409, 'PLAN_UNAVAILABLE', 'This plan has an unsupported billing period.', requestId);
      const created = await tx.membership.create({ data: {
        memberId, planName: membershipPlan.name, status: 'Active', startsAt, endsAt,
      } });
      membership = { id: created.id, memberId, planName: created.planName, endsAt: created.endsAt };
    }
    const sale = await tx.paymentTransaction.create({ data: {
      reference, receiptNumber: `VA-${reference.slice(4)}`, memberId: memberId || null,
      customerName, cashierAccountId: actor,
      type: `Membership: ${planNames.join(', ')}`, method,
      status: 'Paid', paymentState: 'Successful', isSimulated: method === 'GCash',
      amount: pricing.total, fees, paidAt: now,
      items: { create: [
        ...selected.map((plan) => ({ description: `${plan.name} Membership`, quantity: 1,
          unitPrice: plan.price, total: plan.price, planName: plan.name,
          ...(membership && plan.name === membership.planName ? { membershipId: membership.id } : {}),
        })),
        ...(pricing.configured && taxMode === 'exclusive' && pricing.tax > 0
          ? [{ description: 'VAT / tax', quantity: 1, unitPrice: pricing.tax, total: pricing.tax }] : []),
      ] },
    } });
    await writeAudit(tx, { actor, action: method === 'GCash' ? 'staff.sale-simulated' : 'staff.sale-recorded',
      target: sale.id, result: 'success', requestId });
    return NextResponse.json({ membership: membership && {
      memberId: membership.memberId, planName: membership.planName, status: 'Active', endsAt: membership.endsAt.toISOString(),
    }, transaction: {
      id: sale.id, transactionReference: sale.reference, receiptNumber: sale.receiptNumber ?? undefined,
      member: sale.customerName, type: sale.type, amount: sale.amount.toNumber(), fees: sale.fees.toNumber(),
      method: sale.method, date: new Intl.DateTimeFormat('en-US',
        { timeZone: 'Asia/Manila', month: 'short', day: '2-digit', year: 'numeric' }).format(sale.createdAt),
      status: sale.status, paymentState: sale.paymentState, isSimulated: sale.isSimulated,
    } }, { status: 201 });
  }, { allowPendingSteps: ['accept-terms', 'set-up-two-step-verification',
    'complete-two-step-verification'] });
}
