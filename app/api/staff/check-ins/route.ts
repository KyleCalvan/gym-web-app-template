import { NextRequest, NextResponse } from 'next/server';
import { apiError, withBusinessAuthorization } from '@/src/auth/http';
import { authRequestContext } from '@/src/auth/request-context';
import { writeAudit } from '@/src/auth/audit';
import { getBookingToday } from '@/src/member/bookingDates';
import { hasActiveStaffProfile } from '@/src/auth/staff-access';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return withBusinessAuthorization(request, ['staff'], async (tx, requestId) => {
    if (!await hasActiveStaffProfile(tx, authRequestContext.getStore()?.accountId ?? null))
      return apiError(403, 'FORBIDDEN', 'An active staff profile is required.', requestId);
    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return apiError(400, 'INVALID_REQUEST', 'Choose a member to check in.', requestId); }
    const memberId = body?.memberId;
    if (typeof memberId !== 'string' || !memberId || memberId.length > 100)
      return apiError(400, 'INVALID_REQUEST', 'Choose a member to check in.', requestId);
    const member = await tx.memberProfile.findUnique({ where: { profileId: memberId }, include: { profile: true } });
    if (!member || member.profile.archivedAt)
      return apiError(404, 'MEMBER_NOT_FOUND', 'This member was not found.', requestId);
    const now = new Date();
    const membership = await tx.membership.findFirst({ where: { memberId,
      status: { in: ['Active', 'Expiring'] }, startsAt: { lte: now }, endsAt: { gt: now },
    }, orderBy: { endsAt: 'desc' } });
    if (!membership)
      return apiError(409, 'MEMBERSHIP_INACTIVE', 'An active membership is required for check-in.', requestId);
    const visitDate = new Date(`${getBookingToday(now)}T00:00:00.000Z`);
    const inserted = await tx.attendance.createMany({ data: [{
        memberId, visitDate, recordedByAccountId: authRequestContext.getStore()?.accountId ?? null,
      }], skipDuplicates: true });
    if (!inserted.count) return apiError(409, 'ALREADY_CHECKED_IN', 'This member has already checked in today.', requestId);
    const attendance = await tx.attendance.findUniqueOrThrow({ where: { memberId_visitDate: { memberId, visitDate } } });
      await writeAudit(tx, { actor: authRequestContext.getStore()?.accountId ?? null,
        action: 'staff.member-checked-in', target: memberId, result: 'success', requestId });
      return NextResponse.json({ id: attendance.id, countDelta: 1 }, { status: 201 });
  });
}
