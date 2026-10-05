-- Stops that are neither pickups nor drops (#345): stopType 'other' with a purpose and an optional
-- name, on shipment stops and on the consolidation stops that serve them. No index change.

-- AlterTable
ALTER TABLE "ConsolidationStop" ADD COLUMN     "label" TEXT,
ADD COLUMN     "purpose" TEXT;

-- AlterTable
ALTER TABLE "ShipmentStop" ADD COLUMN     "label" TEXT,
ADD COLUMN     "purpose" TEXT;

