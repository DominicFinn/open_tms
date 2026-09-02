-- Shipment share links (#155)
--
-- Replaces the deterministic HMAC tracking token in publicTracking.ts, which could not be
-- revoked, could not expire, carried no access code, and left no record of who opened it.
--
-- Table roles:
--   ShipmentShareLink   — authoritative mutable. Created, edited and revoked by an operator;
--                         the access counters are contended by concurrent viewers, so every
--                         mutation runs through a command handler inside a transaction.
--   ShipmentShareAccess — ledger, append-only. One row per attempt to open a link, granted or
--                         denied. Never updated. Holds the viewer's email as consented audit
--                         data, which must not be copied into logs, events, or broadcasts.

CREATE TABLE IF NOT EXISTS "ShipmentShareLink" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "shipmentId"     TEXT NOT NULL,
  "tokenHash"      TEXT NOT NULL,
  "accessCodeHash" TEXT NOT NULL,
  "label"          TEXT,
  "sections"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "revokedAt"      TIMESTAMP(3),
  "revokedBy"      TEXT,
  "createdBy"      TEXT NOT NULL,
  "accessCount"    INTEGER NOT NULL DEFAULT 0,
  "lastAccessedAt" TIMESTAMP(3),
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShipmentShareLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShipmentShareAccess" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "shareLinkId" TEXT NOT NULL,
  "shipmentId"  TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "ipHash"      TEXT,
  "outcome"     TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentShareAccess_pkey" PRIMARY KEY ("id")
);

-- Correctness constraint, exempt from the index budget: the token is the credential, so the
-- lookup must be a unique hash probe. The plaintext token is never stored.
CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentShareLink_tokenHash_key"
  ON "ShipmentShareLink"("tokenHash");

-- Serves ShipmentShareLinkRepository.listForShipment(orgId, shipmentId) — the admin
-- "Shared links" tab. No existing index covers it, because the table is new. One secondary
-- index on the table, well inside budget. orgId leads so a cross-tenant read cannot be served.
CREATE INDEX IF NOT EXISTS "ShipmentShareLink_orgId_shipmentId_createdAt_idx"
  ON "ShipmentShareLink"("orgId", "shipmentId", "createdAt");

-- Serves ShipmentShareAccessRepository.listForLink(shareLinkId) — the per-link access log,
-- newest first. Ledger table, so it gets one index and nothing more.
CREATE INDEX IF NOT EXISTS "ShipmentShareAccess_shareLinkId_createdAt_idx"
  ON "ShipmentShareAccess"("shareLinkId", "createdAt");

ALTER TABLE "ShipmentShareLink"
  ADD CONSTRAINT "ShipmentShareLink_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShipmentShareAccess"
  ADD CONSTRAINT "ShipmentShareAccess_shareLinkId_fkey"
  FOREIGN KEY ("shareLinkId") REFERENCES "ShipmentShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
