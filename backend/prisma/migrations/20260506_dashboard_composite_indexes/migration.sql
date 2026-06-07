-- Composite indexes targeting common dashboard / list / aging queries that
-- previously required filter-then-sort scans. Each index covers a query shape
-- that already exists in the codebase but was hitting a single-column index
-- and then sorting in memory.

-- ShipmentReadModel: status filter + recency sort (operations dashboard,
-- shipment list page) and per-customer status filter (customer detail).
CREATE INDEX "ShipmentReadModel_orgId_status_createdAt_idx"
  ON "ShipmentReadModel"("orgId", "status", "createdAt");
CREATE INDEX "ShipmentReadModel_orgId_customerId_status_idx"
  ON "ShipmentReadModel"("orgId", "customerId", "status");

-- Issue: kanban board (status + priority filter) and the snoozed-issue sweep
-- that wakes issues whose snoozedUntil has passed.
CREATE INDEX "Issue_orgId_status_priority_idx"
  ON "Issue"("orgId", "status", "priority");
CREATE INDEX "Issue_orgId_assigneeId_status_idx"
  ON "Issue"("orgId", "assigneeId", "status");
CREATE INDEX "Issue_orgId_snoozedUntil_idx"
  ON "Issue"("orgId", "snoozedUntil");

-- IssueReadModel mirrors the same access patterns as Issue.
CREATE INDEX "IssueReadModel_orgId_status_priority_idx"
  ON "IssueReadModel"("orgId", "status", "priority");
CREATE INDEX "IssueReadModel_orgId_snoozedUntil_idx"
  ON "IssueReadModel"("orgId", "snoozedUntil");

-- EdiTransactionLog: per-partner failure dashboard and the inbound/outbound
-- "pending" queue ordered by arrival time. NOTE: this table has no orgId
-- column today so cross-org queries still scan; adding orgId is a separate
-- migration tracked in the snag list.
CREATE INDEX "EdiTransactionLog_partnerId_status_idx"
  ON "EdiTransactionLog"("partnerId", "status");
CREATE INDEX "EdiTransactionLog_direction_status_createdAt_idx"
  ON "EdiTransactionLog"("direction", "status", "createdAt");

-- AgentDecision: time-range queries from the compliance dashboard and the
-- "pending review" outcome queue.
CREATE INDEX "AgentDecision_orgId_createdAt_idx"
  ON "AgentDecision"("orgId", "createdAt");
CREATE INDEX "AgentDecision_orgId_outcomeStatus_idx"
  ON "AgentDecision"("orgId", "outcomeStatus");

-- Charge: AR/AP aging report scans (orgId + status) and revenue/cost split
-- breakdowns.
CREATE INDEX "Charge_orgId_status_idx"
  ON "Charge"("orgId", "status");
CREATE INDEX "Charge_orgId_chargeCategory_status_idx"
  ON "Charge"("orgId", "chargeCategory", "status");

-- Invoice: per-customer AR aging on the customer detail page.
CREATE INDEX "Invoice_orgId_customerId_status_idx"
  ON "Invoice"("orgId", "customerId", "status");

-- CarrierInvoice: AP aging by due date (was already on (orgId, status)) and
-- per-carrier outstanding view.
CREATE INDEX "CarrierInvoice_orgId_status_dueDate_idx"
  ON "CarrierInvoice"("orgId", "status", "dueDate");
CREATE INDEX "CarrierInvoice_orgId_carrierId_status_idx"
  ON "CarrierInvoice"("orgId", "carrierId", "status");
