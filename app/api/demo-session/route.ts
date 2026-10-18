import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDemoAccount,
  createDemoSessionToken,
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_MAX_AGE_SECONDS,
  getDemoAccounts,
  isDemoLoginEnabled,
  readDemoSessionToken,
} from '@/src/auth/demo-session';

export const runtime = 'nodejs';

function disabledResponse() {
  return NextResponse.json({ error: 'Demo accounts are available only in non-production environments.' }, { status: 404 });
}

export async function GET(request: NextRequest) {
  if (!isDemoLoginEnabled()) return disabledResponse();
  const session = readDemoSessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
  if (!session) {
    const response = NextResponse.json({ enabled: true, accounts: getDemoAccounts(), demoSession: null });
    response.cookies.delete(DEMO_SESSION_COOKIE);
    return response;
  }
  return NextResponse.json({
    enabled: true,
    accounts: getDemoAccounts(),
    demoSession: { ...session, roles: [session.role] },
  });
}

export async function POST(request: NextRequest) {
  if (!isDemoLoginEnabled()) return disabledResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object'
    || typeof (body as { email?: unknown }).email !== 'string'
    || typeof (body as { password?: unknown }).password !== 'string') {
    return NextResponse.json({ error: 'Enter a demo email and password.' }, { status: 400 });
  }

  const session = authenticateDemoAccount(
    (body as { email: string }).email,
    (body as { password: string }).password,
  );
  if (!session) {
    return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
  }

  const response = NextResponse.json({ demoSession: { ...session, roles: [session.role] } });
  response.cookies.set(DEMO_SESSION_COOKIE, createDemoSessionToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  if (!isDemoLoginEnabled()) return disabledResponse();
  const response = NextResponse.json({ success: true });
  response.cookies.set(DEMO_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
