-- Additive, following 0267/0268. Prepared outside the migration directory
-- until read-only preflight passed. No UPDATE, DELETE or historical backfill.
-- Legacy NULL labels use the current server display-label lookup.
-- Rollback: dropping this column after capture starts destroys audit evidence.
BEGIN;
ALTER TABLE adm_access_control_audit
  ADD COLUMN IF NOT EXISTS permission_display_label text;
COMMENT ON COLUMN adm_access_control_audit.permission_display_label IS
  'Server-derived permission display label frozen at capture; NULL for legacy entries. No historical backfill.';
COMMIT;
