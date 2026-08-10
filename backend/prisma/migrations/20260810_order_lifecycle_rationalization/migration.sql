-- Order lifecycle rationalization.
--
-- Order.status collapses from 8 real-world values down to 6:
--   validated                    -> verified   (renamed; "verified" now names what
--                                                the field always meant: locations
--                                                attached, not necessarily address-checked)
--   location_error, pending_lane -> issue       (both were "an automatic step failed to
--                                                progress this order" — verification
--                                                failure and no-matching-lane respectively.
--                                                Each pairs with a real Issue/Triage row
--                                                carrying the detail; see application code)
--   converted                    -> assigned    (unifies the two previously-separate
--                                                "linked to a shipment" outcomes: manual
--                                                conversion wrote 'converted', the
--                                                auto-lane-match path wrote 'assigned'.
--                                                Provenance now lives in AuditLog, not a
--                                                second status value)
--   pending, cancelled, archived  -> unchanged
--
-- Order.deliveryStatus drops 'unassigned'/'assigned'/'cancelled' as values — all three
-- were redundant with Order.status (pending/verified = not yet assigned; assigned =
-- order.status already says so; cancelled lives on order.status only). The column
-- becomes nullable: null until the order is actually moving, then one of
-- in_transit / delivered / exception.
--
-- Constraint drops must run BEFORE the data remap sets values to NULL.

ALTER TABLE "Order" ALTER COLUMN "deliveryStatus" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "deliveryStatus" DROP DEFAULT;

UPDATE "Order" SET status = 'verified' WHERE status = 'validated';
UPDATE "Order" SET status = 'issue' WHERE status IN ('location_error', 'pending_lane');
UPDATE "Order" SET status = 'assigned' WHERE status = 'converted';

UPDATE "Order" SET "deliveryStatus" = NULL WHERE "deliveryStatus" IN ('unassigned', 'assigned', 'cancelled');

-- OrderReadModel is denormalized (event-projected), not kept in sync by this
-- migration automatically — apply the same remap directly since we're not
-- replaying history.
ALTER TABLE "OrderReadModel" ALTER COLUMN "deliveryStatus" DROP NOT NULL;

UPDATE "OrderReadModel" SET status = 'verified' WHERE status = 'validated';
UPDATE "OrderReadModel" SET status = 'issue' WHERE status IN ('location_error', 'pending_lane');
UPDATE "OrderReadModel" SET status = 'assigned' WHERE status = 'converted';

UPDATE "OrderReadModel" SET "deliveryStatus" = NULL WHERE "deliveryStatus" IN ('unassigned', 'assigned', 'cancelled');
