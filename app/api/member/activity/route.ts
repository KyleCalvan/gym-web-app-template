import { NextRequest } from 'next/server';
import { Prisma } from '@/backend/generated/prisma/client/index.js';
import { readSession } from '@/src/auth/sessions';
import { requestSessionToken } from '@/src/auth/session-cookie';
import { prisma } from '@/src/auth/prisma';
import { hasActiveMembership } from '@/src/member/activeMembership';
import { gymDateISO } from '@/src/member/activityDates';

export const runtime = 'nodejs';

const gymTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const sessionTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true,
});

async function memberFor(request: NextRequest) {
  const session = await readSession(requestSessionToken(request));
  if (!session) return { error: Response.json({ error: 'Sign in to continue.' }, { status: 401 }) };
  if (session.status.restricted || !session.status.roles.includes('member')) {
    return { error: Response.json({ error: 'Member access is required.' }, { status: 403 }) };
  }
  const assignment = await prisma.assignedRole.findUnique({
    where: { accountId_role: { accountId: session.user.id, role: 'member' } },
    select: { profile: { select: { member: { select: { profileId: true, weightKg: true, heightCm: true } } } } },
  });
  const member = assignment?.profile.member;
  if (!member) return { error: Response.json({ error: 'Member profile is unavailable.' }, { status: 404 }) };
  return { member };
}

function sameOrigin(request: NextRequest) {
  return request.headers.get('origin') === new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin;
}

export async function GET(request: NextRequest) {
  try {
    const { member, error } = await memberFor(request);
    if (error) return error;
    const memberId = member!.profileId;
    const [attendance, sessions, membership] = await Promise.all([
      prisma.attendance.findMany({ where: { memberId }, orderBy: { visitDate: 'desc' },
        select: { id: true, visitDate: true, checkedInAt: true } }),
      prisma.coachingSession.findMany({ where: { memberId }, orderBy: { startsAt: 'desc' },
        select: { id: true, startsAt: true, type: true, status: true,
          trainer: { select: { profile: { select: { gymUser: { select: { name: true } } } } } } } }),
      prisma.membership.findFirst({ where: { memberId }, orderBy: { createdAt: 'desc' },
        select: { status: true, endsAt: true } }),
    ]);
    return Response.json({
      weightKg: member!.weightKg === null ? null : Number(member!.weightKg),
      heightCm: member!.heightCm === null ? null : Number(member!.heightCm),
      membershipStatus: membership?.status ?? null,
      canCheckIn: hasActiveMembership(membership),
      checkInHistory: attendance.map(visit => ({
        id: visit.id, memberId, date: visit.visitDate.toISOString().slice(0, 10),
        time: gymTime.format(visit.checkedInAt),
      })),
      sessions: sessions.map(item => ({
        id: item.id, member: memberId, trainer: item.trainer.profile.gymUser.name ?? 'Trainer',
        date: gymDateISO(item.startsAt), time: sessionTime.format(item.startsAt),
        type: item.type, status: item.status,
      })),
    });
  } catch {
    return Response.json({ error: 'Activity could not be loaded.' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const { member, error } = await memberFor(request);
    if (error) return error;
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
    const { weightKg, heightCm } = (body ?? {}) as { weightKg?: unknown; heightCm?: unknown };
    if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500 ||
        typeof heightCm !== 'number' || !Number.isFinite(heightCm) || heightCm < 50 || heightCm > 300) {
      return Response.json({ error: 'Enter a weight from 20–500 kg and height from 50–300 cm.' }, { status: 400 });
    }
    const updated = await prisma.memberProfile.update({ where: { profileId: member!.profileId },
      data: { weightKg, heightCm }, select: { weightKg: true, heightCm: true } });
    return Response.json({ weightKg: Number(updated.weightKg), heightCm: Number(updated.heightCm) });
  } catch {
    return Response.json({ error: 'Metrics could not be saved.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const { member, error } = await memberFor(request);
    if (error) return error;
    const memberId = member!.profileId;
    const membership = await prisma.membership.findFirst({ where: { memberId }, orderBy: { createdAt: 'desc' },
      select: { status: true, endsAt: true } });
    if (!hasActiveMembership(membership)) {
      return Response.json({ error: 'An active membership is required to check in.' }, { status: 403 });
    }
    const now = new Date();
    const date = gymDateISO(now);
    const visit = await prisma.attendance.create({ data: {
      memberId, visitDate: new Date(`${date}T00:00:00.000Z`), checkedInAt: now,
    }, select: { id: true, checkedInAt: true } });
    return Response.json({ checkIn: { id: visit.id, memberId, date, time: gymTime.format(visit.checkedInAt) } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ error: 'Already checked in today.' }, { status: 409 });
    }
    return Response.json({ error: 'Check-in could not be saved.' }, { status: 503 });
  }
}
