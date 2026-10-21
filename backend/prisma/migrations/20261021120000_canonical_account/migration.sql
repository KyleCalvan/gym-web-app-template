-- Stop before changing data. Never choose a winner or silently join identities.
-- One PostgreSQL statement keeps DDL/data changes atomic while allowing Prisma
-- to record the original failure in its migration ledger after rollback.
DO $migration$
DECLARE collisions JSONB;
BEGIN
  CREATE FUNCTION "normalizeAccountEmail"(TEXT) RETURNS TEXT
    LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $normalize$
      SELECT lower(btrim($1, E' \t\n\r\f' || chr(11) || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))
    $normalize$;
  SELECT jsonb_agg(report) INTO collisions FROM (
    SELECT jsonb_build_object('table', 'AuthUser', 'normalizedEmail', "normalizeAccountEmail"("email"), 'ids', jsonb_agg("id")) AS report
      FROM "AuthUser" WHERE "email" IS NOT NULL GROUP BY "normalizeAccountEmail"("email") HAVING count(*) > 1
    UNION ALL
    SELECT jsonb_build_object('table', 'User', 'normalizedEmail', "normalizeAccountEmail"("email"), 'ids', jsonb_agg("id"))
      FROM "User" GROUP BY "normalizeAccountEmail"("email") HAVING count(*) > 1
    UNION ALL
    SELECT jsonb_build_object('table', 'identity-link', 'normalizedEmail', "normalizeAccountEmail"(a."email"), 'accountId', a."id", 'gymUserId', u."id")
      FROM "AuthUser" a JOIN "User" u ON "normalizeAccountEmail"(a."email") = "normalizeAccountEmail"(u."email")
      WHERE a."gymUserId" IS DISTINCT FROM u."id"
  ) reports;
  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION 'Normalized email collisions require explicit resolution' USING DETAIL = collisions::TEXT;
  END IF;

UPDATE "AuthUser" SET "email" = "normalizeAccountEmail"("email") WHERE "email" IS NOT NULL;
UPDATE "User" SET "email" = "normalizeAccountEmail"("email");
ALTER TABLE "AuthUser" ADD CONSTRAINT "AuthUser_email_normalized" CHECK ("email" IS NULL OR ("email" = "normalizeAccountEmail"("email") AND length("email") > 0));
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK ("email" = "normalizeAccountEmail"("email") AND length("email") > 0);

CREATE TYPE "AccountStatus" AS ENUM ('enabled', 'disabled');
CREATE TYPE "GymRole" AS ENUM ('member', 'staff', 'trainer', 'admin', 'superadmin');
ALTER TABLE "AuthUser"
  ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'enabled',
  ADD COLUMN "establishedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerifiedProvider" TEXT,
  ADD COLUMN "emailVerifiedSubject" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

CREATE TABLE "RoleProfile" (
  "id" TEXT NOT NULL,
  "gymUserId" INTEGER NOT NULL,
  "role" "GymRole" NOT NULL,
  CONSTRAINT "RoleProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoleProfile_gymUserId_fkey" FOREIGN KEY ("gymUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RoleProfile_gymUserId_role_key" ON "RoleProfile"("gymUserId", "role");
CREATE TABLE "AssignedRole" (
  "accountId" TEXT NOT NULL,
  "role" "GymRole" NOT NULL,
  "profileId" TEXT NOT NULL,
  CONSTRAINT "AssignedRole_pkey" PRIMARY KEY ("accountId", "role"),
  CONSTRAINT "AssignedRole_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssignedRole_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RoleProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AssignedRole_profileId_idx" ON "AssignedRole"("profileId");
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "result" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_target_occurredAt_idx" ON "AuditEvent"("target", "occurredAt");
END $migration$;
