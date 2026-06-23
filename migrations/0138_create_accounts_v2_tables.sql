-- Migration 0138: Create native V2 Accounts (payroll) tables.
-- Mirrors the V1 in-memory payroll entities as multi-tenant, audited _v2 tables
-- following the V2 conventions (serial id + *_uuid business key, UUID-based FKs,
-- shared audit columns, soft delete). Idempotent (IF NOT EXISTS), auto-runs per
-- tenant on first connection.

-- =========================================================================
-- PAY ELEMENTS (Rate Tables & Rules master library)
-- =========================================================================
CREATE TABLE IF NOT EXISTS acc_pay_elements_v2 (
  id SERIAL PRIMARY KEY,
  pay_element_uuid TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  formula TEXT NOT NULL,
  rounding TEXT NOT NULL DEFAULT 'none',
  ceiling INTEGER,
  floor INTEGER,
  effective_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  vessel_groups TEXT,
  reflect_in_contract BOOLEAN DEFAULT TRUE,
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
-- CONTRACTS (per crew member)
-- =========================================================================
CREATE TABLE IF NOT EXISTS acc_contracts_v2 (
  id SERIAL PRIMARY KEY,
  contract_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  vessel TEXT,
  vessel_group TEXT NOT NULL DEFAULT 'all-vessels',
  applicable_from TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  modified_by TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_contracts_v2_crew ON acc_contracts_v2 (crew_uuid);
CREATE INDEX IF NOT EXISTS idx_acc_contracts_v2_crew_group ON acc_contracts_v2 (crew_uuid, vessel_group);

-- =========================================================================
-- CONTRACT PAY ELEMENTS (inherited from master + custom)
-- =========================================================================
CREATE TABLE IF NOT EXISTS acc_contract_pay_elements_v2 (
  id SERIAL PRIMARY KEY,
  contract_pay_element_uuid TEXT NOT NULL UNIQUE,
  contract_uuid TEXT NOT NULL,
  pay_element_uuid TEXT,
  pay_element_code TEXT NOT NULL,
  pay_element_name TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  applicable BOOLEAN NOT NULL DEFAULT FALSE,
  formula TEXT NOT NULL DEFAULT 'No Formula',
  value TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  is_inherited BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_contract_pay_elements_v2_contract ON acc_contract_pay_elements_v2 (contract_uuid);

-- =========================================================================
-- ALLOTMENTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS acc_allotments_v2 (
  id SERIAL PRIMARY KEY,
  allotment_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  crew_name TEXT,
  rank TEXT,
  beneficiary_name TEXT NOT NULL,
  relationship TEXT,
  allotment_type TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  bank_name TEXT,
  account_number TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT,
  valid_to TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  kyc_complete BOOLEAN NOT NULL DEFAULT FALSE,
  bank_verified BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_allotments_v2_crew ON acc_allotments_v2 (crew_uuid);

-- =========================================================================
-- CASH ADVANCES
-- =========================================================================
CREATE TABLE IF NOT EXISTS acc_advances_v2 (
  id SERIAL PRIMARY KEY,
  advance_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  crew_name TEXT,
  rank TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT,
  request_date TEXT,
  approver TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  cap_check BOOLEAN NOT NULL DEFAULT TRUE,
  remaining_cap INTEGER NOT NULL DEFAULT 0,
  recovery_amount INTEGER,
  ctm_reference TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_advances_v2_crew ON acc_advances_v2 (crew_uuid);

-- =========================================================================
-- BOND PURCHASES
-- =========================================================================
CREATE TABLE IF NOT EXISTS acc_bond_items_v2 (
  id SERIAL PRIMARY KEY,
  bond_item_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  crew_name TEXT,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  sale_date TEXT,
  auto_deduct BOOLEAN NOT NULL DEFAULT TRUE,
  deduction_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_acc_bond_items_v2_crew ON acc_bond_items_v2 (crew_uuid);
