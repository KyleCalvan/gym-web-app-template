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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId) => {
    const authHeader = request.headers.get('authorization');
    const accountId = authHeader?.replace(/^Bearer\s+/i, '');

    const verification = await tx.studentVerification.findUnique({
      where: { id },
      include: { member: { select: { id: true, email: true, name: true } } },
    });

    if (!verification) {
      return NextResponse.json({ error: 'Verification not found.', requestId }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const action = typeof input.action === 'string' ? input.action : '';

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use approve or reject.', requestId }, { status: 400 });
    }

    const reason = typeof input.reason === 'string' ? input.reason.trim() || null : null;

    const data: Prisma.StudentVerificationUpdateInput = {
      status: action === 'approve' ? 'Approved' : 'Rejected',
      reviewedAt: new Date(),
      reviewedBy: accountId || null,
      reviewReason: reason,
    };

    if (action === 'approve') {
      // Student status valid for 1 year
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      data.expiresAt = expiresAt;
    }

    const updated = await tx.studentVerification.update({
      where: { id },
      data,
      include: { member: { select: { id: true, email: true, name: true } } },
    });

    await tx.auditEvent.create({
      data: {
        actor: accountId || requestId,
        action: action === 'approve' ? 'student-verification.approved' : 'student-verification.rejected',
        target: id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ verification: verificationToJson(updated) });
  });
}
