-- The role every query runs as. The service connects with a login role and switches to wms_app
-- inside each transaction (SET LOCAL ROLE, see TenantSession), so row-level security applies to
-- everything it runs. wms_app owns nothing, so it never bypasses a policy.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wms_app') THEN
    CREATE ROLE wms_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA wms TO wms_app;

-- The login role has to be a member to SET ROLE. Where the service logs in as a different role
-- from the one running migrations, grant it there: GRANT wms_app TO <login role>.
GRANT wms_app TO CURRENT_USER;
