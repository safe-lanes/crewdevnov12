-- =============================================================================
-- 0153_accounts_schema_rebuild.sql
-- Rebuild the Accounts domain around an append-only crew wage ledger.
--
-- Scope:
--   1. DROP condemned preliminary tables (contracts, contract pay elements,
--      payruns, payrun entries) — they only held throwaway test rows.
--   2. REBUILD acc_pay_elements_v2 to the new master-library shape (old rows
--      are throwaway; the old shape is incompatible, e.g. NOT NULL formula).
--   3. ALTER retained tables (advances, bond items, allotments): convert money
--      columns INTEGER -> numeric(14,2), date columns TEXT -> date, add new
--      nullable columns.
--   4. CREATE the 15 new tables (tenant config, wage scales/lines, CBA ref,
--      engagements + phases + overrides, monthly transactions, CTM + lines,
--      portage bills + approvals, calculation runs, wage ledger, settlements).
--
-- Conventions: serial id PK + business *_uuid TEXT UNIQUE; logical uuid FKs
-- (no DB-level FK constraints); money numeric(14,2); rates numeric(10,4); FX
-- numeric(12,6); periods TEXT 'YYYY-MM' with CHECK; enum-like columns TEXT with
-- CHECK. Idempotent (IF EXISTS / IF NOT EXISTS); safe on empty fresh tenant DBs.
-- =============================================================================

-- =========================================================================
-- 1. DROP condemned preliminary tables
-- =========================================================================
DROP TABLE IF EXISTS acc_payrun_entries_v2 CASCADE;
DROP TABLE IF EXISTS acc_payruns_v2 CASCADE;
DROP TABLE IF EXISTS acc_contract_pay_elements_v2 CASCADE;
DROP TABLE IF EXISTS acc_contracts_v2 CASCADE;

-- =========================================================================
-- 2. REBUILD acc_pay_elements_v2 (throwaway rows; incompatible old shape)
-- =========================================================================
DROP TABLE IF EXISTS acc_pay_elements_v2 CASCADE;
CREATE TABLE IF NOT EXISTS acc_pay_elements_v2 (
  id SERIAL PRIMARY KEY,
  pay_element_uuid TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('earning', 'deduction', 'employer_contribution')),
  category TEXT NOT NULL,
  calc_method TEXT NOT NULL CHECK (calc_method IN ('scale_lookup', 'fixed_amount', 'rate_times_qty', 'percentage_of_base', 'manual_entry')),
  percentage_base_element_uuid TEXT,
  prorate BOOLEAN NOT NULL DEFAULT FALSE,
  proration_basis_override TEXT CHECK (proration_basis_override IS NULL OR proration_basis_override IN ('thirty_day_month', 'calendar_days')),
  rounding_rule TEXT NOT NULL DEFAULT 'nearest' CHECK (rounding_rule IN ('nearest', 'up', 'down')),
  rounding_precision NUMERIC(6, 2) DEFAULT 0.01,
  nationality_conditional BOOLEAN NOT NULL DEFAULT FALSE,
  applicable_nationality_uuids TEXT[],
  shows_on_payslip BOOLEAN NOT NULL DEFAULT TRUE,
  shows_on_portage BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  effective_from DATE,
  effective_to DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_pay_elements_v2_code ON acc_pay_elements_v2 (code);
CREATE INDEX IF NOT EXISTS idx_acc_pay_elements_v2_status ON acc_pay_elements_v2 (status);

-- =========================================================================
-- 3. ALTER retained tables
-- =========================================================================

-- 3a. acc_advances_v2 --------------------------------------------------------
-- Clean malformed dates before casting (empty/bad -> NULL). Fresh DBs are empty.
UPDATE acc_advances_v2
   SET request_date = NULL
 WHERE request_date IS NOT NULL
   AND request_date !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$';

ALTER TABLE IF EXISTS acc_advances_v2
  ALTER COLUMN amount TYPE NUMERIC(14, 2) USING amount::numeric(14, 2),
  ALTER COLUMN recovery_amount TYPE NUMERIC(14, 2) USING recovery_amount::numeric(14, 2),
  ALTER COLUMN request_date TYPE DATE USING request_date::date;

ALTER TABLE IF EXISTS acc_advances_v2
  ADD COLUMN IF NOT EXISTS engagement_uuid TEXT,
  ADD COLUMN IF NOT EXISTS period TEXT,
  ADD COLUMN IF NOT EXISTS recovery_pay_element_uuid TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acc_advances_v2_period') THEN
    ALTER TABLE acc_advances_v2
      ADD CONSTRAINT chk_acc_advances_v2_period CHECK (period IS NULL OR period ~ '^\d{4}-\d{2}$');
  END IF;
END $$;

-- 3b. acc_bond_items_v2 ------------------------------------------------------
UPDATE acc_bond_items_v2
   SET sale_date = NULL
 WHERE sale_date IS NOT NULL
   AND sale_date !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$';

ALTER TABLE IF EXISTS acc_bond_items_v2
  ALTER COLUMN unit_price TYPE NUMERIC(14, 2) USING unit_price::numeric(14, 2),
  ALTER COLUMN total_price TYPE NUMERIC(14, 2) USING total_price::numeric(14, 2),
  ALTER COLUMN deduction_amount TYPE NUMERIC(14, 2) USING deduction_amount::numeric(14, 2),
  ALTER COLUMN sale_date TYPE DATE USING sale_date::date;

ALTER TABLE IF EXISTS acc_bond_items_v2
  ADD COLUMN IF NOT EXISTS engagement_uuid TEXT,
  ADD COLUMN IF NOT EXISTS period TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acc_bond_items_v2_period') THEN
    ALTER TABLE acc_bond_items_v2
      ADD CONSTRAINT chk_acc_bond_items_v2_period CHECK (period IS NULL OR period ~ '^\d{4}-\d{2}$');
  END IF;
END $$;

-- 3c. acc_allotments_v2 ------------------------------------------------------
UPDATE acc_allotments_v2
   SET valid_from = NULL
 WHERE valid_from IS NOT NULL
   AND valid_from !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$';
UPDATE acc_allotments_v2
   SET valid_to = NULL
 WHERE valid_to IS NOT NULL
   AND valid_to !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$';

ALTER TABLE IF EXISTS acc_allotments_v2
  ALTER COLUMN value TYPE NUMERIC(14, 2) USING value::numeric(14, 2),
  ALTER COLUMN valid_from TYPE DATE USING valid_from::date,
  ALTER COLUMN valid_to TYPE DATE USING valid_to::date;

ALTER TABLE IF EXISTS acc_allotments_v2
  ADD COLUMN IF NOT EXISTS engagement_uuid TEXT,
  ADD COLUMN IF NOT EXISTS payee_currency TEXT;

-- =========================================================================
-- 4. CREATE new tables
-- =========================================================================

-- 4.1 acc_tenant_config_v2 ---------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_tenant_config_v2 (
  id SERIAL PRIMARY KEY,
  config_uuid TEXT NOT NULL UNIQUE,
  preparation_mode TEXT NOT NULL DEFAULT 'office_prepares' CHECK (preparation_mode IN ('vessel_prepares', 'office_prepares')),
  proration_basis TEXT NOT NULL DEFAULT 'thirty_day_month' CHECK (proration_basis IN ('thirty_day_month', 'calendar_days')),
  functional_currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate_policy TEXT NOT NULL DEFAULT 'month_end' CHECK (fx_rate_policy IN ('month_end', 'transaction_date', 'manual')),
  employment_models_enabled TEXT[],
  auto_lock_on_approval BOOLEAN NOT NULL DEFAULT TRUE,
  settings JSONB,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- 4.2 acc_wage_scales_v2 -----------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_wage_scales_v2 (
  id SERIAL PRIMARY KEY,
  scale_uuid TEXT NOT NULL UNIQUE,
  scale_name TEXT NOT NULL,
  description TEXT,
  vessel_type_uuid TEXT,
  vessel_group_uuid TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'superseded')),
  superseded_by_scale_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_wage_scales_v2_status ON acc_wage_scales_v2 (status);
CREATE INDEX IF NOT EXISTS idx_acc_wage_scales_v2_scope ON acc_wage_scales_v2 (vessel_type_uuid, vessel_group_uuid);
-- Best-effort: one active scale per (vessel_type, vessel_group). NULLs are
-- treated as distinct, so fleet-wide overlaps are enforced at the service layer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_wage_scales_v2_active
  ON acc_wage_scales_v2 (vessel_type_uuid, vessel_group_uuid)
  WHERE status = 'active' AND is_deleted = FALSE;

-- 4.3 acc_wage_scale_lines_v2 ------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_wage_scale_lines_v2 (
  id SERIAL PRIMARY KEY,
  scale_line_uuid TEXT NOT NULL UNIQUE,
  scale_uuid TEXT NOT NULL,
  rank_id TEXT NOT NULL,
  nationality_uuid TEXT,
  experience_min_months INTEGER,
  experience_max_months INTEGER,
  pay_element_uuid TEXT NOT NULL,
  amount NUMERIC(14, 2),
  rate NUMERIC(10, 4),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT uq_acc_wage_scale_lines_v2 UNIQUE (scale_uuid, rank_id, nationality_uuid, experience_min_months, pay_element_uuid)
);
CREATE INDEX IF NOT EXISTS idx_acc_wage_scale_lines_v2_scale ON acc_wage_scale_lines_v2 (scale_uuid);

-- 4.4 acc_cba_reference_v2 ---------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_cba_reference_v2 (
  id SERIAL PRIMARY KEY,
  cba_ref_uuid TEXT NOT NULL UNIQUE,
  cba_name TEXT NOT NULL,
  rank_id TEXT,
  pay_element_uuid TEXT,
  category TEXT,
  minimum_amount NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE,
  effective_to DATE,
  source_note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- 4.5 acc_engagements_v2 -----------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_engagements_v2 (
  id SERIAL PRIMARY KEY,
  engagement_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('voyage_contract', 'annual_employment')),
  assignment_uuid TEXT,
  vessel_uuid TEXT,
  start_date DATE,
  end_date DATE,
  wage_scale_uuid TEXT,
  rank_id_at_start TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'settled', 'cancelled')),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_engagements_v2_crew ON acc_engagements_v2 (crew_uuid);
CREATE INDEX IF NOT EXISTS idx_acc_engagements_v2_vessel ON acc_engagements_v2 (vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_acc_engagements_v2_status ON acc_engagements_v2 (status);

-- 4.6 acc_engagement_phases_v2 ----------------------------------------------
CREATE TABLE IF NOT EXISTS acc_engagement_phases_v2 (
  id SERIAL PRIMARY KEY,
  phase_uuid TEXT NOT NULL UNIQUE,
  engagement_uuid TEXT NOT NULL,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('on_board', 'on_leave', 'standby', 'training')),
  from_date DATE,
  to_date DATE,
  vessel_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_engagement_phases_v2_engagement ON acc_engagement_phases_v2 (engagement_uuid);

-- 4.7 acc_engagement_pay_elements_v2 ----------------------------------------
CREATE TABLE IF NOT EXISTS acc_engagement_pay_elements_v2 (
  id SERIAL PRIMARY KEY,
  epe_uuid TEXT NOT NULL UNIQUE,
  engagement_uuid TEXT NOT NULL,
  pay_element_uuid TEXT NOT NULL,
  override_mode TEXT NOT NULL CHECK (override_mode IN ('replace_scale_value', 'add_element', 'suppress_element')),
  amount NUMERIC(14, 2),
  rate NUMERIC(10, 4),
  effective_from DATE,
  effective_to DATE,
  remarks TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_engagement_pay_elements_v2_engagement ON acc_engagement_pay_elements_v2 (engagement_uuid);

-- 4.8 acc_monthly_transactions_v2 -------------------------------------------
CREATE TABLE IF NOT EXISTS acc_monthly_transactions_v2 (
  id SERIAL PRIMARY KEY,
  txn_uuid TEXT NOT NULL UNIQUE,
  engagement_uuid TEXT NOT NULL,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  pay_element_uuid TEXT NOT NULL,
  qty NUMERIC(10, 2),
  rate NUMERIC(10, 4),
  amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate NUMERIC(12, 6),
  origin TEXT NOT NULL CHECK (origin IN ('vessel', 'office')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected')),
  source_type TEXT CHECK (source_type IS NULL OR source_type IN ('advance', 'bond', 'ctm', 'manual')),
  source_uuid TEXT,
  remarks TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_monthly_transactions_v2_engagement ON acc_monthly_transactions_v2 (engagement_uuid);
CREATE INDEX IF NOT EXISTS idx_acc_monthly_transactions_v2_crew_period ON acc_monthly_transactions_v2 (crew_uuid, period);

-- 4.9 acc_ctm_v2 ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_ctm_v2 (
  id SERIAL PRIMARY KEY,
  ctm_uuid TEXT NOT NULL UNIQUE,
  vessel_uuid TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  opening_balance NUMERIC(14, 2),
  received_amount NUMERIC(14, 2),
  closing_balance NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'reconciled', 'locked')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_ctm_v2_vessel_period ON acc_ctm_v2 (vessel_uuid, period);

-- 4.10 acc_ctm_lines_v2 -----------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_ctm_lines_v2 (
  id SERIAL PRIMARY KEY,
  ctm_line_uuid TEXT NOT NULL UNIQUE,
  ctm_uuid TEXT NOT NULL,
  line_date DATE,
  line_type TEXT NOT NULL CHECK (line_type IN ('cash_advance_to_crew', 'receipt', 'expense', 'adjustment')),
  crew_uuid TEXT,
  advance_uuid TEXT,
  amount NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_ctm_lines_v2_ctm ON acc_ctm_lines_v2 (ctm_uuid);

-- 4.11 acc_portage_bills_v2 -------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_portage_bills_v2 (
  id SERIAL PRIMARY KEY,
  portage_uuid TEXT NOT NULL UNIQUE,
  vessel_uuid TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'vessel_draft', 'submitted', 'office_review', 'returned', 'approved', 'locked')),
  prepared_mode TEXT CHECK (prepared_mode IS NULL OR prepared_mode IN ('vessel_prepares', 'office_prepares')),
  crew_count INTEGER DEFAULT 0,
  total_earnings NUMERIC(14, 2),
  total_deductions NUMERIC(14, 2),
  net_total NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  submitted_by_uuid TEXT,
  submitted_date DATE,
  locked_by_uuid TEXT,
  locked_date DATE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT uq_acc_portage_bills_v2_vessel_period UNIQUE (vessel_uuid, period)
);
CREATE INDEX IF NOT EXISTS idx_acc_portage_bills_v2_status ON acc_portage_bills_v2 (status);

-- 4.12 acc_portage_approvals_v2 ---------------------------------------------
CREATE TABLE IF NOT EXISTS acc_portage_approvals_v2 (
  id SERIAL PRIMARY KEY,
  pb_approval_uuid TEXT NOT NULL UNIQUE,
  portage_uuid TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_acc_portage_approvals_v2_portage ON acc_portage_approvals_v2 (portage_uuid);

-- 4.13 acc_calculation_runs_v2 ----------------------------------------------
CREATE TABLE IF NOT EXISTS acc_calculation_runs_v2 (
  id SERIAL PRIMARY KEY,
  calc_run_uuid TEXT NOT NULL UNIQUE,
  portage_uuid TEXT,
  engagement_uuid TEXT,
  run_type TEXT NOT NULL CHECK (run_type IN ('monthly', 'settlement', 'recalculation', 'adjustment')),
  run_date TIMESTAMP,
  run_by_uuid TEXT,
  input_snapshot JSONB,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  error_detail TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- 4.14 acc_wage_ledger_v2 (append-only system of record) --------------------
CREATE TABLE IF NOT EXISTS acc_wage_ledger_v2 (
  id SERIAL PRIMARY KEY,
  ledger_uuid TEXT NOT NULL UNIQUE,
  calc_run_uuid TEXT NOT NULL,
  portage_uuid TEXT,
  engagement_uuid TEXT NOT NULL,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  period_from DATE,
  period_to DATE,
  days_basis INTEGER,
  days_served NUMERIC(6, 2),
  rank_id TEXT,
  pay_element_uuid TEXT NOT NULL,
  element_type TEXT CHECK (element_type IS NULL OR element_type IN ('earning', 'deduction', 'employer_contribution')),
  element_code TEXT,
  qty NUMERIC(10, 2),
  rate NUMERIC(10, 4),
  amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate NUMERIC(12, 6),
  amount_functional NUMERIC(14, 2),
  source_type TEXT NOT NULL CHECK (source_type IN ('scale', 'engagement_override', 'monthly_txn', 'allotment', 'advance_recovery', 'bond', 'adjustment', 'settlement')),
  source_uuid TEXT,
  calc_snapshot JSONB,
  is_adjustment BOOLEAN NOT NULL DEFAULT FALSE,
  adjusts_ledger_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_wage_ledger_v2_crew_period ON acc_wage_ledger_v2 (crew_uuid, period);
CREATE INDEX IF NOT EXISTS idx_acc_wage_ledger_v2_portage ON acc_wage_ledger_v2 (portage_uuid);
CREATE INDEX IF NOT EXISTS idx_acc_wage_ledger_v2_engagement ON acc_wage_ledger_v2 (engagement_uuid);

-- 4.15 acc_settlements_v2 ---------------------------------------------------
CREATE TABLE IF NOT EXISTS acc_settlements_v2 (
  id SERIAL PRIMARY KEY,
  settlement_uuid TEXT NOT NULL UNIQUE,
  engagement_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  settlement_date DATE,
  period TEXT CHECK (period IS NULL OR period ~ '^\d{4}-\d{2}$'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'paid', 'locked')),
  gross_earnings NUMERIC(14, 2),
  total_deductions NUMERIC(14, 2),
  net_payable NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  remarks TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_settlements_v2_crew ON acc_settlements_v2 (crew_uuid);
