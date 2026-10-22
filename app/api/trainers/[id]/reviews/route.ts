import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';

function reviewToJson(r: {
  id: string;
  bookingId: string;
  trainerId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    bookingId: r.bookingId,
    trainerId: r.trainerId,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['admin', 'staff', 'trainer', 'member'] as GymRole[], async (tx, requestId) => {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const [reviews, total] = await Promise.all([
      tx.trainerReview.findMany({
        where: { trainerId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.trainerReview.count({ where: { trainerId: id } }),
    ]);

    return NextResponse.json({ reviews: reviews.map(reviewToJson), total, limit, offset });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withBusinessAuthorization(request, ['member'] as GymRole[], async (tx, requestId) => {
    const authHeader = request.headers.get('authorization');
    const accountId = authHeader?.replace(/^Bearer\s+/i, '');

    if (!accountId) {
      return NextResponse.json({ error: 'Authorization required.', requestId }, { status: 401 });
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
    const bookingId = typeof input.bookingId === 'string' ? input.bookingId : '';
    const rating = typeof input.rating === 'number' ? Math.round(input.rating) : 0;
    const comment = typeof input.comment === 'string' ? input.comment.trim() || null : null;

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required.', requestId }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.', requestId }, { status: 400 });
    }

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { review: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.', requestId }, { status: 404 });
    }

    if (booking.trainerId !== id) {
      return NextResponse.json({ error: 'Booking does not belong to this trainer.', requestId }, { status: 400 });
    }

    if (booking.status !== 'Completed') {
      return NextResponse.json({ error: 'Only completed sessions can be reviewed.', requestId }, { status: 400 });
    }

    if (booking.review) {
      return NextResponse.json({ error: 'This booking has already been reviewed.', requestId }, { status: 409 });
    }

    const review = await tx.trainerReview.create({
      data: {
        bookingId,
        trainerId: id,
        rating,
        comment,
      },
    });

    await tx.auditEvent.create({
      data: {
        actor: accountId,
        action: 'trainer-review.created',
        target: review.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ review: reviewToJson(review) }, { status: 201 });
  });
}
