BEGIN;

-- CreateEnum
CREATE TYPE "StaffJobRole" AS ENUM ('Front Desk', 'Sales', 'Manager');

-- CreateEnum
CREATE TYPE "StaffShift" AS ENUM ('Morning', 'Evening', 'Night');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('Active', 'Expiring', 'Frozen', 'Expired');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'GCash');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('Pending', 'Paid', 'Refunded', 'Failed');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('Pending', 'Processing', 'Successful', 'Failed');

-- CreateEnum
CREATE TYPE "CoachingSessionStatus" AS ENUM ('Pending', 'Confirmed', 'Cancelled', 'Completed');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'unavailable');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('Draft', 'Published');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('Percentage', 'Fixed', 'Bundle');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneSecondary" TEXT;

-- AlterTable
ALTER TABLE "AuthUser" ADD COLUMN     "mfaSecretEncrypted" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "RoleProfile" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active',
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "actorRole" "GymRole",
ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "details" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "level" TEXT NOT NULL DEFAULT 'info',
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "MemberProfile" (
    "profileId" TEXT NOT NULL,
    "role" "GymRole" NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emergencyContact" TEXT,
    "weightKg" DECIMAL(6,2),
    "heightCm" DECIMAL(5,2),
    "preferredPaymentMethod" "PaymentMethod" NOT NULL DEFAULT 'GCash',

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "TrainerProfile" (
    "profileId" TEXT NOT NULL,
    "role" "GymRole" NOT NULL DEFAULT 'trainer',
    "specialty" TEXT NOT NULL DEFAULT '',
    "certifications" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "sessionPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "profileId" TEXT NOT NULL,
    "role" "GymRole" NOT NULL DEFAULT 'staff',
    "jobRole" "StaffJobRole" NOT NULL DEFAULT 'Front Desk',
    "shift" "StaffShift" NOT NULL DEFAULT 'Morning',
    "hiredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'Active',
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "frozenAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "memberId" TEXT,
    "customerName" TEXT NOT NULL,
    "cashierAccountId" TEXT,
    "type" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'Pending',
    "paymentState" "PaymentState" NOT NULL DEFAULT 'Pending',
    "amount" DECIMAL(12,2) NOT NULL,
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMPTZ(3),
    "refundedAt" TIMESTAMPTZ(3),
    "refundReason" TEXT,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "planName" TEXT,
    "membershipId" TEXT,
    "coachingSessionId" TEXT,
    "promotionId" TEXT,
    "promotionCode" TEXT,

    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Personal Training',
    "status" "CoachingSessionStatus" NOT NULL DEFAULT 'Pending',
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "rating" INTEGER,
    "reviewComment" TEXT,
    "ratedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CoachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerAvailability" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TrainerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleChangeRequest" (
    "id" TEXT NOT NULL,
    "coachingSessionId" TEXT NOT NULL,
    "requestedByAccountId" TEXT,
    "requestedStartsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "visitDate" DATE NOT NULL,
    "checkedInAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByAccountId" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discount" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "planName" TEXT,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 0,
    "minSpend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PromotionStatus" NOT NULL DEFAULT 'Draft',
    "imageUrl" TEXT,
    "description" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRedemption" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "transactionId" TEXT,
    "redeemedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentVerification" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "studentIdStorageKey" TEXT NOT NULL,
    "enrollmentStorageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "accountId" TEXT NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "reminders" BOOLEAN NOT NULL DEFAULT true,
    "promos" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionView" TEXT,
    "actionLabel" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymQrDestination" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GymQrDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRecoveryCode" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_profileId_role_key" ON "MemberProfile"("profileId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_profileId_role_key" ON "TrainerProfile"("profileId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_profileId_role_key" ON "StaffProfile"("profileId", "role");

-- CreateIndex
CREATE INDEX "Membership_memberId_endsAt_idx" ON "Membership"("memberId", "endsAt");

-- CreateIndex
CREATE INDEX "Membership_planName_status_idx" ON "Membership"("planName", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_reference_key" ON "PaymentTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_receiptNumber_key" ON "PaymentTransaction"("receiptNumber");

-- CreateIndex
CREATE INDEX "PaymentTransaction_memberId_createdAt_idx" ON "PaymentTransaction"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_cashierAccountId_createdAt_idx" ON "PaymentTransaction"("cashierAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_createdAt_idx" ON "PaymentTransaction"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionItem_membershipId_key" ON "TransactionItem"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionItem_coachingSessionId_key" ON "TransactionItem"("coachingSessionId");

-- CreateIndex
CREATE INDEX "TransactionItem_transactionId_idx" ON "TransactionItem"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionItem_planName_idx" ON "TransactionItem"("planName");

-- CreateIndex
CREATE INDEX "TransactionItem_promotionId_idx" ON "TransactionItem"("promotionId");

-- CreateIndex
CREATE INDEX "CoachingSession_memberId_startsAt_idx" ON "CoachingSession"("memberId", "startsAt");

-- CreateIndex
CREATE INDEX "CoachingSession_trainerId_startsAt_idx" ON "CoachingSession"("trainerId", "startsAt");

-- CreateIndex
CREATE INDEX "CoachingSession_status_startsAt_idx" ON "CoachingSession"("status", "startsAt");

-- CreateIndex
CREATE INDEX "TrainerAvailability_trainerId_startsAt_idx" ON "TrainerAvailability"("trainerId", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduleChangeRequest_coachingSessionId_createdAt_idx" ON "ScheduleChangeRequest"("coachingSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleChangeRequest_requestedByAccountId_idx" ON "ScheduleChangeRequest"("requestedByAccountId");

-- CreateIndex
CREATE INDEX "Attendance_visitDate_idx" ON "Attendance"("visitDate");

-- CreateIndex
CREATE INDEX "Attendance_recordedByAccountId_idx" ON "Attendance"("recordedByAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_memberId_visitDate_key" ON "Attendance"("memberId", "visitDate");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_status_validFrom_validUntil_idx" ON "Promotion"("status", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "Promotion_planName_idx" ON "Promotion"("planName");

-- CreateIndex
CREATE INDEX "PromotionRedemption_promotionId_redeemedAt_idx" ON "PromotionRedemption"("promotionId", "redeemedAt");

-- CreateIndex
CREATE INDEX "PromotionRedemption_transactionId_idx" ON "PromotionRedemption"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRedemption_memberId_promotionId_key" ON "PromotionRedemption"("memberId", "promotionId");

-- CreateIndex
CREATE INDEX "StudentVerification_memberId_submittedAt_idx" ON "StudentVerification"("memberId", "submittedAt");

-- CreateIndex
CREATE INDEX "Notification_accountId_readAt_createdAt_idx" ON "Notification"("accountId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRecoveryCode_codeHash_key" ON "AuthRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "AuthRecoveryCode_accountId_idx" ON "AuthRecoveryCode"("accountId");

-- CreateIndex
CREATE INDEX "RoleProfile_role_archivedAt_idx" ON "RoleProfile"("role", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoleProfile_id_role_key" ON "RoleProfile"("id", "role");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_category_occurredAt_idx" ON "AuditEvent"("category", "occurredAt");

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_profileId_role_fkey" FOREIGN KEY ("profileId", "role") REFERENCES "RoleProfile"("id", "role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_profileId_role_fkey" FOREIGN KEY ("profileId", "role") REFERENCES "RoleProfile"("id", "role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_profileId_role_fkey" FOREIGN KEY ("profileId", "role") REFERENCES "RoleProfile"("id", "role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planName_fkey" FOREIGN KEY ("planName") REFERENCES "GymPlan"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_cashierAccountId_fkey" FOREIGN KEY ("cashierAccountId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_planName_fkey" FOREIGN KEY ("planName") REFERENCES "GymPlan"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_coachingSessionId_fkey" FOREIGN KEY ("coachingSessionId") REFERENCES "CoachingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "TrainerAvailability_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_coachingSessionId_fkey" FOREIGN KEY ("coachingSessionId") REFERENCES "CoachingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeRequest" ADD CONSTRAINT "ScheduleChangeRequest_requestedByAccountId_fkey" FOREIGN KEY ("requestedByAccountId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recordedByAccountId_fkey" FOREIGN KEY ("recordedByAccountId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_planName_fkey" FOREIGN KEY ("planName") REFERENCES "GymPlan"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentVerification" ADD CONSTRAINT "StudentVerification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthRecoveryCode" ADD CONSTRAINT "AuthRecoveryCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints not expressible in Prisma 5's schema language.
ALTER TABLE "RoleProfile" ADD CONSTRAINT "RoleProfile_status_check"
  CHECK ("status" IN ('Active', 'Inactive', 'On Leave'));
ALTER TABLE "MemberProfile"
  ADD CONSTRAINT "MemberProfile_role_check" CHECK ("role" = 'member'),
  ADD CONSTRAINT "MemberProfile_measurements_check" CHECK (("weightKg" IS NULL OR "weightKg" > 0) AND ("heightCm" IS NULL OR "heightCm" > 0));
ALTER TABLE "TrainerProfile"
  ADD CONSTRAINT "TrainerProfile_role_check" CHECK ("role" = 'trainer'),
  ADD CONSTRAINT "TrainerProfile_price_check" CHECK ("sessionPrice" >= 0);
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_role_check" CHECK ("role" = 'staff');
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_period_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_amounts_check"
  CHECK ("amount" >= 0 AND "fees" >= 0 AND "discountAmount" >= 0);
ALTER TABLE "TransactionItem"
  ADD CONSTRAINT "TransactionItem_amounts_check"
    CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "discountAmount" >= 0 AND "total" >= 0
      AND "total" = "quantity" * "unitPrice" - "discountAmount"),
  ADD CONSTRAINT "TransactionItem_entitlement_check" CHECK ("membershipId" IS NULL OR "coachingSessionId" IS NULL);
ALTER TABLE "CoachingSession"
  ADD CONSTRAINT "CoachingSession_amount_check" CHECK ("amount" >= 0),
  ADD CONSTRAINT "CoachingSession_review_check"
    CHECK (("rating" IS NULL AND "ratedAt" IS NULL AND "reviewComment" IS NULL)
      OR ("rating" IS NOT NULL AND "rating" BETWEEN 1 AND 5 AND "status" = 'Completed' AND "ratedAt" IS NOT NULL));
CREATE UNIQUE INDEX "CoachingSession_active_trainer_slot_key" ON "CoachingSession" ("trainerId", "startsAt")
  WHERE "status" IN ('Pending', 'Confirmed');
ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "TrainerAvailability_period_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Promotion"
  ADD CONSTRAINT "Promotion_period_check" CHECK ("validUntil" >= "validFrom"),
  ADD CONSTRAINT "Promotion_limits_check" CHECK ("maxRedemptions" >= 0 AND "minSpend" >= 0),
  ADD CONSTRAINT "Promotion_code_check" CHECK (length("code") > 0 AND "code" = upper(btrim("code")));

-- This app authorizes database access through Next.js, not Supabase's Data API.
-- Default-deny direct API roles; the migration/table owner retains server access.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoleProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssignedRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GymPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainerAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleChangeRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromotionRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GymQrDestination" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthRecoveryCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

COMMIT;
