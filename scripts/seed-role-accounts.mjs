// Run explicitly with SEED_ROLE_ACCOUNTS=1 from the frontend directory.
// Creates only the named .test accounts and small, clearly simulated records.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../backend/generated/prisma/client/index.js';
import { hashPassword } from '../src/auth/password.ts';
import { CURRENT_TERMS_VERSION } from '../src/auth/terms.ts';

const requireBackend = createRequire(new URL('../backend/package.json', import.meta.url));
const { PrismaPg } = requireBackend('@prisma/adapter-pg');
const { Pool } = requireBackend('pg');
process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));

if (process.env.SEED_ROLE_ACCOUNTS !== '1'
  || !['localhost', '127.0.0.1'].includes(new URL(process.env.NEXTAUTH_URL).hostname)) {
  throw new Error('Run explicitly for a localhost app with SEED_ROLE_ACCOUNTS=1.');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const schema = new URL(databaseUrl).searchParams.get('schema') ?? 'public';
const pool = new Pool({ connectionString: databaseUrl });
const db = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
const now = new Date();
const specs = [
  { role: 'staff', email: 'staff@vinathletics.test', name: 'VinAthletics Staff', phone: '+63 900 000 0101' },
  { role: 'admin', email: 'admin@vinathletics.test', name: 'VinAthletics Admin', phone: '+63 900 000 0102' },
  { role: 'superadmin', email: 'superadmin@vinathletics.test', name: 'VinAthletics Super Admin', phone: '+63 900 000 0103' },
  { role: 'trainer', email: 'trainer@vinathletics.test', name: 'VinAthletics Trainer', phone: '+63 900 000 0104' },
  { role: 'member', email: 'member@vinathletics.test', name: 'VinAthletics Member', phone: '+63 900 000 0105' },
];

try {
  const prepared = [];
  for (const spec of specs) {
    const existing = await db.authUser.findUnique({ where: { email: spec.email } });
    if (existing || await db.user.findUnique({ where: { email: spec.email } })) {
      throw new Error(`Seed account already exists: ${spec.email}. Existing passwords were not changed.`);
    }
    const password = randomBytes(18).toString('base64url');
    const passwordHash = await hashPassword(password);
    prepared.push({ ...spec, password, passwordHash });
  }
  const created = await db.$transaction(async (tx) => {
    const inserted = [];
    for (const spec of prepared) {
      const gymUser = await tx.user.create({ data: { email: spec.email, name: spec.name, phone: spec.phone } });
      const account = await tx.authUser.create({ data: {
        email: spec.email, name: spec.name, phone: spec.phone, gymUserId: gymUser.id,
        passwordHash: spec.passwordHash, status: 'enabled', establishedAt: now,
        emailVerified: now, emailVerifiedProvider: 'seed', emailVerifiedSubject: spec.email,
        termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: now,
      } });
      const profile = await tx.roleProfile.create({ data: { gymUserId: gymUser.id, role: spec.role } });
      if (spec.role === 'member') await tx.memberProfile.create({ data: { profileId: profile.id } });
      if (spec.role === 'trainer') await tx.trainerProfile.create({ data: { profileId: profile.id, specialty: 'Strength and Conditioning' } });
      if (spec.role === 'staff') await tx.staffProfile.create({ data: { profileId: profile.id } });
      await tx.assignedRole.create({ data: { accountId: account.id, role: spec.role, profileId: profile.id } });
      inserted.push({ role: spec.role, email: spec.email, password: spec.password, profileId: profile.id });
    }

    const memberId = inserted.find((item) => item.role === 'member').profileId;
    const trainerId = inserted.find((item) => item.role === 'trainer').profileId;
    const plan = await tx.gymPlan.findUnique({ where: { name: 'Basic' } });
    if (plan) {
      const startsAt = new Date(now);
      const endsAt = new Date(now.getTime() + 30 * 86_400_000);
      await tx.membership.create({ data: { memberId, planName: plan.name, status: 'Active', startsAt, endsAt } });
      await tx.paymentTransaction.create({ data: {
        reference: 'SEED-ROLE-MEMBER-BASIC', memberId, customerName: 'VinAthletics Member',
        type: 'Membership', method: 'GCash', status: 'Paid', paymentState: 'Successful',
        amount: plan.price, isSimulated: true, paidAt: now,
      } });
    }
    await tx.coachingSession.create({ data: {
      memberId, trainerId, startsAt: new Date(now.getTime() + 7 * 86_400_000),
      type: 'Personal Training', status: 'Confirmed', amount: 0,
      notes: 'Sample session for role account walkthrough',
    } });
    return inserted;
  }, { timeout: 30000 });

  // Passwords are emitted once for the requesting user; they are never stored in the repository.
  console.log(JSON.stringify({ created: created.map(({ role, email, password }) => ({ role, email, password })),
    sampleRecords: 'Basic membership, simulated payment, trainer session' }));
} finally {
  await db.$disconnect();
  await pool.end();
}
