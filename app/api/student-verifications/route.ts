import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function verificationToJson(v: {
  id: string;
  memberId: number;
  status: string;
  documentAssetIds: string[];
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewReason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  member: { id: number; email: string; name: string | null } | null;
}) {
  return {
    id: v.id,
    memberId: v.memberId,
    status: v.status,
    documentAssetIds: v.documentAssetIds,
    submittedAt: v.submittedAt.toISOString(),
    reviewedAt: v.reviewedAt?.toISOString() ?? null,
    reviewedBy: v.reviewedBy,
    reviewReason: v.reviewReason,
    expiresAt: v.expiresAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    member: v.member,
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId, caller) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.StudentVerificationWhereInput = {};
    if (status) where.status = status as Prisma.EnumVerificationStatusFilter;

    const [verifications, total] = await Promise.all([
      tx.studentVerification.findMany({
        where,
        include: { member: { select: { id: true, email: true, name: true } } },
        orderBy: { submittedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.studentVerification.count({ where }),
    ]);

    return NextResponse.json({ verifications: verifications.map(verificationToJson), total, limit, offset });
  });
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['member'] as GymRole[], async (tx, requestId, caller) => {
    if (!caller.gymUserId) {
      return NextResponse.json({ error: 'Account not linked to gym user.', requestId }, { status: 404 });
    }

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
    const documentAssetIds = Array.isArray(input.documentAssetIds)
      ? input.documentAssetIds.filter((id): id is string => typeof id === 'string')
      : [];

    if (documentAssetIds.length === 0) {
      return NextResponse.json({ error: 'At least one document is required.', requestId }, { status: 400 });
    }

    const existing = await tx.studentVerification.findFirst({
      where: { memberId: caller.gymUserId, status: { in: ['Submitted', 'UnderReview', 'Approved'] } },
    });

    if (existing) {
      return NextResponse.json({ error: 'You already have a pending or approved verification.', requestId }, { status: 409 });
    }

    const verification = await tx.studentVerification.create({
      data: {
        memberId: caller.gymUserId,
        status: 'Submitted',
        documentAssetIds,
      },
      include: { member: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: caller.accountId,
        action: 'student-verification.submitted',
        target: verification.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ verification: verificationToJson(verification) }, { status: 201 });
  });
}
