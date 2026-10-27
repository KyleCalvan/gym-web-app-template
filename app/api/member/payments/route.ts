import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';

export const runtime = 'nodejs';

async function memberProfile(request: NextRequest) {
  const record = await readSession(requestSessionToken(request));
  if (!record) return Response.json({ code: 'UNAUTHENTICATED' }, { status: 401 });
  if (record.status.restricted || !record.status.roles.includes('member')) {
    return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
  }
  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: record.user.id, role: 'member' } },
    include: { profile: { include: { member: true } } },
  });
  return assignment?.profile.member ?? Response.json({ code: 'MEMBER_UNAVAILABLE' }, { status: 404 });
}

export async function GET(request: NextRequest) {
  try {
    const member = await memberProfile(request);
    if (member instanceof Response) return member;
    const payments = await prisma.paymentTransaction.findMany({
      where: { memberId: member.profileId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, reference: true, receiptNumber: true, customerName: true, type: true,
        amount: true, fees: true, paymentState: true, isSimulated: true,
        method: true, status: true, createdAt: true, paidAt: true,
      },
    });
    const dateFormatter = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila', dateStyle: 'medium',
    });
    return Response.json({
      preferredPaymentMethod: member.preferredPaymentMethod,
      transactions: payments.map(payment => ({
        id: payment.id, transactionReference: payment.reference,
        receiptNumber: payment.receiptNumber ?? undefined,
        member: payment.customerName, type: payment.type,
        // PaymentTransaction.amount includes fees; the existing receipt component adds fees separately.
        amount: Number(payment.amount) - Number(payment.fees), fees: Number(payment.fees),
        paymentState: payment.paymentState, isSimulated: payment.isSimulated,
        method: payment.method, status: payment.status,
        date: dateFormatter.format(payment.paidAt ?? payment.createdAt),
      })),
    });
  } catch {
    return Response.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const allowedOrigin = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== allowedOrigin) {
    return Response.json({ code: 'INVALID_ORIGIN' }, { status: 403 });
  }
  try {
    const member = await memberProfile(request);
    if (member instanceof Response) return member;
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ code: 'INVALID_REQUEST' }, { status: 400 }); }
    const method = (body as { preferredPaymentMethod?: unknown } | null)?.preferredPaymentMethod;
    if (method !== 'GCash' && method !== 'Cash') {
      return Response.json({ code: 'INVALID_PAYMENT_METHOD' }, { status: 400 });
    }
    const updated = await prisma.memberProfile.update({
      where: { profileId: member.profileId }, data: { preferredPaymentMethod: method },
      select: { preferredPaymentMethod: true },
    });
    return Response.json(updated);
  } catch {
    return Response.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}
