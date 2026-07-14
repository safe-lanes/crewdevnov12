-- ============================================================================
-- Migration 0156: Accounts wage-calculation engine prep.
--
-- NOTE: the engine spec names this migration 0155, but
-- 0155_accounts_rbac_reconcile.sql already exists, so the next free number
-- (0156) is used. Content matches the spec's "Migration 0155 (small)".
--
-- 1. acc_tenant_config_v2.day_inclusion_rule — whether the sign-off day is a
--    paid day. Default 'both_inclusive': sign-on AND sign-off days are paid.
-- 2. acc_wage_ledger_v2.payment_timing — snapshot of the pay element's
--    payment timing on every ledger line (paid_on_board /
--    payable_at_settlement / remitted_to_fund).
--
-- Conventions follow 0153/0154: idempotent (ADD COLUMN IF NOT EXISTS, guarded
-- CHECK constraints via pg_constraint lookup); safe on empty fresh tenant DBs.
-- ============================================================================

ALTER TABLE acc_tenant_config_v2
  ADD COLUMN IF NOT EXISTS day_inclusion_rule TEXT NOT NULL DEFAULT 'both_inclusive';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acc_tenant_config_v2_day_inclusion_rule') THEN
    ALTER TABLE acc_tenant_config_v2
      ADD CONSTRAINT chk_acc_tenant_config_v2_day_inclusion_rule
      CHECK (day_inclusion_rule IN ('both_inclusive', 'exclude_sign_off_day'));
  END IF;
END $$;

ALTER TABLE acc_wage_ledger_v2
  ADD COLUMN IF NOT EXISTS payment_timing TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acc_wage_ledger_v2_payment_timing') THEN
    ALTER TABLE acc_wage_ledger_v2
      ADD CONSTRAINT chk_acc_wage_ledger_v2_payment_timing
      CHECK (payment_timing IS NULL OR payment_timing IN ('paid_on_board', 'payable_at_settlement', 'remitted_to_fund'));
  END IF;
END $$;
