-- Shipment soft delete (admin-only): retains the row for audit but hides it
-- from every view, distinct from the recoverable `archived` state.
ALTER TABLE "Shipment" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "Shipment_deletedAt_idx" ON "Shipment"("deletedAt");
