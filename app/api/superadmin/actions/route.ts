import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { normalizeEmail } from '@/src/auth/account';
import { normalizeRegistrationPhone } from '@/src/auth/registration-phone';
import { lookupSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';

export const runtime = 'nodejs';

const kinds = ['admin', 'member', 'trainer', 'staff'] as const;
type Kind = typeof kinds[number];
const validKind = (value: unknown): value is Kind => kinds.includes(value as Kind);
const text = (value: unknown, max = 120) => typeof value === 'string' && value.trim().length > 0
  && value.trim().length <= max ? value.trim() : null;
const optional = (value: unknown, max = 500) => value == null || value === '' ? ''
  : typeof value === 'string' && value.length <= max ? value.trim() : null;
const jobRole = (value: unknown) => value === 'Front Desk' ? 'FrontDesk' as const
  : value === 'Sales' ? 'Sales' as const : value === 'Manager' ? 'Manager' as const : null;
const shift = (value: unknown) => value === 'Morning' ? 'Morning' as const
  : value === 'Evening' ? 'Evening' as const : value === 'Night' ? 'Night' as const : null;

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['superadmin'], async (tx, requestId) => {
    const accountId = authRequestContext.getStore()?.accountId;
    const assignment = accountId && await tx.assignedRole.findFirst({ where: { accountId, role: 'superadmin',
      profile: { archivedAt: null, status: 'Active' } } });
    if (!assignment) return apiError(403, 'FORBIDDEN', 'An active super admin profile is required.', requestId);
    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Enter a valid change.', requestId); }
    if (!body || typeof body.action !== 'string') return apiError(400, 'INVALID_REQUEST', 'Enter a valid change.', requestId);
    const fail = (message: string) => apiError(400, 'INVALID_INPUT', message, requestId);
    const action = body.action;
    if (action === 'session.terminate' || action === 'session.terminate-others') {
      const current = await lookupSession(tx, requestSessionToken(request));
      const currentId = current?.session.id;
      if (!currentId || current.user.id !== accountId) return fail('Current session could not be confirmed.');
      if (action === 'session.terminate') {
        const id = text(body.id, 120);
        if (!id || id === currentId) return fail('Choose another session.');
        await tx.authSession.deleteMany({ where: { id, expires: { gt: new Date() } } });
      } else await tx.authSession.deleteMany({ where: { id: { not: currentId }, expires: { gt: new Date() } } });
    } else if (action === 'profile.update') {
      const account = await tx.authUser.findUnique({ where: { id: accountId! } });
      const name = text(body.name);
      const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
      const phone = optional(body.phone, 30);
      const phoneSecondary = optional(body.phoneSecondary, 30);
      if (!account?.gymUserId || !name || email !== account.email || phone === null || phoneSecondary === null
        || (phone && normalizeRegistrationPhone(phone) === null)
        || (phoneSecondary && normalizeRegistrationPhone(phoneSecondary) === null))
        return fail('Enter valid profile details. Email changes require verification.');
      const avatarUrl = body.avatarUrl;
      if (avatarUrl !== undefined && (typeof avatarUrl !== 'string' || avatarUrl.length > 2_100_000
        || !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatarUrl))) return fail('Choose a valid photo.');
      await tx.user.update({ where: { id: account.gymUserId }, data: { name,
        phone: phone ? normalizeRegistrationPhone(phone) : null,
        phoneSecondary: phoneSecondary ? normalizeRegistrationPhone(phoneSecondary) : null,
        ...(avatarUrl ? { avatarUrl } : {}) } });
      await tx.authUser.update({ where: { id: account.id }, data: { name,
        phone: phone ? normalizeRegistrationPhone(phone) : null } });
    } else if (['user.archive', 'user.restore', 'user.update'].includes(action)) {
      if (!validKind(body.kind)) return fail('Choose a valid role.');
      const id = text(body.id, 120);
      const profile = id && await tx.roleProfile.findFirst({ where: { id, role: body.kind }, include: { gymUser: true } });
      if (!profile) return fail('User profile not found.');
      if (action === 'user.archive' || action === 'user.restore') {
        await tx.roleProfile.update({ where: { id: profile.id }, data: action === 'user.archive'
          ? { archivedAt: new Date(), status: 'Inactive' } : { archivedAt: null, status: 'Active' } });
      } else {
        const name = text(body.name);
        const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
        const phone = optional(body.phone, 30);
        if (!name || (body.kind !== 'trainer' && email !== profile.gymUser.email) || phone === null
          || (phone && normalizeRegistrationPhone(phone) === null)) return fail('Enter valid details. Email changes require verification.');
        if (body.kind === 'trainer') {
          const specialty = optional(body.specialty, 120), certs = optional(body.certs, 500);
          const price = Number(body.sessionPrice);
          if (specialty === null || certs === null || !Number.isFinite(price) || price < 0 || price > 100000)
            return fail('Enter valid trainer details.');
          await tx.trainerProfile.update({ where: { profileId: id! }, data: { specialty, certifications: certs, sessionPrice: price } });
        }
        if (body.kind === 'staff') {
          const role = jobRole(body.jobRole), schedule = shift(body.shift);
          if (!role || !schedule) return fail('Enter valid staff details.');
          await tx.staffProfile.update({ where: { profileId: id! }, data: {
            jobRole: role, shift: schedule } });
        }
        await tx.user.update({ where: { id: profile.gymUserId }, data: { name,
          phone: phone ? normalizeRegistrationPhone(phone) : null } });
        const linked = await tx.authUser.findUnique({ where: { gymUserId: profile.gymUserId } });
        if (linked) await tx.authUser.update({ where: { id: linked.id }, data: { name,
          phone: phone ? normalizeRegistrationPhone(phone) : null } });
        if (body.kind === 'admin' || body.kind === 'trainer' || body.kind === 'staff')
          await tx.roleProfile.update({ where: { id: profile.id }, data: { status: body.status === 'Inactive' ? 'Inactive' : 'Active' } });
      }
    } else if (action === 'user.create') {
      if (!validKind(body.kind)) return fail('Choose a valid role.');
      const name = text(body.name);
      const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
      const account = email ? await tx.authUser.findUnique({ where: { email }, include: { assignedRoles: true } }) : null;
      if (!name || !account?.gymUserId || account.assignedRoles.length !== 0) return fail('Register this email first with no assigned role. Existing roles are preserved.');
      const phone = optional(body.phone, 30);
      if (phone === null || (phone && normalizeRegistrationPhone(phone) === null)) return fail('Enter a valid phone.');
      if (body.kind === 'trainer' && (!Number.isFinite(Number(body.sessionPrice))
        || Number(body.sessionPrice) < 0 || Number(body.sessionPrice) > 100000
        || optional(body.specialty, 120) === null || optional(body.certs, 500) === null)) return fail('Enter valid trainer details.');
      if (body.kind === 'staff' && (!jobRole(body.jobRole) || !shift(body.shift))) return fail('Enter valid staff details.');
      await tx.user.update({ where: { id: account.gymUserId }, data: { name,
        phone: phone ? normalizeRegistrationPhone(phone) : null } });
      await tx.authUser.update({ where: { id: account.id }, data: { name,
        phone: phone ? normalizeRegistrationPhone(phone) : null } });
      const profile = await tx.roleProfile.create({ data: { gymUserId: account.gymUserId, role: body.kind,
        status: body.status === 'Inactive' ? 'Inactive' : 'Active' } });
      if (body.kind === 'member') await tx.memberProfile.create({ data: { profileId: profile.id } });
      if (body.kind === 'trainer') await tx.trainerProfile.create({ data: { profileId: profile.id,
        specialty: optional(body.specialty, 120) ?? '', certifications: optional(body.certs, 500) ?? '',
        sessionPrice: Number(body.sessionPrice) || 0 } });
      if (body.kind === 'staff') await tx.staffProfile.create({ data: { profileId: profile.id,
        jobRole: jobRole(body.jobRole) ?? 'FrontDesk', shift: shift(body.shift) ?? 'Morning' } });
      await tx.assignedRole.create({ data: { accountId: account.id, role: body.kind, profileId: profile.id } });
    } else return fail('This super admin action is unavailable.');
    await tx.auditEvent.create({ data: { actor: accountId, actorRole: 'superadmin', action,
      target: typeof body.id === 'string' ? body.id : accountId, result: 'success', requestId } });
    return NextResponse.json({ ok: true });
  });
}
