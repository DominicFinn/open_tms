-- EDI Communication Hub: TradingPartner, TradingPartnerTransaction, EdiTransactionLog

-- TradingPartner table (unified replacement for EdiPartner + OutboundIntegration)
CREATE TABLE "TradingPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "entityType" TEXT NOT NULL,
    "customerId" TEXT,
    "carrierId" TEXT,
    -- SFTP connection
    "sftpHost" TEXT,
    "sftpPort" INTEGER NOT NULL DEFAULT 22,
    "sftpUsername" TEXT,
    "sftpPassword" TEXT,
    "sftpPrivateKey" TEXT,
    -- HTTP/API connection
    "httpUrl" TEXT,
    "httpAuthType" TEXT,
    "httpAuthHeader" TEXT,
    "httpAuthValue" TEXT,
    -- EDI envelope
    "senderId" TEXT,
    "receiverId" TEXT,
    "ediVersion" TEXT NOT NULL DEFAULT '005010',
    -- Inbound config
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inboundDir" TEXT NOT NULL DEFAULT '/',
    "inboundFilePattern" TEXT NOT NULL DEFAULT '*.edi,*.x12',
    "pollingInterval" INTEGER NOT NULL DEFAULT 900,
    "pollingCron" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    -- Outbound config
    "outboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outboundDir" TEXT,
    "outboundTransport" TEXT NOT NULL DEFAULT 'sftp',
    "outboundFileNaming" TEXT NOT NULL DEFAULT 'reference',
    -- Legacy migration
    "migratedFromEdiPartnerId" TEXT,
    "migratedFromOutboundIntegrationId" TEXT,
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingPartner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TradingPartner_entityType_idx" ON "TradingPartner"("entityType");
CREATE INDEX "TradingPartner_customerId_idx" ON "TradingPartner"("customerId");
CREATE INDEX "TradingPartner_carrierId_idx" ON "TradingPartner"("carrierId");
CREATE INDEX "TradingPartner_active_idx" ON "TradingPartner"("active");
CREATE INDEX "TradingPartner_inboundEnabled_idx" ON "TradingPartner"("inboundEnabled");
CREATE INDEX "TradingPartner_outboundEnabled_idx" ON "TradingPartner"("outboundEnabled");

ALTER TABLE "TradingPartner" ADD CONSTRAINT "TradingPartner_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TradingPartner" ADD CONSTRAINT "TradingPartner_carrierId_fkey"
    FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TradingPartnerTransaction table (transaction type registry per partner)
CREATE TABLE "TradingPartnerTransaction" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fieldMapping" JSONB,
    "autoProcess" BOOLEAN NOT NULL DEFAULT true,
    "ack997Required" BOOLEAN NOT NULL DEFAULT true,
    "filePattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingPartnerTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradingPartnerTransaction_partnerId_transactionType_direction_key"
    ON "TradingPartnerTransaction"("partnerId", "transactionType", "direction");
CREATE INDEX "TradingPartnerTransaction_partnerId_idx" ON "TradingPartnerTransaction"("partnerId");
CREATE INDEX "TradingPartnerTransaction_transactionType_idx" ON "TradingPartnerTransaction"("transactionType");
CREATE INDEX "TradingPartnerTransaction_direction_idx" ON "TradingPartnerTransaction"("direction");

ALTER TABLE "TradingPartnerTransaction" ADD CONSTRAINT "TradingPartnerTransaction_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "TradingPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EdiTransactionLog table (unified EDI audit log)
CREATE TABLE "EdiTransactionLog" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileContent" TEXT,
    "fileHash" TEXT,
    "transport" TEXT NOT NULL,
    "url" TEXT,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "shipmentId" TEXT,
    "shipmentReference" TEXT,
    "orderId" TEXT,
    "tenderId" TEXT,
    "ack997Sent" BOOLEAN NOT NULL DEFAULT false,
    "ack997Received" BOOLEAN NOT NULL DEFAULT false,
    "ack997LogId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdiTransactionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EdiTransactionLog_partnerId_idx" ON "EdiTransactionLog"("partnerId");
CREATE INDEX "EdiTransactionLog_transactionType_idx" ON "EdiTransactionLog"("transactionType");
CREATE INDEX "EdiTransactionLog_direction_idx" ON "EdiTransactionLog"("direction");
CREATE INDEX "EdiTransactionLog_status_idx" ON "EdiTransactionLog"("status");
CREATE INDEX "EdiTransactionLog_shipmentId_idx" ON "EdiTransactionLog"("shipmentId");
CREATE INDEX "EdiTransactionLog_fileHash_idx" ON "EdiTransactionLog"("fileHash");
CREATE INDEX "EdiTransactionLog_createdAt_idx" ON "EdiTransactionLog"("createdAt");

ALTER TABLE "EdiTransactionLog" ADD CONSTRAINT "EdiTransactionLog_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "TradingPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- DATA MIGRATION: EdiPartner → TradingPartner (inbound 850)
-- ============================================================
INSERT INTO "TradingPartner" (
    "id", "name", "active", "entityType", "customerId",
    "sftpHost", "sftpPort", "sftpUsername", "sftpPassword", "sftpPrivateKey",
    "senderId", "receiverId", "ediVersion",
    "inboundEnabled", "inboundDir", "inboundFilePattern",
    "pollingInterval", "pollingCron", "lastPolledAt",
    "migratedFromEdiPartnerId",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(), ep."name", ep."active", 'customer', ep."customerId",
    ep."sftpHost", ep."sftpPort", ep."sftpUsername", ep."sftpPassword", ep."sftpPrivateKey",
    ep."senderId", ep."receiverId", ep."ediVersion",
    ep."pollingEnabled", ep."sftpRemoteDir", ep."sftpFilePattern",
    ep."pollingInterval", ep."pollingCron", ep."lastPolledAt",
    ep."id",
    ep."createdAt", ep."updatedAt"
FROM "EdiPartner" ep;

-- Create inbound 850 transaction for each migrated partner
INSERT INTO "TradingPartnerTransaction" (
    "id", "partnerId", "transactionType", "direction", "enabled",
    "fieldMapping", "autoProcess", "filePattern",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(), tp."id", '850', 'inbound', true,
    ep."fieldMapping", ep."autoCreateOrders", ep."sftpFilePattern",
    tp."createdAt", tp."updatedAt"
FROM "TradingPartner" tp
JOIN "EdiPartner" ep ON tp."migratedFromEdiPartnerId" = ep."id";

-- ============================================================
-- DATA MIGRATION: OutboundIntegration → TradingPartner (outbound 856)
-- ============================================================
INSERT INTO "TradingPartner" (
    "id", "name", "active", "entityType",
    "httpUrl", "httpAuthType", "httpAuthHeader", "httpAuthValue",
    "senderId", "receiverId",
    "outboundEnabled", "outboundTransport",
    "migratedFromOutboundIntegrationId",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(), oi."name", oi."active",
    CASE WHEN oi."integrationType" = 'carrier' THEN 'carrier' ELSE 'other' END,
    oi."url", oi."authType", oi."authHeader", oi."authValue",
    oi."senderId", oi."receiverId",
    true, 'http',
    oi."id",
    oi."createdAt", oi."updatedAt"
FROM "OutboundIntegration" oi;

-- Create outbound 856 transaction for each migrated outbound integration
INSERT INTO "TradingPartnerTransaction" (
    "id", "partnerId", "transactionType", "direction", "enabled",
    "autoProcess",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(), tp."id",
    CASE WHEN oi."payloadFormat" = 'json' THEN '856_JSON' ELSE '856' END,
    'outbound', true, true,
    tp."createdAt", tp."updatedAt"
FROM "TradingPartner" tp
JOIN "OutboundIntegration" oi ON tp."migratedFromOutboundIntegrationId" = oi."id";
