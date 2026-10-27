ALTER TABLE "MemberProfile"
  ADD COLUMN "qrImage" BYTEA,
  ADD COLUMN "qrMimeType" TEXT,
  ADD COLUMN "qrUpdatedAt" TIMESTAMPTZ(3);
