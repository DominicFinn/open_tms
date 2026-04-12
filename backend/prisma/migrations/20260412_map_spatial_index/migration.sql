-- Composite index on ShipmentReadModel for bounding-box map queries
CREATE INDEX "ShipmentReadModel_currentLat_currentLng_idx" ON "ShipmentReadModel"("currentLat", "currentLng");
