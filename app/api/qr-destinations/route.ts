import { NextRequest, NextResponse } from 'next/server';
import { withBusinessAuthorization } from '@/src/auth/http';
import type { GymRole } from '@/backend/generated/prisma/client';
import type { Prisma } from '@/backend/generated/prisma/client';

function linkToJson(l: {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: l.id,
    label: l.label,
    url: l.url,
    sortOrder: l.sortOrder,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'staff'] as GymRole[], async (tx, requestId) => {
    const links = await tx.gymLink.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ destinations: links.map(linkToJson) });
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
    const label = typeof input.label === 'string' ? input.label.trim() : '';
    const url = typeof input.url === 'string' ? input.url.trim() : '';

    if (!label || !url) {
      return NextResponse.json({ error: 'label and url are required.', requestId }, { status: 400 });
    }

    const maxSortOrder = await tx.gymLink.findFirst({
      select: { sortOrder: true },
      orderBy: { sortOrder: 'desc' },
    });

    const link = await tx.gymLink.create({
      data: {
        label,
        url,
        sortOrder: (maxSortOrder?.sortOrder ?? -1) + 1,
      },
    });

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'qr-link.created',
        target: link.id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ destination: linkToJson(link) }, { status: 201 });
  });
}

export async function PATCH(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.', requestId }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const links = Array.isArray(input.links) ? input.links : [];

    if (links.length === 0) {
      return NextResponse.json({ error: 'links array is required.', requestId }, { status: 400 });
    }

    for (const link of links) {
      const l = link as Record<string, unknown>;
      const id = typeof l.id === 'string' ? l.id : '';
      const sortOrder = typeof l.sortOrder === 'number' ? l.sortOrder : 0;

      if (id) {
        await tx.gymLink.update({
          where: { id },
          data: { sortOrder },
        });
      }
    }

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin'] as GymRole[], async (tx, requestId) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required.', requestId }, { status: 400 });
    }

    const link = await tx.gymLink.findUnique({ where: { id } });
    if (!link) {
      return NextResponse.json({ error: 'Link not found.', requestId }, { status: 404 });
    }

    await tx.gymLink.delete({ where: { id } });

    await tx.auditEvent.create({
      data: {
        actor: requestId,
        action: 'qr-link.deleted',
        target: id,
        result: 'success',
        requestId,
      },
    });

    return NextResponse.json({ deleted: true });
  });
}
