// Reads the HTTP report summary and verifies the rows directly in PostgreSQL.
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const report = JSON.parse(readFileSync('tmp-verify.json', 'utf8'));
const envText = readFileSync('.env', 'utf8');
const line = envText.split(/\r?\n/).find((l) => l.trim().startsWith('DATABASE_URL='));
const raw = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
const parsed = new URL(raw);
const client = new pg.Client({
  host: parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname,
  port: Number(parsed.port || 5432),
  user: 'postgres',
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.replace(/^\//, '') || 'postgres',
});
await client.connect();

const out = {
  http: {
    ok: report.summary.ok,
    statuses: report.summary.statuses,
    failures: report.summary.failures,
    trainerCreated: report.summary.trainerCreated,
    trainerPatched: report.summary.trainerPatched,
    staffCreated: report.summary.staffCreated,
    staffPatched: report.summary.staffPatched,
    qrCreated: report.summary.qrCreated,
    qrPatched: report.summary.qrPatched,
    memberGymUserId: report.summary.memberGymUserId,
  },
  db: {},
};

try {
  const display = report.summary.trainerCreated && report.summary.trainerCreated.displayNumber;
  if (display) {
    const trainer = await client.query(
      `SELECT t."displayNumber", t."specialty", t."sessionRate", t."status", t."certifications",
              t."deletedAt" IS NOT NULL AS "softDeleted", u."name" AS "userName"
         FROM "TrainerProfile" t JOIN "User" u ON u."id" = t."gymUserId"
        WHERE t."displayNumber" = $1`, [display]);
    out.db.trainer = trainer.rows[0] || null;
  }

  const staff = await client.query(
    `SELECT s."displayNumber", s."shift", s."status", s."deletedAt" IS NOT NULL AS "softDeleted",
            u."name" AS "userName", u."email"
       FROM "StaffProfile" s JOIN "User" u ON u."id" = s."gymUserId"
      WHERE u."email" LIKE 'verify.staff.%@vinathletics.gym'
      ORDER BY s."createdAt" DESC LIMIT 1`);
  out.db.staff = staff.rows[0] || null;

  const booking = await client.query(
    `SELECT b."id", b."date", b."startTime", b."endTime", b."status", b."notes"
       FROM "Booking" b
      WHERE b."notes" = 'wiring proof'
      ORDER BY b."createdAt" DESC LIMIT 1`);
  out.db.booking = booking.rows[0] || null;

  const links = await client.query(
    `SELECT "label", "url" FROM "GymLink" WHERE "label" LIKE 'Verify Link%'`);
  out.db.leftoverQrLinks = links.rows;

  const counts = await client.query(
    `SELECT (SELECT count(*) FROM "TrainerProfile") AS trainers,
            (SELECT count(*) FROM "StaffProfile") AS staff,
            (SELECT count(*) FROM "Booking") AS bookings,
            (SELECT count(*) FROM "GymLink") AS links,
            (SELECT count(*) FROM "AuditEvent") AS audits`);
  out.db.counts = counts.rows[0];
} finally {
  await client.end();
}

writeFileSync('tmp-check.json', JSON.stringify(out, null, 2));
console.log('WROTE tmp-check.json');
