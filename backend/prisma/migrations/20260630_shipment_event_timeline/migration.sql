-- Shipment event timeline: platform-generated, filterable timeline entries.
ALTER TABLE "ShipmentEvent" ADD COLUMN "description" TEXT;
ALTER TABLE "ShipmentEvent" ADD COLUMN "source" TEXT;
ALTER TABLE "ShipmentEvent" ADD COLUMN "sourceEventId" TEXT;
CREATE INDEX "ShipmentEvent_eventType_idx" ON "ShipmentEvent"("eventType");
CREATE INDEX "ShipmentEvent_sourceEventId_idx" ON "ShipmentEvent"("sourceEventId");
