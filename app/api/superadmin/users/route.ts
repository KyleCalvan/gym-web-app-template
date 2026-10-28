import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { Prisma, type Prisma as PrismaTypes } from '@/backend/generated/prisma/client';
import { normalizeEmail } from '@/src/auth/account';
import { hasSameOrigin } from '@/src/auth/http';
import { prisma } from '@/src/auth/prisma';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { readSession } from '@/src/auth/sessions';

export const runtime = 'nodejs';

const roles = ['admin', 'member', 'trainer', 'staff'] as const;
type ManagedRole = typeof roles[number];
type Input = Record<string, unknown>;
const noStore = { 'cache-control': 'private, no-store' };

class UserInputError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function fail(status: number, code: string, message: string) {
  return Response.json({ code, error: message }, { status, headers: noStore });
}

async function authorize(request: NextRequest, write = false): Promise<string | null | Response> {
  if (write && !hasSameOrigin(request)) return fail(403, 'ORIGIN_REJECTED', 'Invalid request origin.');
  const session = await readSession(requestSessionToken(request));
  if (!session) return fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  if (session.status.restricted || !session.status.roles.includes('superadmin')) {
    return fail(403, 'FORBIDDEN', 'Super Admin access is required.');
  }
  return session.user.id;
}

function object(value: unknown): Input {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UserInputError(400, 'INVALID_REQUEST', 'Enter valid user details.');
  return value as Input;
}

function role(value: unknown): ManagedRole {
  if (!roles.includes(value as ManagedRole)) throw new UserInputError(400, 'INVALID_ROLE', 'Choose a valid role.');
  return value as ManagedRole;
}

function requiredString(value: unknown, label: string, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new UserInputError(400, 'INVALID_REQUEST', `Enter a valid ${label}.`);
  }
  return value.trim();
}

function optionalString(value: unknown, label: string, max = 120) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.trim().length > max) throw new UserInputError(400, 'INVALID_REQUEST', `Enter a valid ${label}.`);
  return value.trim();
}

function details(body: Input, kind: ManagedRole) {
  const firstName = requiredString(body.firstName, 'first name', 60);
  const lastName = requiredString(body.lastName, 'last name', 60);
  const middleName = optionalString(body.middleName, 'middle name', 60);
  const suffix = optionalString(body.suffix, 'suffix', 16);
  const name = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
  if (name.length > 120) throw new UserInputError(400, 'INVALID_REQUEST', 'Name is too long.');
  const email = normalizeEmail(requiredString(body.email, 'email', 254));
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new UserInputError(400, 'INVALID_REQUEST', 'Enter a valid email.');
  const phone = optionalString(body.phone, 'phone', 25);
  if (phone && (!/^[+\d()\s.-]+$/.test(phone) || (phone.match(/\d/g)?.length ?? 0) < 7)) {
    throw new UserInputError(400, 'INVALID_REQUEST', 'Enter a valid phone number.');
  }
  const allowed = kind === 'admin' ? ['Active', 'Inactive']
    : kind === 'member' ? ['Active'] : ['Active', 'On Leave', 'Inactive'];
  const status = body.status === undefined ? 'Active' : requiredString(body.status, 'status', 20);
  if (!allowed.includes(status)) throw new UserInputError(400, 'INVALID_REQUEST', 'Choose a valid status.');
  const plan = kind === 'member' ? requiredString(body.plan, 'plan', 100) : '';
  const specialty = kind === 'trainer' ? optionalString(body.specialty, 'specialty', 120) : '';
  const certs = kind === 'trainer' ? optionalString(body.certs, 'certifications', 500) : '';
  const price = kind === 'trainer' ? Number(body.sessionPrice) : 0;
  if (kind === 'trainer' && (!Number.isFinite(price) || price < 0 || price > 1_000_000)) {
    throw new UserInputError(400, 'INVALID_REQUEST', 'Enter a valid session price.');
  }
  const jobRole = kind === 'staff' ? requiredString(body.role, 'staff role', 30) : 'Front Desk';
  const shift = kind === 'staff' ? requiredString(body.shift, 'shift', 20) : 'Morning';
  if (kind === 'staff' && (!['Front Desk', 'Sales', 'Manager'].includes(jobRole) || !['Morning', 'Evening', 'Night'].includes(shift))) {
    throw new UserInputError(400, 'INVALID_REQUEST', 'Choose a valid staff role and shift.');
  }
  return { name, email, phone, status, plan, specialty, certs, price, jobRole, shift };
}

async function ensurePlan(tx: PrismaTypes.TransactionClient, name: string) {
  if (name && !await tx.gymPlan.findUnique({ where: { name }, select: { name: true } })) {
    throw new UserInputError(400, 'INVALID_PLAN', 'Choose an existing gym plan.');
  }
}

async function createSubtype(tx: PrismaTypes.TransactionClient, id: string, kind: ManagedRole, data: ReturnType<typeof details>) {
  if (kind === 'member') await tx.memberProfile.create({ data: { profileId: id, planInterest: data.plan } });
  if (kind === 'trainer') await tx.trainerProfile.create({ data: {
    profileId: id, specialty: data.specialty, certifications: data.certs, sessionPrice: data.price,
  } });
  if (kind === 'staff') await tx.staffProfile.create({ data: {
    profileId: id, jobRole: data.jobRole === 'Front Desk' ? 'FrontDesk' : data.jobRole as 'Sales' | 'Manager', shift: data.shift as 'Morning' | 'Evening' | 'Night',
  } });
}

async function audit(tx: PrismaTypes.TransactionClient, actor: string | null, action: string, target: string) {
  await tx.auditEvent.create({ data: {
    actor: actor ?? 'development-demo-superadmin', actorRole: 'superadmin', action, target,
    result: 'success', requestId: randomUUID(), category: 'user-management',
  } });
}

const profileInclude = {
  gymUser: { include: { oauthIdentity: { select: { id: true } } } },
  member: { include: { memberships: { orderBy: { createdAt: 'desc' as const }, take: 1 } } },
  trainer: true,
  staff: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const actor = await authorize(request);
    if (actor instanceof Response) return actor;
    const profiles = await prisma.roleProfile.findMany({
      where: { role: { in: [...roles] } }, include: profileInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const result = { admins: [] as unknown[], members: [] as unknown[], trainers: [] as unknown[], staff: [] as unknown[] };
    for (const profile of profiles) {
      const common = { id: profile.id, name: profile.gymUser.name ?? '', email: profile.gymUser.email,
        phone: profile.gymUser.phone ?? '', deletedAt: profile.archivedAt?.toISOString() ?? null,
        linkedAccount: Boolean(profile.gymUser.oauthIdentity) };
      if (profile.role === 'admin') result.admins.push({ ...common, status: profile.status, createdAt: profile.createdAt.toISOString() });
      if (profile.role === 'member' && profile.member) {
        const membership = profile.member.memberships[0];
        result.members.push({ ...common, plan: membership?.planName ?? profile.member.planInterest ?? '',
          status: membership?.status ?? 'No Membership', joined: profile.member.joinedAt.toISOString(),
          planInterest: profile.member.planInterest });
      }
      if (profile.role === 'trainer' && profile.trainer) result.trainers.push({ ...common,
        specialty: profile.trainer.specialty, certs: profile.trainer.certifications,
        sessionPrice: Number(profile.trainer.sessionPrice), status: profile.status,
        rating: 0, sessionsWeek: 0, reviews: [] });
      if (profile.role === 'staff' && profile.staff) result.staff.push({ ...common,
        role: profile.staff.jobRole === 'FrontDesk' ? 'Front Desk' : profile.staff.jobRole, shift: profile.staff.shift, status: profile.status,
        hireDate: profile.staff.hiredAt.toISOString() });
    }
    return Response.json(result, { headers: noStore });
  } catch (error) {
    console.error('Could not load managed users.', error);
    return fail(503, 'UNAVAILABLE', 'Users could not be loaded.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await authorize(request, true);
    if (actor instanceof Response) return actor;
    const body = object(await request.json());
    const kind = role(body.kind);
    const data = details(body, kind);
    const id = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'email:' + data.email}, 0))`;
      await ensurePlan(tx, data.plan);
      if (await tx.user.findUnique({ where: { email: data.email }, select: { id: true } })
        || await tx.authUser.findUnique({ where: { email: data.email }, select: { id: true } })) {
        throw new UserInputError(409, 'EMAIL_EXISTS', 'A person with this email already exists. Use the verified account invitation flow.');
      }
      const user = await tx.user.create({ data: { email: data.email, name: data.name, phone: data.phone || null } });
      const profile = await tx.roleProfile.create({ data: { gymUserId: user.id, role: kind, status: data.status } });
      await createSubtype(tx, profile.id, kind, data);
      await audit(tx, actor, 'user.created', profile.id);
      return profile.id;
    });
    return Response.json({ id }, { status: 201, headers: noStore });
  } catch (error) { return handleError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await authorize(request, true);
    if (actor instanceof Response) return actor;
    const body = object(await request.json());
    if (body.action === 'restore-many') {
      if (!Array.isArray(body.users) || body.users.length === 0 || body.users.length > 100) {
        throw new UserInputError(400, 'INVALID_REQUEST', 'Select up to 100 archived users.');
      }
      const users = body.users.map(value => {
        const item = object(value);
        return { id: requiredString(item.id, 'user ID', 100), kind: role(item.kind) };
      });
      if (new Set(users.map(user => user.id)).size !== users.length) {
        throw new UserInputError(400, 'INVALID_REQUEST', 'Choose each user only once.');
      }
      await prisma.$transaction(async tx => {
        const found = await tx.roleProfile.findMany({ where: { id: { in: users.map(user => user.id) }, archivedAt: { not: null } },
          select: { id: true, role: true, assignments: { select: { accountId: true } },
            gymUser: { select: { oauthIdentity: { select: { id: true } } } } } });
        if (found.length !== users.length || users.some(user => !found.some(profile => profile.id === user.id && profile.role === user.kind))) {
          throw new UserInputError(409, 'STALE_RECORD', 'One of the selected users is no longer archived. Reload and try again.');
        }
        if (found.some(profile => profile.assignments.length || profile.gymUser.oauthIdentity)) throw new UserInputError(409, 'ACCOUNT_LINKED', 'A selected role belongs to an online Account and needs the verified authority flow.');
        await tx.roleProfile.updateMany({ where: { id: { in: users.map(user => user.id) } }, data: { archivedAt: null } });
        for (const user of users) await audit(tx, actor, 'user.restored', user.id);
      });
      return Response.json({ restored: users.length }, { headers: noStore });
    }
    const id = requiredString(body.id, 'user ID', 100);
    const kind = role(body.kind);
    if (body.action === 'archive' || body.action === 'restore') {
      const archived = body.action === 'archive';
      await prisma.$transaction(async tx => {
        const existing = await tx.roleProfile.findFirst({ where: { id, role: kind },
          include: { gymUser: { select: { oauthIdentity: { select: { id: true } } } } } });
        if (!existing) throw new UserInputError(404, 'NOT_FOUND', 'User role was not found.');
        if (Boolean(existing.archivedAt) === archived) throw new UserInputError(409, 'STALE_RECORD', 'This user role has already changed.');
        if (existing.gymUser.oauthIdentity || await tx.assignedRole.findFirst({ where: { profileId: id }, select: { accountId: true } })) {
          throw new UserInputError(409, 'ACCOUNT_LINKED', 'This role belongs to an online Account and needs the verified authority flow.');
        }
        await tx.roleProfile.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
        await audit(tx, actor, archived ? 'user.archived' : 'user.restored', id);
      });
      return Response.json({ id }, { headers: noStore });
    }
    const data = details(body, kind);
    const targetRole = body.changeRole ? role(body.changeRole) : kind;
    if (targetRole !== kind) throw new UserInputError(409, 'ROLE_CHANGE_UNAVAILABLE', 'Role changes require the verified account authority flow.');
    await prisma.$transaction(async tx => {
      const existing = await tx.roleProfile.findFirst({ where: { id, role: kind, archivedAt: null }, include: profileInclude });
      if (!existing) throw new UserInputError(404, 'NOT_FOUND', 'User role was not found.');
      if (existing.gymUser.oauthIdentity || await tx.assignedRole.findFirst({ where: { profileId: id }, select: { accountId: true } })) {
        throw new UserInputError(409, 'ACCOUNT_LINKED', 'This role belongs to an online Account and needs the verified authority flow.');
      }
      if (existing.gymUser.email !== data.email) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'email:' + data.email}, 0))`;
        if (await tx.user.findUnique({ where: { email: data.email } })
          || await tx.authUser.findUnique({ where: { email: data.email }, select: { id: true } })) {
          throw new UserInputError(409, 'EMAIL_EXISTS', 'That email is already in use.');
        }
      }
      await tx.user.update({ where: { id: existing.gymUserId }, data: { name: data.name, email: data.email, phone: data.phone || null } });
        await ensurePlan(tx, data.plan);
        if (kind !== 'member') await tx.roleProfile.update({ where: { id }, data: { status: data.status } });
        if (kind === 'member') await tx.memberProfile.update({ where: { profileId: id }, data: { planInterest: data.plan } });
        if (kind === 'trainer') await tx.trainerProfile.update({ where: { profileId: id }, data: {
          specialty: data.specialty, certifications: data.certs, sessionPrice: data.price,
        } });
        if (kind === 'staff') await tx.staffProfile.update({ where: { profileId: id }, data: {
          jobRole: data.jobRole === 'Front Desk' ? 'FrontDesk' : data.jobRole as 'Sales' | 'Manager', shift: data.shift as 'Morning' | 'Evening' | 'Night',
        } });
      await audit(tx, actor, 'user.updated', id);
    });
    return Response.json({ id }, { headers: noStore });
  } catch (error) { return handleError(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await authorize(request, true);
    if (actor instanceof Response) return actor;
    const body = object(await request.json());
    const id = requiredString(body.id, 'user ID', 100);
    const kind = role(body.kind);
    await prisma.$transaction(async tx => {
      const profile = await tx.roleProfile.findFirst({ where: { id, role: kind, archivedAt: { not: null } },
        include: { gymUser: { select: { oauthIdentity: { select: { id: true } } } } } });
      if (!profile) throw new UserInputError(404, 'NOT_FOUND', 'Archived user role was not found.');
      if (profile.gymUser.oauthIdentity || await tx.assignedRole.findFirst({ where: { profileId: id }, select: { accountId: true } })) {
        throw new UserInputError(409, 'ACCOUNT_LINKED', 'This role belongs to an online Account and cannot be deleted here.');
      }
      if (kind === 'member') await tx.memberProfile.delete({ where: { profileId: id } });
      if (kind === 'trainer') await tx.trainerProfile.delete({ where: { profileId: id } });
      if (kind === 'staff') await tx.staffProfile.delete({ where: { profileId: id } });
      await tx.roleProfile.delete({ where: { id } });
      await audit(tx, actor, 'user.role-deleted', id);
    });
    return Response.json({ id }, { headers: noStore });
  } catch (error) { return handleError(error); }
}

function handleError(error: unknown) {
  if (error instanceof UserInputError) return fail(error.status, error.code, error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return fail(409, 'CONFLICT', 'That email or role is already in use.');
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    return fail(409, 'LINKED_HISTORY', 'This role has linked history and cannot be permanently deleted.');
  }
  if (error instanceof SyntaxError) return fail(400, 'INVALID_REQUEST', 'Send valid JSON.');
  console.error('Could not save managed user.', error);
  return fail(503, 'UNAVAILABLE', 'User could not be saved.');
}
