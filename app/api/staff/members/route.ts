import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization, apiError } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { writeAudit } from '@/src/auth/audit';
import { normalizeEmail } from '@/src/auth/account';
import { normalizeRegistrationPhone } from '@/src/auth/registration-phone';
import { hasActiveStaffProfile } from '@/src/auth/staff-access';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['staff'], async (tx, requestId) => {
    if (!await hasActiveStaffProfile(tx, authRequestContext.getStore()?.accountId ?? null))
      return apiError(403, 'FORBIDDEN', 'An active staff profile is required.', requestId);
    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Enter the member details.', requestId); }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return apiError(400, 'INVALID_REQUEST', 'Enter the member details.', requestId);
    const { name, email, phone, planName } = body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof phone !== 'string' || typeof planName !== 'string')
      return apiError(400, 'INVALID_REQUEST', 'Enter a name, email, phone, and plan.', requestId);
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = phone.trim() ? normalizeRegistrationPhone(phone) : '';
    if (cleanName.length < 2 || cleanName.length > 120 || cleanEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(cleanEmail)
      || cleanPhone === null || planName.length > 120)
      return apiError(400, 'INVALID_MEMBER', 'Enter a valid name, email, phone, and plan.', requestId);
    const plan = await tx.gymPlan.findUnique({ where: { name: planName } });
    const now = new Date();
    if (!plan || plan.status !== 'Active')
      return apiError(400, 'PLAN_UNAVAILABLE', 'Choose an active membership plan.', requestId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'email:' + cleanEmail}, 0))`;
    const [user, account] = await Promise.all([
      tx.user.findUnique({ where: { email: cleanEmail }, select: { id: true } }),
      tx.authUser.findUnique({ where: { email: cleanEmail }, select: { id: true } }),
    ]);
    if (user || account) return apiError(409, 'MEMBER_EXISTS', 'An account with this email already exists.', requestId);
      const gymUser = await tx.user.create({ data: { name: cleanName, email: cleanEmail, phone: cleanPhone || null } });
      const profile = await tx.roleProfile.create({ data: { gymUserId: gymUser.id, role: 'member' } });
      await tx.memberProfile.create({ data: { profileId: profile.id } });
      await writeAudit(tx, { actor: authRequestContext.getStore()?.accountId ?? null, action: 'staff.member-registered',
        target: profile.id, result: 'success', requestId });
      return NextResponse.json({ member: {
        id: profile.id, name: cleanName, email: cleanEmail, phone: cleanPhone,
        plan: 'No plan', status: 'Expired', joined: new Intl.DateTimeFormat('en-US',
          { timeZone: 'Asia/Manila', month: 'short', day: '2-digit', year: 'numeric' }).format(now),
        membershipValidUntil: null,
      } }, { status: 201 });
  });
}
