-- CustomerWebhook: customer-owned outbound webhooks managed via the Developer Area
CREATE TABLE IF NOT EXISTS "CustomerWebhook" (
  "id"             TEXT PRIMARY KEY,
  "customerId"     TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "orgId"          TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "url"            TEXT NOT NULL,
  "secret"         TEXT NOT NULL,
  "enabled"        BOOLEAN NOT NULL DEFAULT TRUE,
  "events"         TEXT[] NOT NULL DEFAULT '{}',
  "description"    TEXT,
  "lastDeliveryAt" TIMESTAMP(3),
  "lastStatusCode" INTEGER,
  "deliveryCount"  INTEGER NOT NULL DEFAULT 0,
  "failureCount"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "CustomerWebhook_customerId_idx" ON "CustomerWebhook"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerWebhook_enabled_idx" ON "CustomerWebhook"("enabled");

CREATE TABLE IF NOT EXISTS "CustomerWebhookDelivery" (
  "id"           TEXT PRIMARY KEY,
  "webhookId"    TEXT NOT NULL REFERENCES "CustomerWebhook"("id") ON DELETE CASCADE,
  "eventType"    TEXT NOT NULL,
  "eventId"      TEXT,
  "payload"      JSONB NOT NULL,
  "status"       TEXT NOT NULL,
  "statusCode"   INTEGER,
  "responseBody" TEXT,
  "errorMessage" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "CustomerWebhookDelivery_webhookId_createdAt_idx" ON "CustomerWebhookDelivery"("webhookId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerWebhookDelivery_status_idx" ON "CustomerWebhookDelivery"("status");
CREATE INDEX IF NOT EXISTS "CustomerWebhookDelivery_eventType_idx" ON "CustomerWebhookDelivery"("eventType");
