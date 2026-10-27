import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { writeAudit } from '@/src/auth/audit';
import { hasActiveStaffProfile } from '@/src/auth/staff-access';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest) {
  return withBusinessAuthorization(request, ['staff'], async (tx, requestId) => {
    if (!await hasActiveStaffProfile(tx, authRequestContext.getStore()?.accountId ?? null))
      return apiError(403, 'FORBIDDEN', 'An active staff profile is required.', requestId);
    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Choose a profile photo.', requestId); }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return apiError(400, 'INVALID_REQUEST', 'Choose a profile photo.', requestId);
    if (Object.keys(body).some((key) => key !== 'avatarUrl'))
      return apiError(403, 'PROFILE_READ_ONLY', 'Staff profile details are managed by an administrator.', requestId);
    const { avatarUrl } = body;
    if (typeof avatarUrl !== 'string' || avatarUrl.length > 2_100_000
      || !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatarUrl))
      return apiError(400, 'INVALID_IMAGE', 'Choose a PNG, JPEG, WebP, or GIF image under 1.5 MB.', requestId);
    const accountId = authRequestContext.getStore()?.accountId;
    if (!accountId) return apiError(401, 'UNAUTHENTICATED', 'Sign in to update your photo.', requestId);
    const account = await tx.authUser.findUniqueOrThrow({ where: { id: accountId } });
    if (!account.gymUserId) return apiError(409, 'PROFILE_UNAVAILABLE', 'Your staff profile is unavailable.', requestId);
    const gymUser = await tx.user.update({ where: { id: account.gymUserId }, data: { avatarUrl } });
    await writeAudit(tx, { actor: accountId, action: 'staff.photo-updated', target: accountId, result: 'success', requestId });
    return NextResponse.json({ profile: { avatarUrl: gymUser.avatarUrl ?? undefined } });
  });
}
