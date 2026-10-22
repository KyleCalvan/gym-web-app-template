import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function notificationToJson(n: {
  id: string;
  userId: number;
  title: string;
  body: string;
  actionView: string | null;
  actionLabel: string | null;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    body: n.body,
    actionView: n.actionView,
    actionLabel: n.actionLabel,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['member', 'admin', 'staff', 'trainer'] as GymRole[], async (tx, requestId) => {
    const authHeader = request.headers.get('authorization');
    const accountId = authHeader?.replace(/^Bearer\s+/i, '');

    if (!accountId) {
      return NextResponse.json({ error: 'Authorization required.', requestId }, { status: 401 });
    }

    const account = await tx.authUser.findUnique({
      where: { id: accountId },
      select: { gymUserId: true },
    });

    if (!account?.gymUserId) {
      return NextResponse.json({ error: 'Account not linked to gym user.', requestId }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const where: Prisma.NotificationWhereInput = { userId: account.gymUserId };
    if (unreadOnly) where.readAt = null;

    const [notifications, total, unreadCount] = await Promise.all([
      tx.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      tx.notification.count({ where }),
      tx.notification.count({ where: { userId: account.gymUserId, readAt: null } }),
    ]);

    return NextResponse.json({
      notifications: notifications.map(notificationToJson),
      total,
      unreadCount,
      limit,
      offset,
    });
  });
}

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId) => {
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
    const userId = typeof input.userId === 'number' ? input.userId : null;
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const bodyText = typeof input.body === 'string' ? input.body.trim() : '';
    const actionView = typeof input.actionView === 'string' ? input.actionView.trim() || null : null;
    const actionLabel = typeof input.actionLabel === 'string' ? input.actionLabel.trim() || null : null;

    if (!userId || !title || !bodyText) {
      return NextResponse.json({ error: 'userId, title, and body are required.', requestId }, { status: 400 });
    }

    const notification = await tx.notification.create({
      data: { userId, title, body: bodyText, actionView, actionLabel },
    });

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'notification.created',
        target: notification.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ notification: notificationToJson(notification) }, { status: 201 });
  });
}

export async function PATCH(request: NextRequest) {
  return withBusinessAuthorization(request, ['member', 'admin', 'staff', 'trainer'] as GymRole[], async (tx, requestId) => {
    const authHeader = request.headers.get('authorization');
    const accountId = authHeader?.replace(/^Bearer\s+/i, '');

    if (!accountId) {
      return NextResponse.json({ error: 'Authorization required.', requestId }, { status: 401 });
    }

    const account = await tx.authUser.findUnique({
      where: { id: accountId },
      select: { gymUserId: true },
    });

    if (!account?.gymUserId) {
      return NextResponse.json({ error: 'Account not linked to gym user.', requestId }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const action = typeof input.action === 'string' ? input.action : '';

    if (action === 'mark-all-read') {
      await tx.notification.updateMany({
        where: { userId: account.gymUserId, readAt: null },
        data: { readAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }

    const notificationId = typeof input.notificationId === 'string' ? input.notificationId : '';
    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId or action is required.', requestId }, { status: 400 });
    }

    const notification = await tx.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== account.gymUserId) {
      return NextResponse.json({ error: 'Notification not found.', requestId }, { status: 404 });
    }

    const updated = await tx.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ notification: notificationToJson(updated) });
  });
}
