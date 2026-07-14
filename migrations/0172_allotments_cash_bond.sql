-- Migration 0163: Allotments & Cash/Bond management (Prompt 07).
--
-- 1. acc_allotments_v2 — payee/bank columns + status lifecycle.
--    Reuses columns already present on the retained prelim table (documented
--    mapping, no duplicates): payee_name -> beneficiary_name,
--    payee_relationship -> relationship, bank_account_number -> account_number,
--    bank_name -> bank_name. Only iban_swift and bank_country are new.
-- 2. acc_bond_items_v2 — txn_uuid link to the rolled-up monthly transaction;
--    quantity widened integer -> numeric(10,2) (spec asks for a numeric qty;
--    the retained table already has 'quantity', so it is widened in place
--    rather than duplicated).
-- 3. acc_tenant_config_v2 — max_allotment_percent soft cap (null = no check).
-- 4. Partial unique index: at most ONE bond rollup transaction per crew-month.
--
-- Idempotent and safe to re-run.

-- =========================================================================
-- 1. Allotments: new bank columns + status active|suspended|ended
-- =========================================================================
ALTER TABLE acc_allotments_v2 ADD COLUMN IF NOT EXISTS iban_swift text;
ALTER TABLE acc_allotments_v2 ADD COLUMN IF NOT EXISTS bank_country text;

-- Remap legacy status values to the new lifecycle before adding the CHECK.
UPDATE acc_allotments_v2 SET status = 'suspended' WHERE status = 'pending';
UPDATE acc_allotments_v2 SET status = 'ended'     WHERE status = 'expired';
UPDATE acc_allotments_v2 SET status = 'active'
WHERE status NOT IN ('active', 'suspended', 'ended');

ALTER TABLE acc_allotments_v2 ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE acc_allotments_v2
  DROP CONSTRAINT IF EXISTS chk_acc_allotments_v2_status;
ALTER TABLE acc_allotments_v2
  ADD CONSTRAINT chk_acc_allotments_v2_status
  CHECK (status IN ('active', 'suspended', 'ended'));

-- =========================================================================
-- 2. Bond items: rollup transaction link + fractional quantity
-- =========================================================================
ALTER TABLE acc_bond_items_v2 ADD COLUMN IF NOT EXISTS txn_uuid text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'acc_bond_items_v2'
      AND column_name = 'quantity'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE acc_bond_items_v2
      ALTER COLUMN quantity TYPE numeric(10,2);
  END IF;
END $$;

-- =========================================================================
-- 3. Tenant config: allotment soft cap
-- =========================================================================
ALTER TABLE acc_tenant_config_v2
  ADD COLUMN IF NOT EXISTS max_allotment_percent numeric(10,4);

-- =========================================================================
-- 4. One bond rollup transaction per crew-month (concurrency guard)
-- =========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_monthly_txn_bond_rollup
  ON acc_monthly_transactions_v2 (crew_uuid, period)
  WHERE source_type = 'bond' AND is_deleted = false;
