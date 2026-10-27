CREATE TABLE "PasswordLoginThrottle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "blockedUntil" TIMESTAMPTZ(3),
    CONSTRAINT "PasswordLoginThrottle_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "PasswordLoginThrottle" ENABLE ROW LEVEL SECURITY;
