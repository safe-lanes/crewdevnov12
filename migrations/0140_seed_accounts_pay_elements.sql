-- Migration 0140: Seed standard maritime pay elements (Accounts V2)
-- Date: 2026-06-23
-- Description: Seeds the acc_pay_elements_v2 master library (Rate Tables & Rules)
--              with a standard set of maritime earnings and deductions.
--              Runs per tenant on first connection. Idempotent: each row is only
--              inserted when no active row with the same code already exists.

-- Earnings -------------------------------------------------------------------
INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'BASIC_WAGE', 'Basic Wage', 'earning', 'Fixed', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', TRUE, 0
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'BASIC_WAGE' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'FIXED_OT', 'Fixed Overtime', 'earning', 'Fixed', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'FIXED_OT' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'LEAVE_PAY', 'Leave Pay', 'earning', 'Fixed', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', TRUE, 2
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'LEAVE_PAY' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'SENIORITY_BONUS', 'Seniority Bonus', 'earning', 'Variable', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', FALSE, 3
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'SENIORITY_BONUS' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'SUBSISTENCE_ALLOWANCE', 'Subsistence Allowance', 'earning', 'Fixed', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', TRUE, 4
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'SUBSISTENCE_ALLOWANCE' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'TANKER_ALLOWANCE', 'Tanker Allowance', 'earning', 'Fixed', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', FALSE, 5
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'TANKER_ALLOWANCE' AND is_deleted = FALSE);

-- Deductions -----------------------------------------------------------------
INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'UNION_DUES', 'Union Dues', 'deduction', 'Fixed', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', TRUE, 6
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'UNION_DUES' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'PROVIDENT_FUND', 'Provident Fund', 'deduction', 'Variable', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', TRUE, 7
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'PROVIDENT_FUND' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'INCOME_TAX', 'Income Tax', 'deduction', 'Variable', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', FALSE, 8
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'INCOME_TAX' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'SOCIAL_SECURITY', 'Social Security', 'deduction', 'Variable', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', TRUE, 9
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'SOCIAL_SECURITY' AND is_deleted = FALSE);

INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, effective_date, status, vessel_groups, reflect_in_contract, sort_order)
SELECT gen_random_uuid()::text, 'WELFARE_FUND', 'Welfare Fund', 'deduction', 'Fixed', 'No Formula', 'ROUND_NEAREST_CENT', '2026-01-01', 'active', '["all-vessels"]', FALSE, 10
WHERE NOT EXISTS (SELECT 1 FROM acc_pay_elements_v2 WHERE code = 'WELFARE_FUND' AND is_deleted = FALSE);
