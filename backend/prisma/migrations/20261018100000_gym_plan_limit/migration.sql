CREATE TABLE "GymPlan" (
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "members" INTEGER NOT NULL DEFAULT 0,
    "perks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "category" TEXT NOT NULL DEFAULT 'Standard',
    "description" TEXT NOT NULL DEFAULT '',
    "restrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sessionLimit" TEXT NOT NULL DEFAULT '0',
    "facilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "includedBenefits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "excludedBenefits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymPlan_pkey" PRIMARY KEY ("name")
);
