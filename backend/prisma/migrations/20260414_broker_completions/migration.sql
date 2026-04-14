-- Broker completions: target margin, commission tracking, carrier quick pay

-- Customer: target margin
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "targetMarginPercent" DECIMAL(5,2);

-- LaneCarrier: target margin
ALTER TABLE "LaneCarrier" ADD COLUMN IF NOT EXISTS "targetMarginPercent" DECIMAL(5,2);

-- CarrierInvoice: quick pay / factoring
ALTER TABLE "CarrierInvoice" ADD COLUMN IF NOT EXISTS "quickPayRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CarrierInvoice" ADD COLUMN IF NOT EXISTS "quickPayDiscountPct" DECIMAL(5,2);
ALTER TABLE "CarrierInvoice" ADD COLUMN IF NOT EXISTS "quickPayDiscountCents" INTEGER;
ALTER TABLE "CarrierInvoice" ADD COLUMN IF NOT EXISTS "quickPayDueDate" TIMESTAMP(3);

-- Commission tracking
CREATE TABLE IF NOT EXISTS "Commission" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "basisType" TEXT NOT NULL DEFAULT 'margin',
    "basisAmountCents" INTEGER NOT NULL,
    "commissionPercent" DECIMAL(5,2) NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'accrued',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Commission_orgId_idx" ON "Commission"("orgId");
CREATE INDEX IF NOT EXISTS "Commission_userId_idx" ON "Commission"("userId");
CREATE INDEX IF NOT EXISTS "Commission_shipmentId_idx" ON "Commission"("shipmentId");
CREATE INDEX IF NOT EXISTS "Commission_status_idx" ON "Commission"("status");

ALTER TABLE "Commission" DROP CONSTRAINT IF EXISTS "Commission_userId_fkey";
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Commission" DROP CONSTRAINT IF EXISTS "Commission_shipmentId_fkey";
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
