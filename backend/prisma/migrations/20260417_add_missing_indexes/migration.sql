-- Add missing indexes to core tables
-- Shipment and Order have zero indexes despite being the most queried tables

-- ── Shipment indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Shipment_customerId_idx" ON "Shipment"("customerId");
CREATE INDEX IF NOT EXISTS "Shipment_status_idx" ON "Shipment"("status");
CREATE INDEX IF NOT EXISTS "Shipment_originId_idx" ON "Shipment"("originId");
CREATE INDEX IF NOT EXISTS "Shipment_destinationId_idx" ON "Shipment"("destinationId");
CREATE INDEX IF NOT EXISTS "Shipment_carrierId_idx" ON "Shipment"("carrierId");
CREATE INDEX IF NOT EXISTS "Shipment_laneId_idx" ON "Shipment"("laneId");
CREATE INDEX IF NOT EXISTS "Shipment_archived_idx" ON "Shipment"("archived");
CREATE INDEX IF NOT EXISTS "Shipment_createdAt_idx" ON "Shipment"("createdAt");
CREATE INDEX IF NOT EXISTS "Shipment_reference_idx" ON "Shipment"("reference");
CREATE INDEX IF NOT EXISTS "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");
-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "Shipment_status_archived_idx" ON "Shipment"("status", "archived");
CREATE INDEX IF NOT EXISTS "Shipment_customerId_status_idx" ON "Shipment"("customerId", "status");
CREATE INDEX IF NOT EXISTS "Shipment_originId_archived_status_idx" ON "Shipment"("originId", "archived", "status");
CREATE INDEX IF NOT EXISTS "Shipment_destinationId_archived_status_idx" ON "Shipment"("destinationId", "archived", "status");

-- ── Order indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_archived_idx" ON "Order"("archived");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX IF NOT EXISTS "Order_deliveryStatus_idx" ON "Order"("deliveryStatus");
CREATE INDEX IF NOT EXISTS "Order_originId_idx" ON "Order"("originId");
CREATE INDEX IF NOT EXISTS "Order_destinationId_idx" ON "Order"("destinationId");
-- Composite indexes
CREATE INDEX IF NOT EXISTS "Order_status_archived_idx" ON "Order"("status", "archived");
CREATE INDEX IF NOT EXISTS "Order_customerId_archived_idx" ON "Order"("customerId", "archived");

-- ── Load indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Load_shipmentId_idx" ON "Load"("shipmentId");
CREATE INDEX IF NOT EXISTS "Load_vehicleId_idx" ON "Load"("vehicleId");
CREATE INDEX IF NOT EXISTS "Load_driverId_idx" ON "Load"("driverId");

-- ── OrderLineItem indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "OrderLineItem_orderId_idx" ON "OrderLineItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderLineItem_sku_idx" ON "OrderLineItem"("sku");

-- ── OrderShipment indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "OrderShipment_orderId_idx" ON "OrderShipment"("orderId");
CREATE INDEX IF NOT EXISTS "OrderShipment_shipmentId_idx" ON "OrderShipment"("shipmentId");

-- ── Vehicle / Driver indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Vehicle_carrierId_idx" ON "Vehicle"("carrierId");
CREATE INDEX IF NOT EXISTS "Driver_carrierId_idx" ON "Driver"("carrierId");

-- ── Lane relationship indexes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "LaneCarrier_laneId_idx" ON "LaneCarrier"("laneId");
CREATE INDEX IF NOT EXISTS "LaneCarrier_carrierId_idx" ON "LaneCarrier"("carrierId");
CREATE INDEX IF NOT EXISTS "CustomerLane_customerId_idx" ON "CustomerLane"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerLane_laneId_idx" ON "CustomerLane"("laneId");
CREATE INDEX IF NOT EXISTS "LaneStop_laneId_idx" ON "LaneStop"("laneId");
CREATE INDEX IF NOT EXISTS "LaneStop_locationId_idx" ON "LaneStop"("locationId");

-- ── Financial composite indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Charge_shipmentId_chargeCategory_idx" ON "Charge"("shipmentId", "chargeCategory");
CREATE INDEX IF NOT EXISTS "Invoice_orgId_status_dueDate_idx" ON "Invoice"("orgId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "CarrierInvoice_orgId_status_idx" ON "CarrierInvoice"("orgId", "status");
