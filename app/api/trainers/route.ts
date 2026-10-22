import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function trainerDisplayNumber(id: string): string {
  const num = parseInt(id.slice(-4), 16) % 10000;
  return `T-${String(num).padStart(4, '0')}`;
}

function trainerToJson(t: {
  id: string;
  gymUserId: number;
  displayNumber: string;
  specialty: string | null;
  certifications: string[];
  bio: string | null;
  sessionRate: number;
  sessionPriceCurrency: string;
  status: string;
  hireDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  gymUser: { id: number; email: string; name: string | null } | null;
  reviews: { rating: number }[];
}) {
  const avgRating = t.reviews.length > 0
    ? t.reviews.reduce((sum, r) => sum + r.rating, 0) / t.reviews.length
    : 0;
  return {
    id: t.id,
    gymUserId: t.gymUserId,
    displayNumber: t.displayNumber,
    specialty: t.specialty,
    certifications: t.certifications,
    bio: t.bio,
    sessionRate: t.sessionRate,
    sessionPriceCurrency: t.sessionPriceCurrency,
    status: t.status,
    hireDate: t.hireDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    deletedAt: t.deletedAt?.toISOString() ?? null,
    user: t.gymUser ? { id: t.gymUser.id, email: t.gymUser.email, name: t.gymUser.name } : null,
    rating: Math.round(avgRating * 10) / 10,
    reviewCount: t.reviews.length,
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer', 'member'] as GymRole[], async (tx, requestId) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.TrainerProfileWhereInput = {};
    if (status === 'active') where.status = 'Active';
    else if (status) where.status = status as Prisma.EnumTrainerStatusFilter;

    const [trainers, total] = await Promise.all([
      tx.trainerProfile.findMany({
        where,
        include: {
          gymUser: { select: { id: true, email: true, name: true } },
          reviews: { select: { rating: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.trainerProfile.count({ where }),
    ]);

    return NextResponse.json({ trainers: trainers.map(trainerToJson), total, limit, offset });
  });
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be an object.', requestId }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const gymUserId = typeof input.gymUserId === 'number' ? input.gymUserId : null;
    if (gymUserId === null) {
      return NextResponse.json({ error: 'gymUserId is required.', requestId }, { status: 400 });
    }

    const gymUser = await tx.user.findUnique({ where: { id: gymUserId } });
    if (!gymUser) {
      return NextResponse.json({ error: 'User not found.', requestId }, { status: 404 });
    }

    const existing = await tx.trainerProfile.findUnique({ where: { gymUserId } });
    if (existing) {
      return NextResponse.json({ error: 'Trainer profile already exists for this user.', requestId }, { status: 409 });
    }

    const sessionRate = typeof input.sessionRate === 'number' ? Math.round(input.sessionRate) : 0;
    const specialty = typeof input.specialty === 'string' ? input.specialty.trim() || null : null;
    const certifications = Array.isArray(input.certifications)
      ? input.certifications.filter((c): c is string => typeof c === 'string')
      : [];
    const bio = typeof input.bio === 'string' ? input.bio.trim() || null : null;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'trainer:' + gymUserId}, 0))`;

    const trainer = await tx.trainerProfile.create({
      data: {
        gymUserId,
        displayNumber: '', // Will be updated
        specialty,
        certifications,
        bio,
        sessionRate,
        status: 'Active',
      },
      include: {
        gymUser: { select: { id: true, email: true, name: true } },
        reviews: { select: { rating: true } },
      },
    });

    const updated = await tx.trainerProfile.update({
      where: { id: trainer.id },
      data: { displayNumber: trainerDisplayNumber(trainer.id) },
      include: {
        gymUser: { select: { id: true, email: true, name: true } },
        reviews: { select: { rating: true } },
      },
    });

    // Ensure trainer role
    const profile = await tx.roleProfile.upsert({
      where: { gymUserId_role: { gymUserId, role: 'trainer' } },
      create: { gymUserId, role: 'trainer' },
      update: {},
    });

    const account = await tx.authUser.findUnique({ where: { gymUserId } });
    if (account) {
      await tx.assignedRole.upsert({
        where: { accountId_role: { accountId: account.id, role: 'trainer' } },
        create: { accountId: account.id, role: 'trainer', profileId: profile.id },
        update: {},
      });
    }

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'trainer.created',
        target: updated.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ trainer: trainerToJson(updated) }, { status: 201 });
  });
}
