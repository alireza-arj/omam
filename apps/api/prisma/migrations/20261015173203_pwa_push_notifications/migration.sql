-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "authSessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "language" "AppLanguage" NOT NULL DEFAULT 'en',
    "lastSessionId" TEXT,
    "lastReminderAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_authSessionId_deletedAt_idx" ON "PushSubscription"("authSessionId", "deletedAt");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_authSessionId_fkey" FOREIGN KEY ("authSessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
