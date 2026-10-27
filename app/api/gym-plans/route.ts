import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/backend/generated/prisma/client';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { prisma } from '@/src/auth/prisma';
import { PLANS } from '@/src/data';
import type { Plan } from '@/src/types';

export const runtime = 'nodejs';

const PLAN_LOCK_ID = 918273645;
const DEFAULT_ACTIVE_PLAN_LIMIT = 4;

function getActivePlanLimit(): number {
  const configured = process.env.ACTIVE_PLAN_LIMIT?.trim();
  if (!configured) return DEFAULT_ACTIVE_PLAN_LIMIT;
  const limit = Number(configured);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('ACTIVE_PLAN_LIMIT must be a positive integer.');
  }
  return limit;
}

function toDatabasePlan(plan: Plan) {
  return {
    name: plan.name,
    price: plan.price,
    period: plan.period,
    members: plan.members,
    perks: plan.perks,
    featured: plan.featured,
    status: plan.status,
    category: plan.category,
    description: plan.description,
    restrictions: plan.restrictions,
    sessionLimit: String(plan.sessionLimit),
    facilities: plan.facilities,
    includedBenefits: plan.includedBenefits,
    excludedBenefits: plan.excludedBenefits,
    terms: plan.terms ?? null,
  };
}

function fromDatabasePlan(record: Awaited<ReturnType<typeof prisma.gymPlan.findMany>>[number]): Plan {
  const sessionLimit = record.sessionLimit === 'unlimited'
    ? 'unlimited'
    : Number(record.sessionLimit);
  if (typeof sessionLimit === 'number' && (!Number.isSafeInteger(sessionLimit) || sessionLimit < 0)) {
    throw new Error(`Plan ${record.name} has an invalid session limit.`);
  }
  if (record.status !== 'Active' && record.status !== 'Inactive') {
    throw new Error(`Plan ${record.name} has an invalid status.`);
  }
  return {
    name: record.name,
    price: record.price,
    period: record.period,
    members: record.members,
    perks: record.perks,
    featured: record.featured,
    status: record.status,
    category: record.category,
    description: record.description,
    restrictions: record.restrictions,
    sessionLimit,
    facilities: record.facilities,
    includedBenefits: record.includedBenefits,
    excludedBenefits: record.excludedBenefits,
    terms: record.terms ?? undefined,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<Plan>;
  return typeof plan.name === 'string'
    && Boolean(plan.name.trim())
    && typeof plan.price === 'number'
    && Number.isFinite(plan.price)
    && plan.price >= 0
    && typeof plan.period === 'string'
    && typeof plan.members === 'number'
    && Number.isSafeInteger(plan.members)
    && plan.members >= 0
    && isStringArray(plan.perks)
    && typeof plan.featured === 'boolean'
    && (plan.status === 'Active' || plan.status === 'Inactive')
    && typeof plan.category === 'string'
    && typeof plan.description === 'string'
    && isStringArray(plan.restrictions)
    && (plan.sessionLimit === 'unlimited' || (
      typeof plan.sessionLimit === 'number'
      && Number.isSafeInteger(plan.sessionLimit)
      && plan.sessionLimit >= 0
    ))
    && isStringArray(plan.facilities)
    && isStringArray(plan.includedBenefits)
    && isStringArray(plan.excludedBenefits)
    && (plan.terms === undefined || typeof plan.terms === 'string');
}

async function lockedPlanTransaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // The lock returns PostgreSQL void, which Prisma cannot deserialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLAN_LOCK_ID})`;
    return action(tx);
  }, { isolationLevel: 'ReadCommitted', timeout: 20_000 });
}

async function readPlanCatalog() {
  return lockedPlanTransaction(async (tx) => {
    const count = await tx.gymPlan.count();
    if (count === 0) {
      await tx.gymPlan.createMany({ data: PLANS.map(toDatabasePlan) });
    }
    const [records, activePlanCount] = await Promise.all([
      tx.gymPlan.findMany({ orderBy: { createdAt: 'asc' } }),
      tx.gymPlan.count({ where: { status: 'Active' } }),
    ]);
    return {
      plans: records.map(fromDatabasePlan),
      activePlanCount,
      maxActivePlans: getActivePlanLimit(),
    };
  });
}

export async function GET() {
  try {
    return NextResponse.json(await readPlanCatalog());
  } catch (error) {
    console.error('Could not load membership plans.', error);
    return NextResponse.json({ error: 'Membership plans could not be loaded. Check database configuration and migrations.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'superadmin'], async (tx, requestId) => {

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, 'INVALID_REQUEST', 'Request body must be valid JSON.', requestId);
    }
    if (!body || typeof body !== 'object' || !isPlan((body as { plan?: unknown }).plan)) {
      return apiError(400, 'INVALID_REQUEST', 'A valid membership plan is required.', requestId);
    }
    const plan = { ...(body as { plan: Plan }).plan, status: 'Active' as const };

    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLAN_LOCK_ID})`;
      const result = await (async () => {
        const activePlanCount = await tx.gymPlan.count({ where: { status: 'Active' } });
        const maxActivePlans = getActivePlanLimit();
        if (activePlanCount >= maxActivePlans) {
          return { error: `The active plan limit has been reached (${activePlanCount}/${maxActivePlans}). Deactivate a plan before creating another.`, status: 409 as const };
        }
        await tx.gymPlan.create({ data: toDatabasePlan(plan) });
        return { plans: (await tx.gymPlan.findMany({ orderBy: { createdAt: 'asc' } })).map(fromDatabasePlan), activePlanCount: activePlanCount + 1, maxActivePlans };
      })();
      if (result.status) return apiError(result.status, 'PLAN_CONFLICT', result.error, requestId);
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return apiError(409, 'PLAN_CONFLICT', 'A membership plan with that name already exists.', requestId);
      }
      throw error;
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'superadmin'], async (tx, requestId) => {

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, 'INVALID_REQUEST', 'Request body must be valid JSON.', requestId);
    }

    if (!body || typeof body !== 'object') {
      return apiError(400, 'INVALID_REQUEST', 'A plan action is required.', requestId);
    }
    const payload = body as { action?: unknown; name?: unknown; originalName?: unknown; plan?: unknown };
    const action = payload.action;
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const originalName = typeof payload.originalName === 'string' ? payload.originalName.trim() : name;
    if (!['update', 'activate', 'deactivate'].includes(String(action)) || !originalName) {
      return apiError(400, 'INVALID_REQUEST', 'Choose a valid plan action and plan name.', requestId);
    }
    if (action === 'update' && !isPlan(payload.plan)) {
      return apiError(400, 'INVALID_REQUEST', 'A valid membership plan is required.', requestId);
    }

    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLAN_LOCK_ID})`;
      const result = await (async () => {
        const existing = await tx.gymPlan.findUnique({ where: { name: originalName } });
        if (!existing) return { error: 'Membership plan was not found.', status: 404 as const };

        if (action === 'activate' && existing.status !== 'Active') {
          const activePlanCount = await tx.gymPlan.count({ where: { status: 'Active' } });
          const maxActivePlans = getActivePlanLimit();
          if (activePlanCount >= maxActivePlans) {
            return { error: `The active plan limit has been reached (${activePlanCount}/${maxActivePlans}). Deactivate a plan before reactivating another.`, status: 409 as const };
          }
        }

        if (action === 'deactivate' || action === 'activate') {
          await tx.gymPlan.update({
            where: { name: originalName },
            data: { status: action === 'activate' ? 'Active' : 'Inactive' },
          });
        } else {
          const plan = payload.plan as Plan;
          const updatedPlan = { ...plan, status: existing.status as Plan['status'] };
          const dbPlan = toDatabasePlan(updatedPlan);
          // Rename in place so memberships and other plan references follow the
          // database's ON UPDATE CASCADE without deleting purchased history.
          await tx.gymPlan.update({ where: { name: originalName }, data: dbPlan });
        }

        const [records, activePlanCount] = await Promise.all([
          tx.gymPlan.findMany({ orderBy: { createdAt: 'asc' } }),
          tx.gymPlan.count({ where: { status: 'Active' } }),
        ]);
        return { plans: records.map(fromDatabasePlan), activePlanCount, maxActivePlans: getActivePlanLimit() };
      })();
      if (result.status) return apiError(result.status, result.status === 404 ? 'PLAN_NOT_FOUND' : 'PLAN_CONFLICT', result.error, requestId);
      return NextResponse.json(result);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return apiError(409, 'PLAN_CONFLICT', 'A membership plan with that name already exists.', requestId);
      }
      throw error;
    }
  });
}
