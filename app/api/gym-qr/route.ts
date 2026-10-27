import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { prisma } from '@/src/auth/prisma';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { validateQrDestination } from '@/src/qrDestinations';
import type { QrDestination } from '@/src/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const record = await readSession(requestSessionToken(request));
    if (!record) return NextResponse.json({ code: 'UNAUTHENTICATED' }, { status: 401 });
    if (record.status.restricted) return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
    const destinations = await prisma.gymQrDestination.findMany({ orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, url: true } });
    return NextResponse.json({ destinations }, { headers: { 'cache-control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'superadmin'], async (tx, requestId) => {
    let body: unknown;
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Send valid JSON.', requestId); }
    const input = (body as { destinations?: unknown } | null)?.destinations;
    if (!Array.isArray(input) || input.length > 12) {
      return apiError(400, 'INVALID_REQUEST', 'Send up to 12 gym destinations.', requestId);
    }
    const destinations: QrDestination[] = [];
    for (const item of input) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string'
        || typeof item.label !== 'string' || typeof item.url !== 'string') {
        return apiError(400, 'INVALID_REQUEST', 'Each destination needs an ID, label, and URL.', requestId);
      }
      const destination = { id: item.id.trim(), label: item.label.trim(), url: item.url.trim() };
      if (!destination.id || destination.id.length > 80 || !destination.label || destination.label.length > 100
        || destination.url.length > 2048 || validateQrDestination(destination)) {
        return apiError(400, 'INVALID_DESTINATION', 'Check each destination label and HTTPS URL.', requestId);
      }
      destinations.push(destination);
    }
    if (!destinations.some(item => item.id === 'facebook') || new Set(destinations.map(item => item.id)).size !== destinations.length) {
      return apiError(400, 'INVALID_DESTINATION', 'Include the verified Facebook page and use unique destinations.', requestId);
    }
    await tx.gymQrDestination.deleteMany();
    await tx.gymQrDestination.createMany({ data: destinations.map((item, sortOrder) => ({ ...item, sortOrder })) });
    return NextResponse.json({ destinations });
  });
}
