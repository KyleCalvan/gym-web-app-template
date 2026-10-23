import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

const TRAINER_STATUSES = ['Active', 'OnLeave', 'Inactive'] as const;

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
    status: t.status === 'OnLeave' ? 'On Leave' : t.status,
    hireDate: t.hireDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    deletedAt: t.deletedAt?.toISOString() ?? null,
    user: t.gymUser ? { id: t.gymUser.id, email: t.gymUser.email, name: t.gymUser.name } : null,
    rating: Math.round(avgRating * 10) / 10,
    reviewCount: t.reviews.length,
  };
}

async function resolveTrainer(tx: Prisma.TransactionClient, value: string) {
  return tx.trainerProfile.findFirst({
    where: { OR: [{ id: value }, { displayNumber: value }] },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId, caller) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be an object.', requestId }, { status: 400 });
    }

    const existing = await resolveTrainer(tx, id);
    if (!existing) {
      return NextResponse.json({ error: 'Trainer not found.', requestId }, { status: 404 });
    }

    const input = body as Record<string, unknown>;
    const data: Prisma.TrainerProfileUpdateInput = {};

    if ('specialty' in input) {
      data.specialty = typeof input.specialty === 'string' ? input.specialty.trim() || null : null;
    }
    if ('bio' in input) {
      data.bio = typeof input.bio === 'string' ? input.bio.trim() || null : null;
    }
    if ('sessionRate' in input && typeof input.sessionRate === 'number' && Number.isFinite(input.sessionRate)) {
      data.sessionRate = Math.max(0, Math.round(input.sessionRate));
    }
    if ('certifications' in input) {
      data.certifications = Array.isArray(input.certifications)
        ? input.certifications.filter((c): c is string => typeof c === 'string')
        : [];
    }
    if ('status' in input && typeof input.status === 'string') {
      // The UI speaks "On Leave"; the TrainerStatus enum stores OnLeave.
      const status = input.status === 'On Leave' ? 'OnLeave' : input.status;
      if (!TRAINER_STATUSES.includes(status as (typeof TRAINER_STATUSES)[number])) {
        return NextResponse.json(
          { error: 'Invalid status. Use Active, On Leave, or Inactive.', requestId },
          { status: 400 },
        );
      }
      data.status = status as Prisma.TrainerProfileUpdateInput['status'];
    }

    // The trainer's display name lives on the canonical User account.
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name) {
      await tx.user.update({ where: { id: existing.gymUserId }, data: { name } });
    }

    if (Object.keys(data).length === 0 && !name) {
      return NextResponse.json({ error: 'No valid fields to update.', requestId }, { status: 400 });
    }

    const trainer = await tx.trainerProfile.update({
      where: { id: existing.id },
      data,
      include: {
        gymUser: { select: { id: true, email: true, name: true } },
        reviews: { select: { rating: true } },
      },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'trainer.updated',
        target: trainer.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ trainer: trainerToJson(trainer) });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId, caller) => {
    const existing = await resolveTrainer(tx, id);
    if (!existing) {
      return NextResponse.json({ error: 'Trainer not found.', requestId }, { status: 404 });
    }

    const trainer = await tx.trainerProfile.update({
      where: { id: existing.id },
      data: { status: 'Inactive', deletedAt: new Date() },
      include: {
        gymUser: { select: { id: true, email: true, name: true } },
        reviews: { select: { rating: true } },
      },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'trainer.deleted',
        target: trainer.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ trainer: trainerToJson(trainer) });
  });
}
