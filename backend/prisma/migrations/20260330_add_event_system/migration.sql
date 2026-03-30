-- Domain Event Log (immutable event store)
CREATE TABLE "DomainEventLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DomainEventLog_type_idx" ON "DomainEventLog"("type");
CREATE INDEX "DomainEventLog_entityType_entityId_idx" ON "DomainEventLog"("entityType", "entityId");
CREATE INDEX "DomainEventLog_orgId_idx" ON "DomainEventLog"("orgId");
CREATE INDEX "DomainEventLog_timestamp_idx" ON "DomainEventLog"("timestamp");
CREATE INDEX "DomainEventLog_createdAt_idx" ON "DomainEventLog"("createdAt");

-- Notifications (in-app notification inbox)
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "entityType" TEXT,
    "entityId" TEXT,
    "actionUrl" TEXT,
    "eventId" TEXT,
    "eventType" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_orgId_idx" ON "Notification"("orgId");

-- Event Subscriptions (org-level routing rules)
CREATE TABLE "EventSubscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "eventPattern" TEXT NOT NULL,
    "handlerType" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "entityFilter" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventSubscription_orgId_active_idx" ON "EventSubscription"("orgId", "active");
CREATE INDEX "EventSubscription_eventPattern_idx" ON "EventSubscription"("eventPattern");

-- User Notification Preferences
CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserNotificationPreference_userId_eventCategory_key" ON "UserNotificationPreference"("userId", "eventCategory");
