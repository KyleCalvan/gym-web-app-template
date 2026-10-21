-- Existing opaque tokens remain valid subject to persisted Account gates.
-- Unknown legacy age starts at cutover; no legacy MFA/fresh-auth proof is inferred.
ALTER TABLE "AuthUser" ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);
ALTER TABLE "AuthSession"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "primaryAuthenticatedAt" TIMESTAMP(3),
  ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);
-- Prisma serializes DateTime values as UTC, including on non-UTC operators.
UPDATE "AuthSession" SET "createdAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
  "lastActiveAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
