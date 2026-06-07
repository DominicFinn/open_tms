-- Add visibility flag to Comment so customer portal can show internal comments only when
-- the author opted in. Backfill: customer-authored comments are always visible to the
-- customer (they wrote them); internal comments default to false (not visible).

ALTER TABLE "Comment"
  ADD COLUMN "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Comment"
  SET "visibleToCustomer" = true
  WHERE "authorType" = 'customer';

CREATE INDEX "Comment_entityType_entityId_visibleToCustomer_idx"
  ON "Comment"("entityType", "entityId", "visibleToCustomer");
