-- Shared secret for verifying inbound IoT webhook signatures (HMAC-SHA256).
ALTER TABLE "IotVendor" ADD COLUMN "webhookSecret" TEXT;
