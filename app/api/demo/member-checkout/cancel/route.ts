import { NextRequest } from 'next/server';
import { DEMO_SESSION_COOKIE, isDemoLoginEnabled, readDemoSessionToken } from '@/src/auth/demo-session';
import { cancelDemoCheckout } from '@/src/paymongo/demoCheckout';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isDemoLoginEnabled()) return Response.json({ error: 'Demo checkout is unavailable.' }, { status: 404 });
  const origin = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const session = readDemoSessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
  if (session?.role !== 'member') return Response.json({ error: 'Member demo access is required.' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const reference = (body as { reference?: unknown } | null)?.reference;
  if (typeof reference !== 'string' || !/^DEMO-[0-9a-f-]{36}$/.test(reference)) {
    return Response.json({ error: 'Invalid checkout reference.' }, { status: 400 });
  }
  try { return Response.json({ status: await cancelDemoCheckout(reference, session.name) }); }
  catch (error) {
    console.error('PayMongo demo checkout could not be cancelled:', error);
    return Response.json({ error: 'Checkout could not be cancelled. Please retry.' }, { status: 502 });
  }
}
