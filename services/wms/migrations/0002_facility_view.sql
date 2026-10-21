-- TRANSITIONAL (ADR 0004). Facility is still created and written by Prisma
-- (backend/prisma/schema/wms.prisma). This view is the .NET read path until the table moves into
-- the wms schema, when it is replaced by a table of the same name and columns with an RLS policy.
--
-- The org filter stands in for that policy. With app.org_id unset, current_setting returns NULL or
-- an empty string, so the view returns nothing: it fails closed. security_barrier stops a caller's
-- predicates being pushed below the filter.
CREATE VIEW wms.facility WITH (security_barrier = true) AS
SELECT
  f.id,
  f."orgId" AS org_id,
  f.name,
  f.code,
  f."sourceLocationId" AS source_location_id,
  f.address1,
  f.address2,
  f.city,
  f.state,
  f."postalCode" AS postal_code,
  f.country,
  f.timezone,
  f.active,
  f.archived,
  f."createdAt" AS created_at,
  f."updatedAt" AS updated_at
FROM public."Facility" f
WHERE f."orgId" = current_setting('app.org_id', true);

GRANT SELECT ON wms.facility TO wms_app;
