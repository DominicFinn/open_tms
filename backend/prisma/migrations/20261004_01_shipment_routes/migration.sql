-- #328: a shipment on a custom route (no lane) gets its own planned road route, calculated from its
-- stops, so checkpoints, route deviation and the map work for it as they do for lane shipments.
--
-- Table role: reference. One row per custom-route shipment, rewritten when its stops change.
-- Index budget: only the unique shipmentId index, which exists for correctness (one route per
-- shipment) and serves every lookup. No orgId index: rows are always read by shipmentId.
-- No backfill: existing custom-route shipments get a route the next time they are updated while
-- draft or ready.

CREATE TABLE "ShipmentRoute" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "encodedPolyline" TEXT NOT NULL,
    "waypoints" JSONB NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "summary" TEXT,
    "corridorMeters" INTEGER NOT NULL DEFAULT 5000,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "stopsKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShipmentRoute_shipmentId_key" ON "ShipmentRoute"("shipmentId");

ALTER TABLE "ShipmentRoute" ADD CONSTRAINT "ShipmentRoute_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
