import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { writeAudit } from '@/src/auth/audit';
import { normalizeEmail } from '@/src/auth/account';
import { normalizeRegistrationPhone } from '@/src/auth/registration-phone';
import { hasActiveStaffProfile } from '@/src/auth/staff-access';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest) {
  return withBusinessAuthorization(request, ['staff'], async (tx, requestId) => {
    if (!await hasActiveStaffProfile(tx, authRequestContext.getStore()?.accountId ?? null))
      return apiError(403, 'FORBIDDEN', 'An active staff profile is required.', requestId);
    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Enter your profile details.', requestId); }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return apiError(400, 'INVALID_REQUEST', 'Enter your profile details.', requestId);
    const { name, email, phone, phoneSecondary, avatarUrl } = body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof phone !== 'string'
      || typeof phoneSecondary !== 'string' || (avatarUrl !== undefined && typeof avatarUrl !== 'string'))
      return apiError(400, 'INVALID_REQUEST', 'Enter your profile details.', requestId);
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const cleanPhone = phone.trim() ? normalizeRegistrationPhone(phone) : '';
    const cleanSecondary = phoneSecondary.trim() ? normalizeRegistrationPhone(phoneSecondary) : '';
    if (cleanName.length < 2 || cleanName.length > 120 || cleanPhone === null || cleanSecondary === null)
      return apiError(400, 'INVALID_PROFILE', 'Enter a valid name and phone numbers.', requestId);
    if (avatarUrl && (avatarUrl.length > 2_100_000 || !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatarUrl)))
      return apiError(400, 'INVALID_IMAGE', 'Choose a PNG, JPEG, WebP, or GIF image under 1.5 MB.', requestId);
    const accountId = authRequestContext.getStore()?.accountId;
    if (!accountId) return apiError(401, 'UNAUTHENTICATED', 'Sign in to update your profile.', requestId);
    const account = await tx.authUser.findUniqueOrThrow({ where: { id: accountId } });
    if (!account.gymUserId) return apiError(409, 'PROFILE_UNAVAILABLE', 'Your staff profile is unavailable.', requestId);
    if (normalizeEmail(email) !== normalizeEmail(account.email ?? ''))
      return apiError(409, 'EMAIL_CHANGE_REQUIRES_VERIFICATION', 'Email changes require verification. Contact the gym to update your sign-in email.', requestId);
    const gymUser = await tx.user.update({ where: { id: account.gymUserId }, data: {
      name: cleanName, phone: cleanPhone || null, phoneSecondary: cleanSecondary || null,
      ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
    } });
    await tx.authUser.update({ where: { id: accountId }, data: { name: cleanName, phone: cleanPhone || null } });
    await writeAudit(tx, { actor: accountId, action: 'staff.profile-updated', target: accountId, result: 'success', requestId });
    return NextResponse.json({ profile: { name: cleanName, email: account.email,
      phone: cleanPhone, phoneSecondary: cleanSecondary, avatarUrl: gymUser.avatarUrl ?? undefined } });
  });
}
