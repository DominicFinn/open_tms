-- Returns / RMA (Return Merchandise Authorization)

CREATE TABLE IF NOT EXISTS "Rma" (
    "id" TEXT NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "returnReason" TEXT NOT NULL,
    "customerNotes" TEXT,
    "rejectionNotes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "suggestedRefundCents" INTEGER NOT NULL DEFAULT 0,
    "actualRefundCents" INTEGER,
    "refundAdjustmentNotes" TEXT,
    "creditNoteId" TEXT,
    "returnLabelUrl" TEXT,
    "returnTrackingNumber" TEXT,
    "createdByUserId" TEXT,
    "initiatedVia" TEXT NOT NULL DEFAULT 'admin',
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Rma_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Rma_orgId_rmaNumber_key" ON "Rma"("orgId", "rmaNumber");
CREATE INDEX IF NOT EXISTS "Rma_orgId_idx" ON "Rma"("orgId");
CREATE INDEX IF NOT EXISTS "Rma_customerId_idx" ON "Rma"("customerId");
CREATE INDEX IF NOT EXISTS "Rma_orderId_idx" ON "Rma"("orderId");
CREATE INDEX IF NOT EXISTS "Rma_status_idx" ON "Rma"("status");

CREATE TABLE IF NOT EXISTS "RmaLine" (
    "id" TEXT NOT NULL,
    "rmaId" TEXT NOT NULL,
    "orderLineItemId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "requestedDisposition" TEXT,
    "disposition" TEXT NOT NULL DEFAULT 'pending',
    "inspectionStatus" TEXT NOT NULL DEFAULT 'pending',
    "inspectionNotes" TEXT,
    "conditionPhotos" JSONB,
    "inspectedByUserId" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "refundAmountCents" INTEGER NOT NULL DEFAULT 0,
    "trackableUnitId" TEXT,
    "currentBinId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RmaLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RmaLine_rmaId_idx" ON "RmaLine"("rmaId");
CREATE INDEX IF NOT EXISTS "RmaLine_orderLineItemId_idx" ON "RmaLine"("orderLineItemId");
CREATE INDEX IF NOT EXISTS "RmaLine_disposition_idx" ON "RmaLine"("disposition");
CREATE INDEX IF NOT EXISTS "RmaLine_inspectionStatus_idx" ON "RmaLine"("inspectionStatus");

ALTER TABLE "RmaLine" ADD CONSTRAINT "RmaLine_rmaId_fkey" FOREIGN KEY ("rmaId") REFERENCES "Rma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
