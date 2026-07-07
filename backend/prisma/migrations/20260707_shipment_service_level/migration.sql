-- Adds a real transport-mode field to Shipment ("FTL" or "LTL"), distinct
-- from shipmentTypeId (which drives physical restrictions like temp/hazmat).
-- The create-shipment UI's "Mode" dropdown previously wrote nowhere; a demo
-- seed script also mistakenly modeled "LTL" as a ShipmentType, which this
-- column replaces as the correct home for that data.

ALTER TABLE "Shipment"
  ADD COLUMN "serviceLevel" TEXT;
