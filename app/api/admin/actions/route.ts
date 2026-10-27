import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/backend/generated/prisma/client';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { normalizeEmail } from '@/src/auth/account';
import { normalizeRegistrationPhone } from '@/src/auth/registration-phone';
import { validateQrDestination } from '@/src/qrDestinations';
import { getConfiguredPaymentFee } from '@/src/payments';
import { membershipEnd } from '@/src/staff/membership-term';

export const runtime = 'nodejs';

class InvalidInput extends Error {}
const required = (value: unknown, label: string, max = 120) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new InvalidInput(`Enter a valid ${label}.`);
  return value.trim();
};
const optional = (value: unknown, max = 500) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw new InvalidInput('A field is too long.');
  return value.trim();
};
const choice = <T extends string>(value: unknown, values: readonly T[], label: string): T => {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new InvalidInput(`Choose a valid ${label}.`);
  return value as T;
};
const money = (value: unknown, label: string) => {
  const number = Number(value);
  if (value === '' || value === null || !Number.isFinite(number) || number < 0 || number > 10_000_000)
    throw new InvalidInput(`Enter a valid ${label}.`);
  return Math.round(number * 100) / 100;
};
const date = (value: unknown, label: string) => {
  const text = required(value, label, 30);
  const result = new Date(text);
  if (Number.isNaN(result.getTime())) throw new InvalidInput(`Enter a valid ${label}.`);
  return result;
};
const phone = (value: unknown) => {
  const text = optional(value, 30);
  const normalized = text ? normalizeRegistrationPhone(text) : '';
  if (normalized === null) throw new InvalidInput('Enter a valid phone number.');
  return normalized || null;
};
const email = (value: unknown) => {
  const normalized = normalizeEmail(required(value, 'email', 254));
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new InvalidInput('Enter a valid email.');
  return normalized;
};

async function audit(tx: Prisma.TransactionClient, action: string, target: string) {
  await tx.auditEvent.create({ data: { actor: authRequestContext.getStore()?.accountId ?? null,
    actorRole: 'admin', action, target, result: 'success', requestId: authRequestContext.getStore()?.requestId ?? randomUUID() } });
}

async function apply(tx: Prisma.TransactionClient, action: string, input: Record<string, unknown>) {
  if (action === 'member.create') {
    const cleanEmail = email(input.email);
    const name = required(input.name, 'name');
    const cleanPhone = phone(input.phone);
    if (await tx.user.findUnique({ where: { email: cleanEmail } })
      || await tx.authUser.findUnique({ where: { email: cleanEmail } }))
      throw new InvalidInput('An account with this email already exists.');
    const user = await tx.user.create({ data: { email: cleanEmail, name, phone: cleanPhone } });
    const profile = await tx.roleProfile.create({ data: { gymUserId: user.id, role: 'member' } });
    await tx.memberProfile.create({ data: { profileId: profile.id } });
    await audit(tx, action, profile.id);
    return;
  }
  if (action === 'member.update') {
    const id = required(input.id, 'member ID');
    const profile = await tx.memberProfile.findUnique({ where: { profileId: id }, include: { profile: { include: { gymUser: true } } } });
    if (!profile) throw new InvalidInput('Member not found.');
    if (email(input.email) !== profile.profile.gymUser.email) throw new InvalidInput('Email changes require account verification.');
    await tx.user.update({ where: { id: profile.profile.gymUserId }, data: { name: required(input.name, 'name'), phone: phone(input.phone) } });
    await audit(tx, action, id);
    return;
  }
  if (['member.freeze', 'member.unfreeze'].includes(action)) {
    const id = required(input.id, 'member ID');
    const membership = await tx.membership.findFirst({ where: { memberId: id }, orderBy: { endsAt: 'desc' } });
    if (!membership) throw new InvalidInput('This member has no membership to change.');
    if (membership.endsAt <= new Date()) throw new InvalidInput('An expired membership cannot be frozen or restored.');
    if (action === 'member.freeze' && !['Active', 'Expiring'].includes(membership.status))
      throw new InvalidInput('Only an active membership can be frozen.');
    if (action === 'member.unfreeze' && membership.status !== 'Frozen')
      throw new InvalidInput('Only a frozen membership can be restored.');
    await tx.membership.update({ where: { id: membership.id }, data: action === 'member.freeze'
      ? { status: 'Frozen', frozenAt: new Date() } : { status: 'Active', frozenAt: null } });
    await audit(tx, action, id);
    return;
  }
  if (['member.archive', 'trainer.archive', 'staff.archive'].includes(action)) {
    const id = required(input.id, 'profile ID');
    const role = action.split('.')[0] as 'member' | 'trainer' | 'staff';
    const profile = await tx.roleProfile.findUnique({ where: { id } });
    if (!profile || profile.role !== role) throw new InvalidInput('Profile not found.');
    await tx.roleProfile.update({ where: { id }, data: { archivedAt: new Date(), status: 'Inactive' } });
    await audit(tx, action, id);
    return;
  }
  if (action === 'trainer.create' || action === 'staff.create') {
    const role = action.startsWith('trainer') ? 'trainer' : 'staff';
    const name = required(input.name, 'name');
    const cleanEmail = role === 'staff' ? email(input.email) : `trainer-${randomUUID()}@vinathletics.invalid`;
    const cleanPhone = phone(input.phone);
    const trainerData = role === 'trainer' ? { specialty: optional(input.specialty, 120),
      certifications: optional(input.certs, 500), sessionPrice: money(input.sessionPrice, 'session price') } : null;
    const staffData = role === 'staff' ? { jobRole: choice(input.role, ['Front Desk', 'Sales', 'Manager'] as const, 'job role'),
      shift: choice(input.shift, ['Morning', 'Evening', 'Night'] as const, 'shift') } : null;
    if (await tx.user.findUnique({ where: { email: cleanEmail } })
      || await tx.authUser.findUnique({ where: { email: cleanEmail } }))
      throw new InvalidInput('This email is already in use.');
    const user = await tx.user.create({ data: { email: cleanEmail, name, phone: cleanPhone } });
    const profile = await tx.roleProfile.create({ data: { gymUserId: user.id, role,
      status: input.status === 'Inactive' ? 'Inactive' : 'Active' } });
    if (trainerData) await tx.trainerProfile.create({ data: { profileId: profile.id, ...trainerData } });
    else await tx.staffProfile.create({ data: { profileId: profile.id,
      jobRole: staffData!.jobRole === 'Front Desk' ? 'FrontDesk' : staffData!.jobRole,
      shift: staffData!.shift } });
    await audit(tx, action, profile.id);
    return;
  }
  if (action === 'trainer.update' || action === 'staff.update') {
    const id = required(input.id, 'profile ID');
    const role = action.startsWith('trainer') ? 'trainer' : 'staff';
    const profile = await tx.roleProfile.findUnique({ where: { id }, include: { gymUser: true } });
    if (!profile || profile.role !== role) throw new InvalidInput('Profile not found.');
    if (role === 'staff' && email(input.email) !== profile.gymUser.email)
      throw new InvalidInput('Staff email changes require identity verification.');
    const name = required(input.name, 'name');
    const cleanPhone = role === 'staff' ? phone(input.phone) : null;
    const trainerData = role === 'trainer' ? { specialty: optional(input.specialty, 120),
      certifications: optional(input.certs, 500), sessionPrice: money(input.sessionPrice, 'session price') } : null;
    const staffData = role === 'staff' ? { jobRole: choice(input.role, ['Front Desk', 'Sales', 'Manager'] as const, 'job role'),
      shift: choice(input.shift, ['Morning', 'Evening', 'Night'] as const, 'shift') } : null;
    await tx.user.update({ where: { id: profile.gymUserId }, data: { name,
      ...(role === 'staff' ? { phone: cleanPhone } : {}) } });
    await tx.roleProfile.update({ where: { id }, data: { status: input.status === 'Active' ? 'Active' : 'Inactive' } });
    if (trainerData) await tx.trainerProfile.update({ where: { profileId: id }, data: trainerData });
    else await tx.staffProfile.update({ where: { profileId: id }, data: {
      jobRole: staffData!.jobRole === 'Front Desk' ? 'FrontDesk' : staffData!.jobRole,
      shift: staffData!.shift } });
    await audit(tx, action, id);
    return;
  }
  if (action === 'session.assign') {
    const trainerId = required(input.trainerId, 'trainer');
    const memberId = required(input.memberId, 'member');
    const [trainer, member] = await Promise.all([
      tx.trainerProfile.findUnique({ where: { profileId: trainerId } }),
      tx.memberProfile.findUnique({ where: { profileId: memberId } }),
    ]);
    if (!trainer || !member) throw new InvalidInput('Choose an existing trainer and member.');
    const session = await tx.coachingSession.create({ data: { trainerId, memberId,
      startsAt: date(input.dateTime, 'session date'), type: 'Custom', status: 'Pending', amount: trainer.sessionPrice } });
    await audit(tx, action, session.id);
    return;
  }
  if (action === 'renewal.simulate') {
    const memberId = required(input.memberId, 'member ID');
    const planName = required(input.planName, 'plan');
    const method = choice(input.method, ['Cash', 'GCash'] as const, 'payment method');
    const outcome = choice(input.outcome, ['Successful', 'Failed'] as const, 'test outcome');
    const [member, plan] = await Promise.all([
      tx.memberProfile.findUnique({ where: { profileId: memberId }, include: { profile: { include: { gymUser: true } } } }),
      tx.gymPlan.findUnique({ where: { name: planName } }),
    ]);
    if (!member || !plan || plan.status !== 'Active') throw new InvalidInput('Choose an active member and plan.');
    const fees = getConfiguredPaymentFee(method, plan.price);
    const now = new Date();
    let membershipId: string | null = null;
    if (outcome === 'Successful') {
      const previous = await tx.membership.findFirst({ where: { memberId }, orderBy: { endsAt: 'desc' } });
      if (previous?.status === 'Frozen') throw new InvalidInput('A frozen membership cannot be renewed.');
      const startsAt = previous && previous.endsAt > now && previous.status === 'Active' ? previous.endsAt : now;
      const endsAt = membershipEnd(startsAt, plan.period);
      if (!endsAt) throw new InvalidInput('This plan has an unsupported billing period.');
      const membership = await tx.membership.create({ data: { memberId, planName, startsAt, endsAt, status: 'Active' } });
      membershipId = membership.id;
    }
    const reference = `SIM-${randomUUID()}`;
    const sale = await tx.paymentTransaction.create({ data: { reference, memberId,
      customerName: member.profile.gymUser.name ?? 'Member', cashierAccountId: authRequestContext.getStore()?.accountId,
      type: `Membership Renewal (${planName})`, method, amount: plan.price,
      fees, isSimulated: true,
      status: outcome === 'Successful' ? 'Paid' : 'Failed', paymentState: outcome,
      paidAt: outcome === 'Successful' ? now : null,
      items: { create: [{ description: `${planName} Membership`, quantity: 1, unitPrice: plan.price,
        total: plan.price, planName, ...(membershipId ? { membershipId } : {}) }] } } });
    await audit(tx, action, sale.id);
    return;
  }
  if (action === 'payment.refund') {
    const id = required(input.id, 'transaction ID');
    const transaction = await tx.paymentTransaction.findUnique({ where: { id } });
    if (!transaction || transaction.status !== 'Paid') throw new InvalidInput('Only a paid transaction can be refunded.');
    if (!transaction.isSimulated) throw new InvalidInput('A real refund must be completed through its payment method before recording it here.');
    await tx.paymentTransaction.update({ where: { id }, data: { status: 'Refunded', refundedAt: new Date(),
      refundReason: required(input.reason, 'refund reason', 500) } });
    await audit(tx, action, id);
    return;
  }
  if (action === 'promotion.create' || action === 'promotion.update') {
    const id = action.endsWith('update') ? required(input.id, 'promotion ID') : null;
    const validFrom = date(input.validFrom, 'start date');
    const validUntil = date(input.validUntil, 'end date');
    if (validUntil < validFrom) throw new InvalidInput('The end date must be on or after the start date.');
    const plan = optional(input.plan, 120);
    if (plan && plan !== 'Any Plan' && !await tx.gymPlan.findUnique({ where: { name: plan } }))
      throw new InvalidInput('Choose an existing plan.');
    const promotionCode = required(input.code, 'code', 60).toUpperCase();
    const codeOwner = await tx.promotion.findUnique({ where: { code: promotionCode }, select: { id: true } });
    if (codeOwner && codeOwner.id !== id) throw new InvalidInput('This promotion code is already in use.');
    const data = { title: required(input.title, 'title'), code: promotionCode,
      discountType: choice(input.discountType, ['Percentage', 'Fixed', 'Bundle'] as const, 'discount type'),
      discount: required(input.discount, 'discount', 120), validFrom, validUntil,
      planName: !plan || plan === 'Any Plan' ? null : plan,
      imageUrl: optional(input.imageUrl, 2100000) || null,
      description: optional(input.description, 2000) || null,
      maxRedemptions: Number(input.maxRedemptions) || 0, minSpend: money(input.minSpend ?? 0, 'minimum spend') };
    if (!Number.isSafeInteger(data.maxRedemptions) || data.maxRedemptions < 0) throw new InvalidInput('Enter a valid redemption limit.');
    const promotion = id
      ? await tx.promotion.update({ where: { id }, data })
      : await tx.promotion.create({ data: { id: randomUUID(), ...data, status: 'Draft' } });
    await audit(tx, action, promotion.id);
    return;
  }
  if (action === 'promotion.publish' || action === 'promotion.delete') {
    const id = required(input.id, 'promotion ID');
    const current = await tx.promotion.findUnique({ where: { id } });
    if (!current || current.deletedAt) throw new InvalidInput('Promotion not found.');
    await tx.promotion.update({ where: { id }, data: action.endsWith('delete')
      ? { deletedAt: new Date(), status: 'Draft' }
      : { status: current.status === 'Published' ? 'Draft' : 'Published' } });
    await audit(tx, action, id);
    return;
  }
  if (action === 'qr.save') {
    if (!Array.isArray(input.destinations) || input.destinations.length > 20) throw new InvalidInput('Enter valid QR destinations.');
    const destinations = input.destinations.map((value, index) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidInput('Enter valid QR destinations.');
      const row = value as Record<string, unknown>;
      const id = required(row.id, 'destination ID', 120);
      const label = required(row.label, 'destination label', 120);
      const url = required(row.url, 'destination URL', 2048);
      const error = validateQrDestination({ id, label, url });
      if (error) throw new InvalidInput(`${label}: ${error}`);
      return { id, label, url, sortOrder: index };
    });
    if (!destinations.some((row) => row.id === 'facebook')) throw new InvalidInput('A verified Facebook destination is required.');
    await tx.gymQrDestination.deleteMany({ where: { id: { notIn: destinations.map((row) => row.id) } } });
    for (const row of destinations) await tx.gymQrDestination.upsert({ where: { id: row.id }, create: row, update: row });
    await audit(tx, action, 'gym-qr-destinations');
    return;
  }
  if (action === 'profile.update') {
    const accountId = authRequestContext.getStore()?.accountId;
    if (!accountId) throw new InvalidInput('Sign in to update your profile.');
    const account = await tx.authUser.findUniqueOrThrow({ where: { id: accountId } });
    if (!account.gymUserId || email(input.email) !== account.email) throw new InvalidInput('Email changes require identity verification.');
    const avatarUrl = input.avatarUrl === undefined ? undefined : optional(input.avatarUrl, 2100000);
    if (avatarUrl && !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatarUrl))
      throw new InvalidInput('Choose a valid image.');
    const name = required(input.name, 'name');
    const cleanPhone = phone(input.phone);
    await tx.user.update({ where: { id: account.gymUserId }, data: { name, phone: cleanPhone,
      phoneSecondary: phone(input.phoneSecondary), ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}) } });
    await tx.authUser.update({ where: { id: accountId }, data: { name, phone: cleanPhone } });
    await audit(tx, action, accountId);
    return;
  }
  throw new InvalidInput('This manager action is unavailable.');
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin'], async (tx, requestId) => {
    let body: { action?: unknown; payload?: unknown };
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Enter the manager change.', requestId); }
    if (!body || typeof body.action !== 'string' || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload))
      return apiError(400, 'INVALID_REQUEST', 'Enter the manager change.', requestId);
    const accountId = authRequestContext.getStore()?.accountId;
    const active = accountId && await tx.assignedRole.findFirst({ where: { accountId, role: 'admin',
      profile: { archivedAt: null, status: 'Active' } } });
    if (!active) return apiError(403, 'FORBIDDEN', 'An active manager profile is required.', requestId);
    try {
      await apply(tx, body.action, body.payload as Record<string, unknown>);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof InvalidInput) return apiError(400, 'INVALID_INPUT', error.message, requestId);
      throw error;
    }
  });
}
