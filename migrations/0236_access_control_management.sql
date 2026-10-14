-- Existing rows are the legacy parent mirror. New local rows are not parent principals.
ALTER TABLE adm_rolemaster_ac ADD COLUMN IF NOT EXISTS parent_owned boolean NOT NULL DEFAULT true;
ALTER TABLE adm_rolemaster_ac ALTER COLUMN parent_owned SET DEFAULT false;
INSERT INTO adm_permission_actions(resource,action,label,sort_order)
VALUES ('access_control','manage','Manage Access Control',1)
ON CONFLICT (resource,action) DO NOTHING;
CREATE TABLE IF NOT EXISTS adm_access_control_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  category_ready boolean NOT NULL DEFAULT false,
  category_established_at timestamptz,
  category_evidence jsonb
);
INSERT INTO adm_access_control_state(singleton) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS adm_access_control_audit (
  id bigserial PRIMARY KEY,
  event text NOT NULL,
  actor jsonb NOT NULL,
  role_id text,
  resource text NOT NULL,
  action text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  details jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS adm_access_control_audit_role ON adm_access_control_audit(role_id,id DESC);
CREATE OR REPLACE FUNCTION adm_access_control_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Access Control audit history is append-only'; END $$;
DROP TRIGGER IF EXISTS adm_access_control_audit_immutable ON adm_access_control_audit;
CREATE TRIGGER adm_access_control_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
ON adm_access_control_audit FOR EACH STATEMENT EXECUTE FUNCTION adm_access_control_audit_immutable();
