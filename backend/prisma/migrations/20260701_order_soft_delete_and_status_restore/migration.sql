-- Order soft delete (admin-only): retains the row for audit but hides it
-- from every view, distinct from the recoverable `archived` state. Mirrors
-- the Shipment soft-delete migration (20260630_shipment_soft_delete).
ALTER TABLE "Order" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "Order_deletedAt_idx" ON "Order"("deletedAt");

-- Order archival overwrites `status` with 'archived' (unlike Shipment, where
-- archived is a separate boolean that never touches status). Capture the
-- prior status so unarchive can restore it instead of guessing.
ALTER TABLE "Order" ADD COLUMN "statusBeforeArchive" TEXT;
