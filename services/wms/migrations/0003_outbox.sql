-- The .NET to Node event outbox (ADR 0006).
--
-- A command writes its events here in the same transaction as its change. The Node relay reads rows
-- whose transaction is older than the oldest one still running, ordered by (tx_id, position), so a
-- row that commits late can never fall behind its cursor. id is the event id, which is also the
-- primary key of Node's DomainEventLog, so a relayed row can't be logged twice.
CREATE TABLE wms.outbox (
  position     bigserial PRIMARY KEY,
  tx_id        xid8 NOT NULL DEFAULT pg_current_xact_id(),
  id           text NOT NULL UNIQUE,
  type         text NOT NULL,
  org_id       text NOT NULL,
  actor_id     text,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  payload      jsonb NOT NULL,
  metadata     jsonb NOT NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_tx_id_position ON wms.outbox (tx_id, position);

-- Commands write as wms_app, only for the org of their session.
ALTER TABLE wms.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms.outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_write_own_org ON wms.outbox FOR INSERT TO wms_app
  WITH CHECK (org_id = current_setting('app.org_id', true));
GRANT INSERT ON wms.outbox TO wms_app;
GRANT USAGE ON SEQUENCE wms.outbox_position_seq TO wms_app;

-- The Node relay reads every org's rows. Grant this role to the login role the Node worker uses.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wms_outbox_reader') THEN
    CREATE ROLE wms_outbox_reader NOLOGIN;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA wms TO wms_outbox_reader;
GRANT SELECT ON wms.outbox TO wms_outbox_reader;
CREATE POLICY outbox_relay_reads_all ON wms.outbox FOR SELECT TO wms_outbox_reader USING (true);
