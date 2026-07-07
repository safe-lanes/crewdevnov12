-- ============================================================================
-- Migration 0157: Accounts Payroll Run prep (Task: Payroll Run workspace,
-- Portage Bill & Monthly Transactions).
--
-- 1. acc_engagement_pay_elements_v2.payment_timing_override — per-engagement
--    payment-timing override for one pay element. Rationale: real portage
--    bills carry per-crew "Pay Leave On Board Y/N" and "Pay PF On Board Y/N"
--    flags — the same element is paid monthly to one seafarer and withheld
--    to settlement for another. Timing is therefore overridable per
--    engagement, not only fixed on the element master.
-- 2. acc_pay_elements_v2.gl_code — client GL account code (reporting later).
-- 3. acc_calculation_runs_v2.status CHECK relaxed to allow 'running' — the
--    engine now creates the run row as 'running' and only marks it
--    'completed' after the ledger line replacement commits (run-status
--    lifecycle fix); a failed replacement leaves status 'failed'.
-- 4. Data-fix: convert existing acc_engagements_v2.rank_id_at_start values
--    that hold rank NAMES (e.g. 'Master') into rank CODES (e.g. 'R001') by
--    resolving against adm_company_ranks_v2 — exact match first, then
--    case-insensitive — only where the match is unique. Values already equal
--    to a valid rank code, non-unique matches and unmatched values are left
--    untouched.
--
-- Conventions follow 0153/0154/0156: idempotent (ADD COLUMN IF NOT EXISTS,
-- guarded CHECK constraints via pg_constraint lookup); safe on empty fresh
-- tenant DBs.
-- ============================================================================

ALTER TABLE acc_engagement_pay_elements_v2
  ADD COLUMN IF NOT EXISTS payment_timing_override TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acc_engagement_pay_elements_v2_payment_timing_override') THEN
    ALTER TABLE acc_engagement_pay_elements_v2
      ADD CONSTRAINT chk_acc_engagement_pay_elements_v2_payment_timing_override
      CHECK (payment_timing_override IS NULL OR payment_timing_override IN ('paid_on_board', 'payable_at_settlement', 'remitted_to_fund'));
  END IF;
END $$;

ALTER TABLE acc_pay_elements_v2
  ADD COLUMN IF NOT EXISTS gl_code TEXT;

-- ----------------------------------------------------------------------------
-- 3. Allow the 'running' run status (run-status lifecycle fix).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'acc_calculation_runs_v2_status_check'
      AND pg_get_constraintdef(c.oid) NOT LIKE '%running%'
  ) THEN
    ALTER TABLE acc_calculation_runs_v2
      DROP CONSTRAINT acc_calculation_runs_v2_status_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acc_calculation_runs_v2_status_check')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'acc_calculation_runs_v2') THEN
    ALTER TABLE acc_calculation_runs_v2
      ADD CONSTRAINT acc_calculation_runs_v2_status_check
      CHECK (status IN ('running', 'completed', 'failed'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Rank name -> rank code data-fix for acc_engagements_v2.rank_id_at_start.
--    Skip rows whose value is already a valid rank code. Exact-match pass
--    first; case-insensitive pass for the remainder. Both passes require the
--    match to be unique (exactly one distinct rank_id).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adm_company_ranks_v2')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'acc_engagements_v2') THEN

    -- Pass 1: exact name match.
    UPDATE acc_engagements_v2 e
    SET rank_id_at_start = m.rank_id,
        updated_at = NOW()
    FROM (
      SELECT rank, MIN(rank_id) AS rank_id
      FROM adm_company_ranks_v2
      WHERE COALESCE(is_deleted, false) = false
      GROUP BY rank
      HAVING COUNT(DISTINCT rank_id) = 1
    ) m
    WHERE e.rank_id_at_start = m.rank
      AND e.rank_id_at_start <> m.rank_id
      AND NOT EXISTS (
        SELECT 1 FROM adm_company_ranks_v2 r
        WHERE r.rank_id = e.rank_id_at_start
          AND COALESCE(r.is_deleted, false) = false
      );

    -- Pass 2: case-insensitive name match for rows still unresolved.
    UPDATE acc_engagements_v2 e
    SET rank_id_at_start = m.rank_id,
        updated_at = NOW()
    FROM (
      SELECT LOWER(rank) AS rank_lower, MIN(rank_id) AS rank_id
      FROM adm_company_ranks_v2
      WHERE COALESCE(is_deleted, false) = false
      GROUP BY LOWER(rank)
      HAVING COUNT(DISTINCT rank_id) = 1
    ) m
    WHERE LOWER(e.rank_id_at_start) = m.rank_lower
      AND e.rank_id_at_start <> m.rank_id
      AND NOT EXISTS (
        SELECT 1 FROM adm_company_ranks_v2 r
        WHERE r.rank_id = e.rank_id_at_start
          AND COALESCE(r.is_deleted, false) = false
      );
  END IF;
END $$;
