-- Migration 0143: Seed dummy/demo data for Accounts (Payrun Board + Portage Bill)
-- Date: 2026-06-23
-- Description: Inserts clearly-labeled DEMO sample data so the Payrun Board and
--              Portage Bill screens render with realistic figures out of the box.
--              Multi-tenant (auto-runs per tenant), idempotent (ON CONFLICT DO NOTHING).
--
--   Payrun Board  -> acc_payruns_v2 (+ acc_payrun_entries_v2)
--   Portage Bill  -> crew_members_v2 (demo crew) + acc_contracts_v2
--                    + acc_contract_pay_elements_v2 (applicable values)
--                    + acc_pay_elements_v2 (master library the contracts inherit)
--
-- All demo rows use DEMO-* identifiers and "Demo" labels so they are easy to spot
-- and remove later.

-- ============================================================
-- 1. Demo crew (Portage Bill needs these to exist in the crew pool)
-- ============================================================
INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, present_rank, status, is_active, is_deleted)
VALUES
  ('DEMO-CREW-PB-001', 'DEMO-001', 'James',  'Wilson',    'Master',         'active', TRUE, FALSE),
  ('DEMO-CREW-PB-002', 'DEMO-002', 'Sarah',  'Chen',      'Chief Engineer', 'active', TRUE, FALSE),
  ('DEMO-CREW-PB-003', 'DEMO-003', 'Mike',   'Rodriguez', 'Second Officer', 'active', TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Master pay element library (Rate Tables & Rules)
--    Contracts inherit these; we pre-seed contract pay elements with the same
--    pay_element_uuid so the runtime inheritance sync treats them as present.
-- ============================================================
INSERT INTO acc_pay_elements_v2 (pay_element_uuid, code, name, type, category, formula, rounding, status, reflect_in_contract)
VALUES
  ('DEMO-PE-BASIC', 'BASIC', 'Basic Wage',     'earning',   'Fixed',     'Monthly Basic', 'none', 'active', TRUE),
  ('DEMO-PE-LEAVE', 'LEAVE', 'Leave Pay',      'earning',   'Fixed',     'Per Month',     'none', 'active', TRUE),
  ('DEMO-PE-OT',    'OT',    'Fixed Overtime', 'earning',   'Variable',  'Hours x Rate',  'none', 'active', TRUE),
  ('DEMO-PE-TAX',   'TAX',   'Income Tax',     'deduction', 'Statutory', 'Gross x %',     'none', 'active', TRUE),
  ('DEMO-PE-UNION', 'UNION', 'Union Dues',     'deduction', 'Fixed',     'Flat',          'none', 'active', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Contracts (one per demo crew, all-vessels group, active)
-- ============================================================
INSERT INTO acc_contracts_v2 (contract_uuid, crew_uuid, vessel_group, status, currency)
VALUES
  ('DEMO-CT-001', 'DEMO-CREW-PB-001', 'all-vessels', 'active', 'USD'),
  ('DEMO-CT-002', 'DEMO-CREW-PB-002', 'all-vessels', 'active', 'USD'),
  ('DEMO-CT-003', 'DEMO-CREW-PB-003', 'all-vessels', 'active', 'USD')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Contract pay elements (applicable values that drive Portage Bill totals)
--    pay_element_uuid matches the master so inheritance does not duplicate them.
-- ============================================================
-- Contract 1 (Master): gross 11300, deductions 1350, net 9950
INSERT INTO acc_contract_pay_elements_v2 (contract_pay_element_uuid, contract_uuid, pay_element_uuid, pay_element_code, pay_element_name, category, type, applicable, formula, value, is_custom, is_inherited, sort_order)
VALUES
  ('DEMO-CPE-001-BASIC', 'DEMO-CT-001', 'DEMO-PE-BASIC', 'BASIC', 'Basic Wage',     'Fixed',     'earning',   TRUE, 'Monthly Basic', '9000', FALSE, TRUE, 0),
  ('DEMO-CPE-001-LEAVE', 'DEMO-CT-001', 'DEMO-PE-LEAVE', 'LEAVE', 'Leave Pay',      'Fixed',     'earning',   TRUE, 'Per Month',     '1500', FALSE, TRUE, 1),
  ('DEMO-CPE-001-OT',    'DEMO-CT-001', 'DEMO-PE-OT',    'OT',    'Fixed Overtime', 'Variable',  'earning',   TRUE, 'Hours x Rate',  '800',  FALSE, TRUE, 2),
  ('DEMO-CPE-001-TAX',   'DEMO-CT-001', 'DEMO-PE-TAX',   'TAX',   'Income Tax',     'Statutory', 'deduction', TRUE, 'Gross x %',     '1200', FALSE, TRUE, 3),
  ('DEMO-CPE-001-UNION', 'DEMO-CT-001', 'DEMO-PE-UNION', 'UNION', 'Union Dues',     'Fixed',     'deduction', TRUE, 'Flat',          '150',  FALSE, TRUE, 4)
ON CONFLICT DO NOTHING;

-- Contract 2 (Chief Engineer): gross 10000, deductions 1150, net 8850
INSERT INTO acc_contract_pay_elements_v2 (contract_pay_element_uuid, contract_uuid, pay_element_uuid, pay_element_code, pay_element_name, category, type, applicable, formula, value, is_custom, is_inherited, sort_order)
VALUES
  ('DEMO-CPE-002-BASIC', 'DEMO-CT-002', 'DEMO-PE-BASIC', 'BASIC', 'Basic Wage',     'Fixed',     'earning',   TRUE, 'Monthly Basic', '8000', FALSE, TRUE, 0),
  ('DEMO-CPE-002-LEAVE', 'DEMO-CT-002', 'DEMO-PE-LEAVE', 'LEAVE', 'Leave Pay',      'Fixed',     'earning',   TRUE, 'Per Month',     '1300', FALSE, TRUE, 1),
  ('DEMO-CPE-002-OT',    'DEMO-CT-002', 'DEMO-PE-OT',    'OT',    'Fixed Overtime', 'Variable',  'earning',   TRUE, 'Hours x Rate',  '700',  FALSE, TRUE, 2),
  ('DEMO-CPE-002-TAX',   'DEMO-CT-002', 'DEMO-PE-TAX',   'TAX',   'Income Tax',     'Statutory', 'deduction', TRUE, 'Gross x %',     '1000', FALSE, TRUE, 3),
  ('DEMO-CPE-002-UNION', 'DEMO-CT-002', 'DEMO-PE-UNION', 'UNION', 'Union Dues',     'Fixed',     'deduction', TRUE, 'Flat',          '150',  FALSE, TRUE, 4)
ON CONFLICT DO NOTHING;

-- Contract 3 (Second Officer): gross 6900, deductions 850, net 6050
INSERT INTO acc_contract_pay_elements_v2 (contract_pay_element_uuid, contract_uuid, pay_element_uuid, pay_element_code, pay_element_name, category, type, applicable, formula, value, is_custom, is_inherited, sort_order)
VALUES
  ('DEMO-CPE-003-BASIC', 'DEMO-CT-003', 'DEMO-PE-BASIC', 'BASIC', 'Basic Wage',     'Fixed',     'earning',   TRUE, 'Monthly Basic', '5500', FALSE, TRUE, 0),
  ('DEMO-CPE-003-LEAVE', 'DEMO-CT-003', 'DEMO-PE-LEAVE', 'LEAVE', 'Leave Pay',      'Fixed',     'earning',   TRUE, 'Per Month',     '900',  FALSE, TRUE, 1),
  ('DEMO-CPE-003-OT',    'DEMO-CT-003', 'DEMO-PE-OT',    'OT',    'Fixed Overtime', 'Variable',  'earning',   TRUE, 'Hours x Rate',  '500',  FALSE, TRUE, 2),
  ('DEMO-CPE-003-TAX',   'DEMO-CT-003', 'DEMO-PE-TAX',   'TAX',   'Income Tax',     'Statutory', 'deduction', TRUE, 'Gross x %',     '700',  FALSE, TRUE, 3),
  ('DEMO-CPE-003-UNION', 'DEMO-CT-003', 'DEMO-PE-UNION', 'UNION', 'Union Dues',     'Fixed',     'deduction', TRUE, 'Flat',          '150',  FALSE, TRUE, 4)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Payruns (Payrun Board list)
-- ============================================================
INSERT INTO acc_payruns_v2 (payrun_uuid, vessel, period, status, currency, crew_count, net_total, warnings, last_updated_by, is_off_cycle)
VALUES
  ('DEMO-PR-001', 'Vessel 1', '2025-01', 'draft',     'USD', 3,  24850,  2, 'Demo User', FALSE),
  ('DEMO-PR-002', 'Vessel 2', '2025-01', 'validated', 'USD', 18, 220500, 0, 'Demo User', FALSE),
  ('DEMO-PR-003', 'Vessel 1', '2024-12', 'approved',  'USD', 11, 138000, 1, 'Demo User', FALSE),
  ('DEMO-PR-004', 'Vessel 3', '2025-01', 'paid',      'USD', 9,  99000,  0, 'Demo User', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Payrun entries for DEMO-PR-001 (per-crew lines, consistent with net_total)
-- ============================================================
INSERT INTO acc_payrun_entries_v2 (payrun_entry_uuid, payrun_uuid, crew_uuid, crew_name, rank, gross_earnings, total_deductions, net_pay, currency, status)
VALUES
  ('DEMO-PRE-001-1', 'DEMO-PR-001', 'DEMO-CREW-PB-001', 'James Wilson',   'Master',         11300, 1350, 9950, 'USD', 'draft'),
  ('DEMO-PRE-001-2', 'DEMO-PR-001', 'DEMO-CREW-PB-002', 'Sarah Chen',     'Chief Engineer', 10000, 1150, 8850, 'USD', 'draft'),
  ('DEMO-PRE-001-3', 'DEMO-PR-001', 'DEMO-CREW-PB-003', 'Mike Rodriguez', 'Second Officer', 6900,  850,  6050, 'USD', 'draft')
ON CONFLICT DO NOTHING;
