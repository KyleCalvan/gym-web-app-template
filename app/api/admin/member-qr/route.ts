import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { prisma } from '@/src/auth/prisma';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';

export const runtime = 'nodejs';
const MAX_IMAGE_BYTES = 1_500_000;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function GET(request: NextRequest) {
  try {
    const record = await readSession(requestSessionToken(request));
    if (!record) return NextResponse.json({ code: 'UNAUTHENTICATED' }, { status: 401 });
    if (record.status.restricted || !record.status.roles.some(role => role === 'admin' || role === 'superadmin')) {
      return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
    }
    const members = await prisma.memberProfile.findMany({
      select: { profileId: true, qrUpdatedAt: true,
        profile: { select: { gymUser: { select: { name: true, email: true } } } } },
      orderBy: { joinedAt: 'desc' },
    });
    return NextResponse.json({ members: members.map(member => ({ profileId: member.profileId,
      name: member.profile.gymUser.name ?? 'Member', email: member.profile.gymUser.email,
      qrUpdatedAt: member.qrUpdatedAt?.toISOString() ?? null })) },
    { headers: { 'cache-control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  return withBusinessAuthorization(request, ['admin', 'superadmin'], async (tx, requestId) => {
    let form: FormData;
    try { form = await request.formData(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Send a QR image upload.', requestId); }
    const profileId = form.get('profileId');
    const image = form.get('image');
    if (typeof profileId !== 'string' || !profileId || profileId.length > 100 || !(image instanceof File)) {
      return apiError(400, 'INVALID_REQUEST', 'Choose a member and QR image.', requestId);
    }
    if (!IMAGE_TYPES.has(image.type) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      return apiError(400, 'INVALID_IMAGE', 'Use a PNG, JPEG, or WebP image under 1.5 MB.', requestId);
    }
    const bytes = Buffer.from(await image.arrayBuffer());
    const signature = image.type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : image.type === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!signature) return apiError(400, 'INVALID_IMAGE', 'The selected file is not a valid image.', requestId);
    const exists = await tx.memberProfile.findUnique({ where: { profileId }, select: { profileId: true } });
    if (!exists) return apiError(404, 'MEMBER_UNAVAILABLE', 'The selected member no longer exists.', requestId);
    const updated = await tx.memberProfile.update({ where: { profileId }, data: {
      qrImage: bytes, qrMimeType: image.type, qrUpdatedAt: new Date(),
    }, select: { qrUpdatedAt: true } });
    return NextResponse.json({ profileId, qrUpdatedAt: updated.qrUpdatedAt?.toISOString() });
  });
}
