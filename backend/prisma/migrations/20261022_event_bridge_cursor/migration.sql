-- Where the event bridge relay has read up to in each outbox on the other stack (ADR 0006).

-- CreateTable
CREATE TABLE "EventBridgeCursor" (
    "name" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "position" BIGINT NOT NULL,
    "relayedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventBridgeCursor_pkey" PRIMARY KEY ("name")
);

