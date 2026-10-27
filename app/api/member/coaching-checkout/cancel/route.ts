import { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';
import { cancelCoachingCheckout } from '@/src/paymongo/cancelCoachingCheckout';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const origin = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const session = await readSession(requestSessionToken(request));
  if (!session) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (session.status.restricted || !session.status.roles.includes('member')) {
    return Response.json({ error: 'Member access is required.' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const reference = (body as { reference?: unknown } | null)?.reference;
  if (typeof reference !== 'string' || !/^COACH-[0-9a-f-]{36}$/.test(reference)) {
    return Response.json({ error: 'Invalid checkout reference.' }, { status: 400 });
  }
  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: session.user.id, role: 'member' } },
    include: { profile: { include: { member: true } } },
  });
  const memberId = assignment?.profile.member?.profileId;
  if (!memberId) return Response.json({ error: 'Member profile is unavailable.' }, { status: 404 });
  try {
    const status = await cancelCoachingCheckout(reference, memberId);
    return Response.json({ status });
  } catch (error) {
    console.error('Coaching checkout could not be cancelled:', error);
    return Response.json({ error: 'Checkout could not be cancelled. Please retry.' }, { status: 502 });
  }
}
