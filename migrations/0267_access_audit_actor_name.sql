-- Additive only: legacy names are deliberately NOT backfilled from today's
-- master data. Their historical correctness cannot be established that way.
-- Preflight must finish before this file enters the watched migration directory.
-- Do not drop this column after capture begins: that would destroy audit facts.
BEGIN;
ALTER TABLE adm_access_control_audit
  ADD COLUMN IF NOT EXISTS actor_display_name text;
COMMENT ON COLUMN adm_access_control_audit.actor_display_name IS
  'Server-derived actor name frozen at capture; NULL for legacy or unnamed actors. No historical backfill.';
COMMIT;
