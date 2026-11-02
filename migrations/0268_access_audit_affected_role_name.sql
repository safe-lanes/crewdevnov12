-- Prepared only after the read-only preflight passed. Additive; no backfill.
-- Existing audit entries retain their live-name fallback.
-- Dropping this column after capture begins destroys historical name evidence.
BEGIN;
ALTER TABLE adm_access_control_audit
  ADD COLUMN IF NOT EXISTS affected_role_name text;
COMMENT ON COLUMN adm_access_control_audit.affected_role_name IS
  'Server-derived affected role name frozen at capture; NULL for legacy entries or events without an affected role. No backfill.';
COMMIT;
