import { readFileSync, writeFileSync } from 'node:fs';

const target = 'app/api/members/[id]/route.ts';
const original = readFileSync(target, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
let source = original.split('\r\n').join('\n');

const edits = [
  {
    name: 'serializer-signature',
    applied: /const latestMembership = profile\.memberships\?\.\[0\] \?\? null;/.test(source),
    from: `  deletedAt: Date | null;
  gymUser: { id: number; email: string; name: string | null } | null;
}) {
  return {
    id: profile.id,`,
    to: `  deletedAt: Date | null;
  gymUser: { id: number; email: string; name: string | null } | null;
  memberships?: {
    id: string;
    planName: string;
    status: string;
    expiresAt: Date;
  }[];
}) {
  const latestMembership = profile.memberships?.[0] ?? null;

  return {
    id: profile.id,`,
  },
  {
    name: 'serializer-output',
    applied: /    plan: latestMembership\?\.planName \?\? null,/.test(source),
    from: `    user: profile.gymUser ? {
      id: profile.gymUser.id,
      email: profile.gymUser.email,
      name: profile.gymUser.name,
    } : null,
  };
}`,
    to: `    user: profile.gymUser ? {
      id: profile.gymUser.id,
      email: profile.gymUser.email,
      name: profile.gymUser.name,
    } : null,
    plan: latestMembership?.planName ?? null,
    membershipStatus: latestMembership?.status ?? null,
    membershipExpiresAt: latestMembership?.expiresAt.toISOString() ?? null,
    membershipId: latestMembership?.id ?? null,
  };
}`,
  },
  {
    name: 'get-resolve',
    applied: /where: \{ OR: \[\{ id \}, \{ displayNumber: id \}\] \},\n      include: \{\n        gymUser/.test(source),
    from: `    const profile = await tx.memberProfile.findUnique({
      where: { id },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });`,
    to: `    const profile = await tx.memberProfile.findFirst({
      where: { OR: [{ id }, { displayNumber: id }] },
      include: {
        gymUser: { select: { id: true, email: true, name: true } },
        memberships: { orderBy: { expiresAt: 'desc' }, take: 1 },
      },
    });`,
  },
  {
    name: 'patch-resolve',
    applied: /const existing = await tx\.memberProfile\.findFirst\(/.test(source),
    from: `    const profile = await tx.memberProfile.update({
      where: { id },
      data,
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });`,
    to: `    const existing = await tx.memberProfile.findFirst({
      where: { OR: [{ id }, { displayNumber: id }] },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
    }

    const profile = await tx.memberProfile.update({
      where: { id: existing.id },
      data,
      include: {
        gymUser: { select: { id: true, email: true, name: true } },
        memberships: { orderBy: { expiresAt: 'desc' }, take: 1 },
      },
    });`,
  },
  {
    name: 'delete-resolve',
    applied: /const profile = await tx\.memberProfile\.findFirst\(\{\n      where: \{ OR: \[\{ id \}, \{ displayNumber: id \}\] \},\n    \}\);/.test(source),
    from: `    const profile = await tx.memberProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
    }

    const updated = await tx.memberProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { gymUser: { select: { id: true, email: true, name: true } } },
    });`,
    to: `    const profile = await tx.memberProfile.findFirst({
      where: { OR: [{ id }, { displayNumber: id }] },
    });
    if (!profile) {
      return NextResponse.json({ error: 'Member profile not found.', requestId }, { status: 404 });
    }

    const updated = await tx.memberProfile.update({
      where: { id: profile.id },
      data: { deletedAt: new Date() },
      include: {
        gymUser: { select: { id: true, email: true, name: true } },
        memberships: { orderBy: { expiresAt: 'desc' }, take: 1 },
      },
    });`,
  },
];

const failures = [];
for (const edit of edits) {
  if (edit.applied) continue;
  if (!source.includes(edit.from)) {
    failures.push(`${edit.name}: anchor text not found`);
    continue;
  }
  source = source.replace(edit.from, edit.to);
}

if (failures.length > 0) {
  process.stderr.write(failures.join('\n') + '\n');
  process.exit(1);
}

writeFileSync(target, source.split('\n').join(eol), 'utf8');

/* ---- invariant check ---- */
const finalText = readFileSync(target, 'utf8');
const checks = [
  ['membership serializer fields', /membershipExpiresAt/.test(finalText)],
  ['displayNumber resolution (3x)', (finalText.match(/displayNumber: id/g) ?? []).length === 3],
  ['membership include (3x)', (finalText.match(/memberships: \{ orderBy/g) ?? []).length === 3],
  ['no bare update where id', !/update\(\{\n      where: \{ id \},/.test(finalText)],
  ['no remaining findUnique({ where: { id } })', !/findUnique\(\{ where: \{ id \} \}\)/.test(finalText)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length > 0) {
  process.stderr.write('INVARIANT FAILED: ' + failed.join(', ') + '\n');
  process.exit(2);
}

process.exit(0);
