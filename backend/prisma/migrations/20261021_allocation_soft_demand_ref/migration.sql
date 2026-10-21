-- Allocation references its demand softly (#358, split step 2c). Stock must not hold a foreign key
-- into the system that created the demand: the WMS tables leave Prisma for the .NET service
-- (ADR 0005), and a standalone FinnWMS has demand from EDI 940, the API and manifests as well as
-- TMS orders.
--
-- Every existing row came from a TMS order line, since orderLineItemId was a required FK to
-- OrderLineItem, so the backfill is tms_order plus that line id.

ALTER TABLE "Allocation" ADD COLUMN "demandType" TEXT, ADD COLUMN "demandId" TEXT;

UPDATE "Allocation" SET "demandType" = 'tms_order', "demandId" = "orderLineItemId";

ALTER TABLE "Allocation" ALTER COLUMN "demandType" SET NOT NULL, ALTER COLUMN "demandId" SET NOT NULL;

ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_orderLineItemId_fkey";

-- The new index replaces the old one rather than adding to the budget.
DROP INDEX "Allocation_orderLineItemId_idx";

ALTER TABLE "Allocation" DROP COLUMN "orderLineItemId";

CREATE INDEX "Allocation_demandType_demandId_idx" ON "Allocation"("demandType", "demandId");
