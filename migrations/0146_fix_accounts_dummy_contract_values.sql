-- Migration 0146: Fix demo contract pay values for Portage Bill
-- Date: 2026-06-23
-- Description: Migration 0145 seeded a separate DEMO-* master pay-element library
--              and standalone DEMO-CT-* contracts. The Accounts module, however,
--              auto-creates one contract per crew (unique on crew_uuid+vessel_group)
--              and inherits the REAL master pay elements as applicable=false.
--              Result: duplicate columns + blank/zero figures on the Portage Bill.
--
--              This migration:
--                1. Removes the duplicate DEMO-* pay-element library and the
--                   orphaned DEMO-CT-* contract pay elements created by 0143.
--                2. Ensures a contract exists for each demo crew (fresh tenants).
--                3. Marks the real inherited master pay elements applicable with
--                   realistic demo values so the Portage Bill renders full figures.
--
--              Code-driven (joins masters by code), so it works both where the
--              demo contracts already exist (inherited rows are UPDATEd) and on a
--              fresh tenant (missing rows are INSERTed). Idempotent.
--
--   Per-crew demo figures (currency USD):
--     DEMO-CREW-PB-001 (Master):         BASIC_WAGE 9000, FIXED_OT 800, LEAVE_PAY 1500,
--                                        INCOME_TAX 1200, UNION_DUES 150  -> net 9950
--     DEMO-CREW-PB-002 (Chief Engineer): BASIC_WAGE 8000, FIXED_OT 700, LEAVE_PAY 1300,
--                                        INCOME_TAX 1000, UNION_DUES 150  -> net 8850
--     DEMO-CREW-PB-003 (Second Officer): BASIC_WAGE 5500, FIXED_OT 500, LEAVE_PAY 900,
--                                        INCOME_TAX 700,  UNION_DUES 150  -> net 6050

-- ============================================================
-- 1. Remove the duplicate DEMO-* pay-element library + orphaned rows from 0143
-- ============================================================
DELETE FROM acc_contract_pay_elements_v2 WHERE pay_element_uuid LIKE 'DEMO-PE-%';
DELETE FROM acc_contract_pay_elements_v2 WHERE contract_uuid LIKE 'DEMO-CT-%';
DELETE FROM acc_contracts_v2 WHERE contract_uuid LIKE 'DEMO-CT-%';
DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid LIKE 'DEMO-PE-%';

-- ============================================================
-- 2. Ensure a contract exists for each demo crew (covers fresh tenants).
--    Skipped via ON CONFLICT where the app already auto-created one.
-- ============================================================
INSERT INTO acc_contracts_v2 (contract_uuid, crew_uuid, vessel_group, status, currency)
VALUES
  ('DEMO-CT-PB-001', 'DEMO-CREW-PB-001', 'all-vessels', 'draft', 'USD'),
  ('DEMO-CT-PB-002', 'DEMO-CREW-PB-002', 'all-vessels', 'draft', 'USD'),
  ('DEMO-CT-PB-003', 'DEMO-CREW-PB-003', 'all-vessels', 'draft', 'USD')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Insert the demo pay elements onto each crew's contract using the REAL master
--    library (by code) for any element not already present. Marked applicable.
-- ============================================================
INSERT INTO acc_contract_pay_elements_v2
  (contract_pay_element_uuid, contract_uuid, pay_element_uuid, pay_element_code,
   pay_element_name, category, type, applicable, formula, value,
   is_custom, is_inherited, sort_order)
SELECT
  'DEMO-CPE-' || d.crew || '-' || d.code,
  c.contract_uuid, pe.pay_element_uuid, pe.code, pe.name, pe.category, pe.type,
  TRUE, COALESCE(pe.formula, 'No Formula'), d.val, FALSE, TRUE, 0
FROM (VALUES
  ('DEMO-CREW-PB-001', 'BASIC_WAGE', '9000'),
  ('DEMO-CREW-PB-001', 'FIXED_OT',   '800'),
  ('DEMO-CREW-PB-001', 'LEAVE_PAY',  '1500'),
  ('DEMO-CREW-PB-001', 'INCOME_TAX', '1200'),
  ('DEMO-CREW-PB-001', 'UNION_DUES', '150'),
  ('DEMO-CREW-PB-002', 'BASIC_WAGE', '8000'),
  ('DEMO-CREW-PB-002', 'FIXED_OT',   '700'),
  ('DEMO-CREW-PB-002', 'LEAVE_PAY',  '1300'),
  ('DEMO-CREW-PB-002', 'INCOME_TAX', '1000'),
  ('DEMO-CREW-PB-002', 'UNION_DUES', '150'),
  ('DEMO-CREW-PB-003', 'BASIC_WAGE', '5500'),
  ('DEMO-CREW-PB-003', 'FIXED_OT',   '500'),
  ('DEMO-CREW-PB-003', 'LEAVE_PAY',  '900'),
  ('DEMO-CREW-PB-003', 'INCOME_TAX', '700'),
  ('DEMO-CREW-PB-003', 'UNION_DUES', '150')
) AS d(crew, code, val)
JOIN acc_contracts_v2 c
  ON c.crew_uuid = d.crew AND c.vessel_group = 'all-vessels' AND c.is_deleted = FALSE
JOIN (
  -- deterministic single master element per code (guards against duplicate codes)
  SELECT DISTINCT ON (code) pay_element_uuid, code, name, category, type, formula
  FROM acc_pay_elements_v2
  WHERE is_deleted = FALSE AND status = 'active'
  ORDER BY code, pay_element_uuid
) pe
  ON pe.code = d.code
WHERE NOT EXISTS (
  SELECT 1 FROM acc_contract_pay_elements_v2 x
  WHERE x.contract_uuid = c.contract_uuid
    AND x.pay_element_code = d.code
    AND x.is_deleted = FALSE
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Mark the inherited master elements applicable + set demo values
--    (covers contracts where the app already inherited them as applicable=false).
-- ============================================================
UPDATE acc_contract_pay_elements_v2 cpe
SET applicable = TRUE, value = d.val, updated_at = now()
FROM (VALUES
  ('DEMO-CREW-PB-001', 'BASIC_WAGE', '9000'),
  ('DEMO-CREW-PB-001', 'FIXED_OT',   '800'),
  ('DEMO-CREW-PB-001', 'LEAVE_PAY',  '1500'),
  ('DEMO-CREW-PB-001', 'INCOME_TAX', '1200'),
  ('DEMO-CREW-PB-001', 'UNION_DUES', '150'),
  ('DEMO-CREW-PB-002', 'BASIC_WAGE', '8000'),
  ('DEMO-CREW-PB-002', 'FIXED_OT',   '700'),
  ('DEMO-CREW-PB-002', 'LEAVE_PAY',  '1300'),
  ('DEMO-CREW-PB-002', 'INCOME_TAX', '1000'),
  ('DEMO-CREW-PB-002', 'UNION_DUES', '150'),
  ('DEMO-CREW-PB-003', 'BASIC_WAGE', '5500'),
  ('DEMO-CREW-PB-003', 'FIXED_OT',   '500'),
  ('DEMO-CREW-PB-003', 'LEAVE_PAY',  '900'),
  ('DEMO-CREW-PB-003', 'INCOME_TAX', '700'),
  ('DEMO-CREW-PB-003', 'UNION_DUES', '150')
) AS d(crew, code, val),
acc_contracts_v2 c
WHERE c.crew_uuid = d.crew
  AND c.vessel_group = 'all-vessels'
  AND c.is_deleted = FALSE
  AND cpe.contract_uuid = c.contract_uuid
  AND cpe.pay_element_code = d.code
  AND cpe.is_deleted = FALSE;
