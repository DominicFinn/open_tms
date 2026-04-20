-- Carrier cutoff times: latest handoff time per day of week
CREATE TABLE IF NOT EXISTS "CarrierCutoff" (
  "id"              TEXT PRIMARY KEY,
  "carrierId"       TEXT NOT NULL REFERENCES "Carrier"("id") ON DELETE CASCADE,
  "locationId"      TEXT,
  "dayOfWeek"       INTEGER NOT NULL,
  "cutoffLocalTime" TEXT NOT NULL,
  "timezone"        TEXT NOT NULL DEFAULT 'UTC',
  "serviceLevel"    TEXT,
  "notes"           TEXT,
  "active"          BOOLEAN NOT NULL DEFAULT TRUE,
  "orgId"           TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "CarrierCutoff_carrierId_dayOfWeek_idx" ON "CarrierCutoff"("carrierId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "CarrierCutoff_orgId_idx" ON "CarrierCutoff"("orgId");
CREATE INDEX IF NOT EXISTS "CarrierCutoff_active_idx" ON "CarrierCutoff"("active");

-- Shipment dedup fields for cutoff-at-risk monitor
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "lastCutoffRiskSeverity" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "lastCutoffRiskAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "lastCutoffRiskIssueId" TEXT;
