-- ============================================================
-- Idempotent migration: creates missing tables and adds
-- missing columns to tables that were partially created
-- via `prisma db push`.
-- ============================================================

-- ── Fix OutboundIntegration: add missing columns ────────────
ALTER TABLE "OutboundIntegration" ADD COLUMN IF NOT EXISTS "integrationType" TEXT NOT NULL DEFAULT 'carrier';
ALTER TABLE "OutboundIntegration" ADD COLUMN IF NOT EXISTS "payloadFormat" TEXT NOT NULL DEFAULT 'edi_856';
ALTER TABLE "OutboundIntegration" ADD COLUMN IF NOT EXISTS "carrierMatch" TEXT;
CREATE INDEX IF NOT EXISTS "OutboundIntegration_active_integrationType_idx" ON "OutboundIntegration"("active", "integrationType");

-- ── EdiPartner ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EdiPartner" (
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
CREATE INDEX IF NOT EXISTS "EdiPartner_customerId_idx" ON "EdiPartner"("customerId");
CREATE INDEX IF NOT EXISTS "EdiPartner_active_idx" ON "EdiPartner"("active");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EdiPartner_customerId_fkey') THEN
    ALTER TABLE "EdiPartner" ADD CONSTRAINT "EdiPartner_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── EdiFile ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EdiFile" (
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
CREATE INDEX IF NOT EXISTS "EdiFile_partnerId_idx" ON "EdiFile"("partnerId");
CREATE INDEX IF NOT EXISTS "EdiFile_status_idx" ON "EdiFile"("status");
CREATE INDEX IF NOT EXISTS "EdiFile_fileHash_idx" ON "EdiFile"("fileHash");
CREATE INDEX IF NOT EXISTS "EdiFile_createdAt_idx" ON "EdiFile"("createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EdiFile_partnerId_fkey') THEN
    ALTER TABLE "EdiFile" ADD CONSTRAINT "EdiFile_partnerId_fkey"
      FOREIGN KEY ("partnerId") REFERENCES "EdiPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── User ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_authProvider_authProviderId_key" ON "User"("authProvider", "authProviderId");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX IF NOT EXISTS "User_customerId_idx" ON "User"("customerId");
CREATE INDEX IF NOT EXISTS "User_active_idx" ON "User"("active");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_organizationId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_customerId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── AuthProvider ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AuthProvider" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "AuthProvider_provider_key" ON "AuthProvider"("provider");

-- ── Role ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name");

-- ── UserRole ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");
CREATE INDEX IF NOT EXISTS "UserRole_userId_idx" ON "UserRole"("userId");
CREATE INDEX IF NOT EXISTS "UserRole_roleId_idx" ON "UserRole"("roleId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRole_userId_fkey') THEN
    ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRole_roleId_fkey') THEN
    ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Session ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── AuditLog FK to User ─────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
