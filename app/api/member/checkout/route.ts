import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';
import { createCheckout } from '@/src/paymongo/checkout';
import { hasActiveMembership } from '@/src/member/activeMembership';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const allowedOrigin = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== allowedOrigin) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const session = await readSession(requestSessionToken(request));
  if (!session) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (session.status.restricted || !session.status.roles.includes('member')) {
    return Response.json({ error: 'Member access is required.' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const planName = (body as { planName?: unknown } | null)?.planName;
  if (typeof planName !== 'string' || !planName.trim() || planName.length > 120) {
    return Response.json({ error: 'Choose a valid plan.' }, { status: 400 });
  }
  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: session.user.id, role: 'member' } },
    include: { profile: { include: { member: true } } },
  });
  const memberId = assignment?.profile.member?.profileId;
  if (!memberId) return Response.json({ error: 'Member profile is unavailable.' }, { status: 404 });
  const email = session.user.email;
  if (!email) return Response.json({ error: 'An email address is required for checkout.' }, { status: 400 });
  const plan = await prisma.gymPlan.findUnique({ where: { name: planName } });
  const cents = plan ? Math.round(plan.price * 100) : 0;
  if (!plan || plan.status !== 'Active' || !Number.isSafeInteger(cents) || cents < 100) {
    return Response.json({ error: 'This plan is unavailable for checkout.' }, { status: 400 });
  }
  const currentMembership = await prisma.membership.findFirst({ where: { memberId },
    orderBy: { createdAt: 'desc' }, select: { planName: true, status: true, endsAt: true, cancelledAt: true } });
  if (currentMembership?.status === 'Frozen') {
    return Response.json({ error: 'Your membership is frozen. Contact the gym before changing plans.' }, { status: 409 });
  }
  if (hasActiveMembership(currentMembership) && currentMembership?.cancelledAt) {
    return Response.json({ error: 'Your current plan is cancelled and remains active through the paid term.' }, { status: 409 });
  }
  if (hasActiveMembership(currentMembership) && currentMembership?.planName !== plan.name) {
    return Response.json({ error: 'You already have an active plan. Choose another plan after it ends.' }, { status: 409 });
  }
  if (plan.category === 'Student') {
    const verification = await prisma.studentVerification.findFirst({ where: { memberId },
      orderBy: { submittedAt: 'desc' }, select: { status: true } });
    if (verification?.status !== 'Verified') {
      return Response.json({ error: 'Student verification is required before checkout.' }, { status: 409 });
    }
  }
  if (!process.env.PAYMONGO_SECRET_KEY?.trim().startsWith('sk_test_')) {
    return Response.json({ error: 'PayMongo test checkout is not configured yet.' }, { status: 503 });
  }
  const reference = `MEM-${randomUUID()}`;
  const transaction = await prisma.paymentTransaction.create({ data: {
    reference, memberId, customerName: session.user.name || email,
    type: `Membership (${plan.name})`, method: 'GCash', amount: cents / 100,
    status: 'Pending', paymentState: 'Pending',
    items: { create: { description: `${plan.name} membership`, quantity: 1,
      unitPrice: cents / 100, total: cents / 100, planName: plan.name } },
  } });
  try {
    const checkout = await createCheckout({ reference, planName: plan.name, amountCentavos: cents,
      email, name: transaction.customerName });
    await prisma.paymentTransaction.update({ where: { id: transaction.id },
      data: { paymongoCheckoutId: checkout.id } });
    return Response.json({ checkoutUrl: checkout.url });
  } catch (error) {
    console.error('PayMongo test checkout could not start:', error);
    await prisma.paymentTransaction.update({ where: { id: transaction.id },
      data: { status: 'Failed', paymentState: 'Failed' } });
    return Response.json({ error: 'Checkout could not start. Please try again.' }, { status: 502 });
  }
}
