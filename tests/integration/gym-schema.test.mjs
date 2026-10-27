import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startDatabase, runNode, withDatabaseClient } from './harness.mjs';

test('gym migration preserves operational relationships and rejects inconsistent records', { timeout: 180_000 }, async (t) => {
  const database = await startDatabase();
  try {
    await runNode('scripts/prisma.mjs', ['migrate', 'deploy'], database.env);
    await runNode('scripts/prisma.mjs', ['migrate', 'deploy'], database.env);
    await runNode('node_modules/prisma/build/index.js', [
      'migrate', 'diff', `--from-url=${database.env.DATABASE_URL}`,
      '--to-schema-datamodel=backend/prisma/schema.prisma', '--exit-code',
    ], database.env);

    await withDatabaseClient(database.env, async (db) => {
      await db.query(`
        INSERT INTO "User" (id, email, name) VALUES
          (1, 'member@example.test', 'Member'), (2, 'trainer@example.test', 'Trainer');
        INSERT INTO "RoleProfile" (id, "gymUserId", role) VALUES
          ('member-profile', 1, 'member'), ('trainer-profile', 2, 'trainer');
        INSERT INTO "MemberProfile" ("profileId") VALUES ('member-profile');
        INSERT INTO "TrainerProfile" ("profileId", "sessionPrice") VALUES ('trainer-profile', 500.25);
        INSERT INTO "GymPlan" (name, price, period, "updatedAt") VALUES ('Original', 1000, 'Monthly', now());
        INSERT INTO "Membership" (id, "memberId", "planName", "startsAt", "endsAt", "updatedAt")
          VALUES ('membership', 'member-profile', 'Original', '2026-11-01Z', '2026-12-01Z', now());
        INSERT INTO "PaymentTransaction" (id, reference, "memberId", "customerName", type, method, amount, status, "paymentState")
          VALUES ('payment', 'PAY-1', 'member-profile', 'Member', 'Membership', 'Cash', 999.90, 'Paid', 'Successful');
        INSERT INTO "TransactionItem" (id, "transactionId", description, "unitPrice", total, "planName", "membershipId")
          VALUES ('item', 'payment', 'Original monthly purchase', 999.90, 999.90, 'Original', 'membership');
      `);

      await t.test('role-specific details cannot attach to another role', async () => {
        await assert.rejects(db.query('INSERT INTO "StaffProfile" ("profileId") VALUES ($1)', ['member-profile']), { code: '23503' });
        await assert.rejects(db.query('UPDATE "MemberProfile" SET role = $1 WHERE "profileId" = $2', ['trainer', 'member-profile']), { code: '23514' });
      });

      await t.test('renaming a plan preserves purchased history and exact decimal amounts', async () => {
        await db.query('UPDATE "GymPlan" SET name = $1 WHERE name = $2', ['Renamed', 'Original']);
        const item = (await db.query('SELECT "planName", description, "unitPrice", total FROM "TransactionItem" WHERE id = $1', ['item'])).rows[0];
        assert.deepEqual(item, { planName: 'Renamed', description: 'Original monthly purchase', unitPrice: '999.90', total: '999.90' });
        assert.equal((await db.query('SELECT "planName" FROM "Membership" WHERE id = $1', ['membership'])).rows[0].planName, 'Renamed');
        await assert.rejects(db.query('DELETE FROM "GymPlan" WHERE name = $1', ['Renamed']), { code: '23503' });
        await assert.rejects(db.query('UPDATE "TransactionItem" SET total = -1 WHERE id = $1', ['item']), { code: '23514' });
        await assert.rejects(db.query('UPDATE "TransactionItem" SET total = 12 WHERE id = $1', ['item']), { code: '23514' });
        await assert.rejects(db.query('UPDATE "Membership" SET "endsAt" = "startsAt" WHERE id = $1', ['membership']), { code: '23514' });
      });

      await t.test('walk-in payments do not require a member or account', async () => {
        await db.query(`INSERT INTO "PaymentTransaction" (id, reference, "customerName", type, method, amount)
          VALUES ('walk-in', 'PAY-WALK-IN', 'Walk-in customer', 'POS', 'GCash', 100)`);
        assert.equal((await db.query('SELECT "memberId" FROM "PaymentTransaction" WHERE id = $1', ['walk-in'])).rows[0].memberId, null);
      });

      await t.test('member attendance is unique per gym business date', async () => {
        await db.query('INSERT INTO "Attendance" (id, "memberId", "visitDate") VALUES ($1, $2, $3)', ['visit', 'member-profile', '2026-11-01']);
        await assert.rejects(db.query('INSERT INTO "Attendance" (id, "memberId", "visitDate") VALUES ($1, $2, $3)', ['duplicate', 'member-profile', '2026-11-01']), { code: '23505' });
        await db.query('INSERT INTO "Attendance" (id, "memberId", "visitDate") VALUES ($1, $2, $3)', ['tomorrow', 'member-profile', '2026-11-02']);
      });

      await t.test('booking conflicts, slot release, and completed-session reviews are enforced', async () => {
        const booking = (id) => db.query(`INSERT INTO "CoachingSession"
          (id, "memberId", "trainerId", "startsAt", amount, "updatedAt")
          VALUES ($1, 'member-profile', 'trainer-profile', '2026-11-01T01:00:00Z', 500.25, now())`, [id]);
        await booking('first');
        await assert.rejects(booking('conflict'), { code: '23505' });
        await assert.rejects(db.query(`UPDATE "CoachingSession" SET rating = 5, "ratedAt" = now() WHERE id = 'first'`), { code: '23514' });
        await db.query(`UPDATE "CoachingSession" SET status = 'Cancelled' WHERE id = 'first'`);
        await booking('replacement');
        await db.query(`UPDATE "CoachingSession" SET status = 'Completed', rating = 5, "ratedAt" = now(), "reviewComment" = 'Helpful' WHERE id = 'replacement'`);
        await assert.rejects(db.query(`UPDATE "CoachingSession" SET rating = 6 WHERE id = 'replacement'`), { code: '23514' });
        await assert.rejects(db.query(`INSERT INTO "TrainerAvailability" (id, "trainerId", "startsAt", "endsAt", status, "updatedAt")
          VALUES ('invalid', 'trainer-profile', now(), now(), 'available', now())`), { code: '23514' });
      });

      await t.test('promotion codes and per-member redemption remain unique', async () => {
        await db.query(`INSERT INTO "Promotion" (id, title, code, "discountType", discount, "validFrom", "validUntil", "updatedAt")
          VALUES ('offer', 'Welcome', 'WELCOME', 'Percentage', '10', '2026-11-01', '2026-12-01', now())`);
        await db.query(`INSERT INTO "PromotionRedemption" (id, "memberId", "promotionId", code)
          VALUES ('redemption', 'member-profile', 'offer', 'WELCOME')`);
        await assert.rejects(db.query(`INSERT INTO "PromotionRedemption" (id, "memberId", "promotionId", code)
          VALUES ('duplicate', 'member-profile', 'offer', 'WELCOME')`), { code: '23505' });
        await assert.rejects(db.query(`UPDATE "Promotion" SET code = ' welcome ' WHERE id = 'offer'`), { code: '23514' });
      });

      await t.test('archiving retains history and hard deletion cannot cascade away purchases', async () => {
        await db.query(`UPDATE "RoleProfile" SET "archivedAt" = now() WHERE id = 'member-profile'`);
        assert.equal((await db.query('SELECT count(*)::int AS count FROM "Membership"')).rows[0].count, 1);
        await assert.rejects(db.query(`DELETE FROM "MemberProfile" WHERE "profileId" = 'member-profile'`), { code: '23503' });
        await assert.rejects(db.query(`DELETE FROM "PaymentTransaction" WHERE id = 'payment'`), { code: '23503' });
        await db.query(`UPDATE "RoleProfile" SET "archivedAt" = NULL WHERE id = 'member-profile'`);
      });

      await t.test('direct non-owner access is denied even when table privileges are granted', async () => {
        const unprotected = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`);
        assert.deepEqual(unprotected.rows, []);
        await db.query('CREATE ROLE gym_schema_reader NOLOGIN; GRANT USAGE ON SCHEMA public TO gym_schema_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO gym_schema_reader');
        await db.query('SET ROLE gym_schema_reader');
        try {
          assert.equal((await db.query('SELECT count(*)::int AS count FROM "User"')).rows[0].count, 0);
          assert.equal((await db.query('SELECT count(*)::int AS count FROM "PaymentTransaction"')).rows[0].count, 0);
        } finally {
          await db.query('RESET ROLE');
        }
      });
    });
  } finally {
    await database.stop();
  }
});
