-- =============================================================================
-- 0154_accounts_amendments.sql
-- Amendments to the Accounts domain on top of 0153, needed by the first
-- functional surface (Master Tables & Admin).
--
-- Scope:
--   1. acc_pay_elements_v2  : add payment_timing (when a pay element settles).
--   2. acc_advances_v2       : widen remaining_cap INTEGER -> numeric(14,2)
--                              (closes the documented 0153 deviation).
--   3. acc_engagements_v2    : add scale_year_at_start + next_step_date
--                              (seniority-step anchor snapshot).
--   4. acc_tenant_config_v2  : add seniority_basis + allow_manual_seniority_anchor.
--   5. acc_wage_scales_v2     : add floor-check acknowledgment columns
--                              (floor_ack_by_uuid, floor_ack_at, floor_violations).
--
-- Conventions follow 0153: idempotent (ADD COLUMN IF NOT EXISTS, guarded
-- CHECK constraints via pg_constraint lookup); safe on empty fresh tenant DBs.
-- =============================================================================

-- =========================================================================
-- 1. acc_pay_elements_v2 : payment_timing
--    When the element's value is actually paid out:
--      paid_on_board        - included in the monthly on-board payslip
--      payable_at_settlement - accrues monthly but is only paid at final settlement
--      remitted_to_fund     - remitted to a third-party fund (e.g. PF/pension)
-- =========================================================================
ALTER TABLE IF EXISTS acc_pay_elements_v2
  ADD COLUMN IF NOT EXISTS payment_timing TEXT NOT NULL DEFAULT 'paid_on_board';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acc_pay_elements_v2_payment_timing') THEN
    ALTER TABLE acc_pay_elements_v2
      ADD CONSTRAINT chk_acc_pay_elements_v2_payment_timing
      CHECK (payment_timing IN ('paid_on_board', 'payable_at_settlement', 'remitted_to_fund'));
  END IF;
END $$;

-- =========================================================================
-- 2. acc_advances_v2 : widen remaining_cap to money (numeric(14,2)).
--    0153 left this as INTEGER; the cap is a money amount, so align it with
--    the other money columns.
-- =========================================================================
ALTER TABLE IF EXISTS acc_advances_v2
  ALTER COLUMN remaining_cap DROP DEFAULT,
  ALTER COLUMN remaining_cap TYPE NUMERIC(14, 2) USING remaining_cap::numeric(14, 2),
  ALTER COLUMN remaining_cap SET DEFAULT 0;

-- =========================================================================
-- 3. acc_engagements_v2 : seniority-step anchor snapshot.
--    scale_year_at_start - the wage-scale year/step in force when the
--                          engagement started (1-based step index).
--    next_step_date      - the date the crew is due to advance to the next step.
-- =========================================================================
ALTER TABLE IF EXISTS acc_engagements_v2
  ADD COLUMN IF NOT EXISTS scale_year_at_start INTEGER,
  ADD COLUMN IF NOT EXISTS next_step_date DATE;

-- =========================================================================
-- 4. acc_tenant_config_v2 : seniority configuration.
--    seniority_basis - how a crew's seniority step is measured:
--      rank_service_all_employers - total time in rank across all employers
--      rank_service_company       - time in rank within this company only
--      company_tenure             - total tenure with this company
--    allow_manual_seniority_anchor - whether an operator may manually override
--    the derived seniority step on an engagement.
-- =========================================================================
ALTER TABLE IF EXISTS acc_tenant_config_v2
  ADD COLUMN IF NOT EXISTS seniority_basis TEXT NOT NULL DEFAULT 'rank_service_all_employers',
  ADD COLUMN IF NOT EXISTS allow_manual_seniority_anchor BOOLEAN NOT NULL DEFAULT TRUE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acc_tenant_config_v2_seniority_basis') THEN
    ALTER TABLE acc_tenant_config_v2
      ADD CONSTRAINT chk_acc_tenant_config_v2_seniority_basis
      CHECK (seniority_basis IN ('rank_service_all_employers', 'rank_service_company', 'company_tenure'));
  END IF;
END $$;

-- =========================================================================
-- 5. acc_wage_scales_v2 : floor-check acknowledgment.
--    When a scale is activated with lines below a CBA minimum, the operator
--    must explicitly acknowledge the violations. That acknowledgment is
--    persisted on the scale header:
--      floor_ack_by_uuid  - who acknowledged
--      floor_ack_at       - when
--      floor_violations   - jsonb snapshot of the acknowledged violations
-- =========================================================================
ALTER TABLE IF EXISTS acc_wage_scales_v2
  ADD COLUMN IF NOT EXISTS floor_ack_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS floor_ack_at DATE,
  ADD COLUMN IF NOT EXISTS floor_violations JSONB;
