-- Shared secret for verifying inbound IoT webhook signatures (HMAC-SHA256).
-- Guarded because 20260630_iot_vendors already creates IotVendor with this column;
-- without the guard the chain cannot be replayed on an empty database.
ALTER TABLE "IotVendor" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;
