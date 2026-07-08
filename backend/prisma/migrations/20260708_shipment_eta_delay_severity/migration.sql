-- ETA-delay recovery tracking: last delay severity so the monitor can detect the
-- delay -> on-time edge and emit tracking.eta_recovered.
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "lastEtaDelaySeverity" TEXT;
