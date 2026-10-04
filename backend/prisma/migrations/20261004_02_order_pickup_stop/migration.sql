-- #329: an order links to the stop it's collected at as well as the one it's delivered to, so a
-- shipment can have several pickups (a milk run) and each pickup's orders go in transit when the
-- vehicle leaves that pickup.
--
-- Table role: Order is authoritative. Index budget: no new index; Order is already well over budget.
-- Orders are only ever looked up by pickup stop within one shipment, and that query is served by the
-- OrderShipment(shipmentId) index. No backfill: a null pickupStopId means the shipment's first
-- pickup stop, which is what every existing order was collected at.

ALTER TABLE "Order" ADD COLUMN "pickupStopId" TEXT;

ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupStopId_fkey" FOREIGN KEY ("pickupStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
