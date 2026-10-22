import type { NextRequest } from 'next/server';
import { CURRENT_TERMS_VERSION } from '@/src/auth/account';
import { completeAccount } from '@/src/auth/completion';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return completeAccount(request, 'account.terms-accepted', async (tx, accountId, body) => {
    if (Object.keys(body).sort().join(',') !== 'accepted,version' || body.accepted !== true || typeof body.version !== 'string') {
      return { status: 400, error: 'INVALID_REQUEST', message: 'Explicitly accept the current terms version.' };
    }
    if (body.version !== CURRENT_TERMS_VERSION) {
      return { status: 409, error: 'TERMS_CHANGED', message: 'The terms changed. Read the current version before accepting.' };
    }
    await tx.authUser.update({ where: { id: accountId }, data: {
      termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: new Date(),
    } });
    return null;
  });
}
