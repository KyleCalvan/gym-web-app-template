import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/auth/prisma';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const record = await readSession(requestSessionToken(request));
    if (!record) return NextResponse.json({ code: 'UNAUTHENTICATED' }, { status: 401 });
    if (record.status.restricted || !record.status.roles.includes('member')) {
      return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
    }
    const assignment = await prisma.assignedRole.findUnique({
      where: { accountId_role: { accountId: record.user.id, role: 'member' } },
      select: { profile: { select: { member: { select: { profileId: true, qrUpdatedAt: true } } } } },
    });
    const member = assignment?.profile.member;
    if (!member) return NextResponse.json({ code: 'MEMBER_UNAVAILABLE' }, { status: 404 });
    const headers = { 'cache-control': 'private, no-store' };
    if (request.nextUrl.searchParams.get('image') === '1') {
      const image = await prisma.memberProfile.findUnique({ where: { profileId: member.profileId },
        select: { qrImage: true, qrMimeType: true } });
      if (!image?.qrImage || !image.qrMimeType) return new NextResponse(null, { status: 404, headers });
      return new NextResponse(new Uint8Array(image.qrImage), { headers: { ...headers,
        'content-type': image.qrMimeType, 'x-content-type-options': 'nosniff' } });
    }
    const destinations = await prisma.gymQrDestination.findMany({ orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, url: true } });
    return NextResponse.json({ destinations, memberQrUpdatedAt: member.qrUpdatedAt?.toISOString() ?? null }, { headers });
  } catch {
    return NextResponse.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}
