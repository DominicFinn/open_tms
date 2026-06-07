-- Add orgId to EdiTransactionLog so multi-tenancy queries can scope on it
-- without joining through the optional partner relation.
--
-- NOTE on backfill: TradingPartner / Customer / Carrier do not carry orgId
-- directly in today's schema (org scope is implicit through User.organizationId
-- on the auth path). That makes it impossible to safely backfill historic
-- rows without ambiguous joins, so existing rows stay NULL and the read
-- endpoints tolerate NULL orgId on legacy data. New writes from authed routes
-- populate orgId via req.user.organizationId.

ALTER TABLE "EdiTransactionLog"
  ADD COLUMN "orgId" TEXT;

-- Indexes that support the most common scoped queries:
--   - org dashboard (orgId + createdAt)
--   - per-status filter inside an org (orgId + status)
--   - inbound/outbound queue inside an org (orgId + direction + status)
CREATE INDEX "EdiTransactionLog_orgId_idx"
  ON "EdiTransactionLog"("orgId");
CREATE INDEX "EdiTransactionLog_orgId_createdAt_idx"
  ON "EdiTransactionLog"("orgId", "createdAt");
CREATE INDEX "EdiTransactionLog_orgId_status_idx"
  ON "EdiTransactionLog"("orgId", "status");
CREATE INDEX "EdiTransactionLog_orgId_direction_status_idx"
  ON "EdiTransactionLog"("orgId", "direction", "status");
