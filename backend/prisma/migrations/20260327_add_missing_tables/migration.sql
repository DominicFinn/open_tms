-- CreateTable: ApiKey
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_active_idx" ON "ApiKey"("active");
CREATE INDEX "ApiKey_createdAt_idx" ON "ApiKey"("createdAt");

-- CreateTable: WebhookLog
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "headers" JSONB,
    "deviceName" TEXT,
    "deviceId" TEXT,
    "eventType" TEXT,
    "hasLocation" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "rawPayload" JSONB,
    "status" TEXT NOT NULL,
    "shipmentFound" BOOLEAN NOT NULL DEFAULT false,
    "shipmentUpdated" BOOLEAN NOT NULL DEFAULT false,
    "shipmentId" TEXT,
    "shipmentReference" TEXT,
    "shipmentEventId" TEXT,
    "errorMessage" TEXT,
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookLog_apiKeyId_idx" ON "WebhookLog"("apiKeyId");
CREATE INDEX "WebhookLog_status_idx" ON "WebhookLog"("status");
CREATE INDEX "WebhookLog_shipmentId_idx" ON "WebhookLog"("shipmentId");
CREATE INDEX "WebhookLog_receivedAt_idx" ON "WebhookLog"("receivedAt");
CREATE INDEX "WebhookLog_deviceName_idx" ON "WebhookLog"("deviceName");

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: OutboundIntegration
CREATE TABLE "OutboundIntegration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "senderId" TEXT,
    "receiverId" TEXT,
    "interchangeControlNumber" TEXT,
    "integrationType" TEXT NOT NULL DEFAULT 'carrier',
    "payloadFormat" TEXT NOT NULL DEFAULT 'edi_856',
    "carrierMatch" TEXT,
    "authType" TEXT,
    "authHeader" TEXT,
    "authValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundIntegration_active_idx" ON "OutboundIntegration"("active");
CREATE INDEX "OutboundIntegration_active_integrationType_idx" ON "OutboundIntegration"("active", "integrationType");
CREATE INDEX "OutboundIntegration_createdAt_idx" ON "OutboundIntegration"("createdAt");

-- CreateTable: OutboundIntegrationLog
CREATE TABLE "OutboundIntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "shipmentReference" TEXT,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "headers" JSONB,
    "ediPayload" TEXT,
    "payloadSize" INTEGER,
    "status" TEXT NOT NULL,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "responseHeaders" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "OutboundIntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundIntegrationLog_integrationId_idx" ON "OutboundIntegrationLog"("integrationId");
CREATE INDEX "OutboundIntegrationLog_shipmentId_idx" ON "OutboundIntegrationLog"("shipmentId");
CREATE INDEX "OutboundIntegrationLog_shipmentReference_idx" ON "OutboundIntegrationLog"("shipmentReference");
CREATE INDEX "OutboundIntegrationLog_status_idx" ON "OutboundIntegrationLog"("status");
CREATE INDEX "OutboundIntegrationLog_sentAt_idx" ON "OutboundIntegrationLog"("sentAt");

-- AddForeignKey
ALTER TABLE "OutboundIntegrationLog" ADD CONSTRAINT "OutboundIntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "OutboundIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundIntegrationLog" ADD CONSTRAINT "OutboundIntegrationLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: EdiPartner
CREATE TABLE "EdiPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "customerId" TEXT NOT NULL,
    "sftpHost" TEXT,
    "sftpPort" INTEGER NOT NULL DEFAULT 22,
    "sftpUsername" TEXT,
    "sftpPassword" TEXT,
    "sftpPrivateKey" TEXT,
    "sftpRemoteDir" TEXT NOT NULL DEFAULT '/',
    "sftpFilePattern" TEXT NOT NULL DEFAULT '*.edi,*.x12,*.850',
    "pollingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pollingInterval" INTEGER NOT NULL DEFAULT 900,
    "pollingCron" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "senderId" TEXT,
    "receiverId" TEXT,
    "ediVersion" TEXT NOT NULL DEFAULT '005010',
    "autoCreateOrders" BOOLEAN NOT NULL DEFAULT true,
    "autoAssignShipments" BOOLEAN NOT NULL DEFAULT false,
    "fieldMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdiPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EdiPartner_customerId_idx" ON "EdiPartner"("customerId");
CREATE INDEX "EdiPartner_active_idx" ON "EdiPartner"("active");

-- AddForeignKey
ALTER TABLE "EdiPartner" ADD CONSTRAINT "EdiPartner_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: EdiFile
CREATE TABLE "EdiFile" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileContent" TEXT NOT NULL,
    "fileHash" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "parsedData" JSONB,
    "transactionType" TEXT,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "ordersCreated" INTEGER NOT NULL DEFAULT 0,
    "orderIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdiFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EdiFile_partnerId_idx" ON "EdiFile"("partnerId");
CREATE INDEX "EdiFile_status_idx" ON "EdiFile"("status");
CREATE INDEX "EdiFile_fileHash_idx" ON "EdiFile"("fileHash");
CREATE INDEX "EdiFile_createdAt_idx" ON "EdiFile"("createdAt");

-- AddForeignKey
ALTER TABLE "EdiFile" ADD CONSTRAINT "EdiFile_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "EdiPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "authProvider" TEXT,
    "authProviderId" TEXT,
    "organizationId" TEXT,
    "customerId" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weightUnit" TEXT,
    "dimUnit" TEXT,
    "temperatureUnit" TEXT,
    "distanceUnit" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_authProvider_authProviderId_key" ON "User"("authProvider", "authProviderId");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "User_customerId_idx" ON "User"("customerId");
CREATE INDEX "User_active_idx" ON "User"("active");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: AuthProvider
CREATE TABLE "AuthProvider" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "tenantId" TEXT,
    "allowedDomains" JSONB,
    "autoCreateUsers" BOOLEAN NOT NULL DEFAULT true,
    "defaultRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthProvider_provider_key" ON "AuthProvider"("provider");

-- CreateTable: Role
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateTable: UserRole
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Session
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AuditLog.userId -> User.id (was missing because User table didn't exist)
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
