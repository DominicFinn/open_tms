-- WMS commands read their own data, not TMS tables (#359).
--
-- WmsFulfilmentOrderLine gains the source line's dimensions, so cartonisation can fall back to them
-- without reading OrderLineItem, and an index on (orgId, sourceLineId) for the two places that find
-- a line by its source id (cartonisation and receiving's cross-dock). Manifest uploads become a
-- warehouse intake: their tables move to WMS ownership and the FK to Location goes, leaving
-- locationId as a soft reference.

-- DropForeignKey
ALTER TABLE "ManifestUpload" DROP CONSTRAINT "ManifestUpload_locationId_fkey";

-- AlterTable
ALTER TABLE "WmsFulfilmentOrderLine" ADD COLUMN     "dimUnit" TEXT NOT NULL DEFAULT 'cm',
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "weightUnit" TEXT NOT NULL DEFAULT 'kg',
ADD COLUMN     "width" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "WmsFulfilmentOrderLine_orgId_sourceLineId_idx" ON "WmsFulfilmentOrderLine"("orgId", "sourceLineId");


-- Copy dimensions from the source order lines, matched within each row's own org. The projection
-- keeps them current from here; `--only=wmsFulfilmentOrders` rebuilds them from scratch.
UPDATE "WmsFulfilmentOrderLine" l SET
    "length" = li."length",
    "width" = li."width",
    "height" = li."height",
    "dimUnit" = li."dimUnit",
    "weightUnit" = li."weightUnit"
FROM "OrderLineItem" li
JOIN "Order" o ON o."id" = li."orderId"
WHERE li."id" = l."sourceLineId" AND o."orgId" = l."orgId";

-- Manifest uploads carry their facility like every other warehouse model (#285), derived from the
-- upload's Location within its own org.
ALTER TABLE "ManifestUpload" ADD COLUMN "facilityId" TEXT;
ALTER TABLE "ManifestUpload" ADD CONSTRAINT "ManifestUpload_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "ManifestUpload" m SET "facilityId" = f."id"
FROM "Facility" f
WHERE f."orgId" = m."orgId" AND f."sourceLocationId" = m."locationId";
