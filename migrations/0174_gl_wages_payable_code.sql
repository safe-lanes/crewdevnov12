-- Migration 0165: GL wages-payable code on tenant config.
--
-- The GL DR/CR export (Reports layer) posts the month's net payable on board
-- as a CR to a balancing "wages payable" liability account. That account code
-- is client-specific, so it lives on the tenant config row. Nullable — when
-- unset, the export shows the balancing row under UNMAPPED with a warning.
--
-- Idempotent and safe to re-run.

ALTER TABLE acc_tenant_config_v2
  ADD COLUMN IF NOT EXISTS gl_wages_payable_code text;
