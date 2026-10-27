import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { authRequestContext } from '@/src/auth/request-context';
import { accountProjection, completeAccount } from '@/src/auth/completion';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const headers = { 'cache-control': 'private, no-store', 'x-request-id': requestId };
  try {
    const status = (await authRequestContext.run({ requestId, accountId: null },
      () => readSession(requestSessionToken(request))))?.status;
    if (!status) return Response.json({ code: 'UNAUTHENTICATED', message: 'Sign in to view your Account.', requestId }, { status: 401, headers });
    return Response.json(accountProjection(status), { headers });
  } catch {
    return Response.json({ code: 'UNAVAILABLE', message: 'Account status is temporarily unavailable.', requestId }, { status: 503, headers });
  }
}

export async function PATCH(request: NextRequest) {
  return completeAccount(request, 'account.profile-completed', async (tx, accountId, body) => {
    const keys = Object.keys(body).sort().join(',');
    if (!['name,phone', 'emergencyContact,name,phone'].includes(keys)
      || typeof body.name !== 'string' || typeof body.phone !== 'string'
      || (keys.includes('emergencyContact') && typeof body.emergencyContact !== 'string')) {
      return { status: 400, error: 'INVALID_REQUEST', message: 'Provide your full name, contact phone, and optional emergency contact.' };
    }
    const name = body.name.trim().replace(/\s+/g, ' ');
    const phone = body.phone.trim();
    const emergencyContact = typeof body.emergencyContact === 'string' ? body.emergencyContact.trim() : undefined;
    if (name.length < 2 || name.length > 120 || phone.length > 25
      || !/^[+\d()\s.-]+$/.test(phone) || (phone.match(/\d/g)?.length ?? 0) < 7) {
      return { status: 400, error: 'INVALID_PROFILE', message: 'Enter a full name and a valid contact phone.' };
    }
    if (emergencyContact !== undefined && (emergencyContact.length > 25
      || (emergencyContact.length > 0 && (!/^[+\d()\s.-]+$/.test(emergencyContact)
        || (emergencyContact.match(/\d/g)?.length ?? 0) < 7)))) {
      return { status: 400, error: 'INVALID_PROFILE', message: 'Enter a valid emergency contact phone or leave it blank.' };
    }
    const account = await tx.authUser.update({ where: { id: accountId }, data: { name, phone } });
    if (account.gymUserId !== null) await tx.user.update({ where: { id: account.gymUserId }, data: { name, phone } });
    if (emergencyContact !== undefined) {
      const assignment = await tx.assignedRole.findUnique({ where: { accountId_role: { accountId, role: 'member' } }, select: { profileId: true } });
      if (assignment) await tx.memberProfile.update({ where: { profileId: assignment.profileId }, data: { emergencyContact: emergencyContact || null } });
    }
    return null;
  });
}
