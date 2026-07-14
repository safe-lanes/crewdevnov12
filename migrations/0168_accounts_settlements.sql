-- Migration 0159: Final settlements — component columns, settlement
-- adjustments table, persisted run warnings.
--
-- Rationale (documented per spec Prompt 05): the balance service must
-- subtract ONLY balance_paid from the running on-board balance and consume
-- accrual payouts against the leave/accrual mini-ledger. Subtracting the
-- whole net_payable double-counts the accrual portion (accruals never
-- entered the on-board balance) and drives balances negative.
-- net_payable stays a cached total:
--   net_payable = balance_paid + accruals_paid
--               + adjustments_earnings - adjustments_deductions.
--
-- Idempotent: IF NOT EXISTS everywhere; safe to re-run.

-- =========================================================================
-- 1. acc_settlements_v2 — settlement component columns
-- =========================================================================
ALTER TABLE acc_settlements_v2
  ADD COLUMN IF NOT EXISTS balance_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accruals_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustments_earnings NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustments_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_date DATE,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS statement_snapshot JSONB;

-- =========================================================================
-- 2. acc_settlement_adjustments_v2 — settlement-specific one-offs
--    (travel wages, final claims, recovery of outstanding advances).
--    Editable only while the settlement is draft (service-enforced).
-- =========================================================================
CREATE TABLE IF NOT EXISTS acc_settlement_adjustments_v2 (
  id SERIAL PRIMARY KEY,
  adjustment_uuid TEXT NOT NULL UNIQUE,
  settlement_uuid TEXT NOT NULL,
  pay_element_uuid TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earning', 'deduction')),
  amount NUMERIC(14, 2) NOT NULL,
  remarks TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_settlement_adjustments_v2_settlement
  ON acc_settlement_adjustments_v2 (settlement_uuid);

-- =========================================================================
-- 3. acc_settlement_approvals_v2 — approval rows following the portage
--    pattern (acc_portage_approvals_v2).
-- =========================================================================
CREATE TABLE IF NOT EXISTS acc_settlement_approvals_v2 (
  id SERIAL PRIMARY KEY,
  st_approval_uuid TEXT NOT NULL UNIQUE,
  settlement_uuid TEXT NOT NULL,
  approver_id TEXT,
  approver TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  comments TEXT,
  date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_settlement_approvals_v2_settlement
  ON acc_settlement_approvals_v2 (settlement_uuid);

-- =========================================================================
-- 4. acc_calculation_runs_v2 — persisted run warnings
--    (array of {crewUuid, code, message}; skip reasons, timing-override
--    fallbacks, replace-without-base).
-- =========================================================================
ALTER TABLE acc_calculation_runs_v2
  ADD COLUMN IF NOT EXISTS warnings JSONB;
