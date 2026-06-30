-- Shipment lifecycle states: draft -> ready -> in_progress -> complete
-- Adds an orthogonal exception flag and migrates the loose legacy status
-- vocabulary onto the canonical 4-state lifecycle.

-- 1. New columns
ALTER TABLE "Shipment" ADD COLUMN "hasException" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShipmentReadModel" ADD COLUMN "hasException" BOOLEAN NOT NULL DEFAULT false;

-- 2. Flag exceptions before remapping status (so we don't lose the signal)
UPDATE "Shipment" SET "hasException" = true WHERE "status" IN ('exception', 'error');
UPDATE "ShipmentReadModel" SET "hasException" = true WHERE "status" IN ('exception', 'error');

-- 3. Remap status onto the canonical lifecycle
--    draft                                              -> draft
--    booked, dispatched, picked_up, in_transit, error,
--    exception                                          -> in_progress
--    delivered                                          -> complete
UPDATE "Shipment"
   SET "status" = 'in_progress'
 WHERE "status" IN ('booked', 'dispatched', 'picked_up', 'in_transit', 'exception', 'error');
UPDATE "Shipment"
   SET "status" = 'complete'
 WHERE "status" = 'delivered';

UPDATE "ShipmentReadModel"
   SET "status" = 'in_progress'
 WHERE "status" IN ('booked', 'dispatched', 'picked_up', 'in_transit', 'exception', 'error');
UPDATE "ShipmentReadModel"
   SET "status" = 'complete'
 WHERE "status" = 'delivered';
