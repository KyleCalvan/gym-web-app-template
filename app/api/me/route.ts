import { randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/auth/options';
import { getAccountStatus } from '@/src/auth/account';

export const runtime = 'nodejs';

export async function GET() {
  const requestId = randomUUID();
  const headers = { 'cache-control': 'private, no-store', 'x-request-id': requestId };
  try {
    const session = await getServerSession(authOptions);
    const status = session?.user?.id ? await getAccountStatus(session.user.id) : null;
    if (!status) return Response.json({ code: 'UNAUTHENTICATED', message: 'Sign in to view your Account.', requestId }, { status: 401, headers });
    const { roles, profiles, ...limited } = status;
    return Response.json(status.restricted ? limited : { ...limited, roles, profiles }, { headers });
  } catch {
    return Response.json({ code: 'UNAVAILABLE', message: 'Account status is temporarily unavailable.', requestId }, { status: 503, headers });
  }
}
