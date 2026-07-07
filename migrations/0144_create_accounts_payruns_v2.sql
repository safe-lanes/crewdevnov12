-- Migration 0144: Accounts V2 payruns + payrun entries
-- Date: 2026-06-23
-- Description: Persists pay runs (per vessel + period) and their per-crew entries,
--              replacing the previous mock/in-memory Payrun Board/Detail data.
--              Multi-tenant (auto-runs per tenant), audited, soft-deletable. Idempotent.

CREATE TABLE IF NOT EXISTS acc_payruns_v2 (
  id              SERIAL PRIMARY KEY,
  payrun_uuid     TEXT NOT NULL UNIQUE,
  vessel_uuid     TEXT,
  vessel          TEXT NOT NULL,
  period          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  currency        TEXT NOT NULL DEFAULT 'USD',
  crew_count      INTEGER NOT NULL DEFAULT 0,
  net_total       INTEGER NOT NULL DEFAULT 0,
  warnings        INTEGER NOT NULL DEFAULT 0,
  last_updated_by TEXT,
  is_off_cycle    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted      BOOLEAN DEFAULT FALSE,
  is_sync         BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_acc_payruns_v2_vessel ON acc_payruns_v2 (vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_acc_payruns_v2_status ON acc_payruns_v2 (status);

CREATE TABLE IF NOT EXISTS acc_payrun_entries_v2 (
  id                SERIAL PRIMARY KEY,
  payrun_entry_uuid TEXT NOT NULL UNIQUE,
  payrun_uuid       TEXT NOT NULL,
  crew_uuid         TEXT NOT NULL,
  crew_name         TEXT,
  rank              TEXT,
  gross_earnings    INTEGER NOT NULL DEFAULT 0,
  total_deductions  INTEGER NOT NULL DEFAULT 0,
  net_pay           INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  status            TEXT NOT NULL DEFAULT 'draft',
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  created_by_uuid   TEXT,
  updated_by_uuid   TEXT,
  is_deleted        BOOLEAN DEFAULT FALSE,
  is_sync           BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_acc_payrun_entries_v2_payrun ON acc_payrun_entries_v2 (payrun_uuid);
CREATE INDEX IF NOT EXISTS idx_acc_payrun_entries_v2_crew ON acc_payrun_entries_v2 (crew_uuid);

-- One live entry per (payrun, crew).
CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_payrun_entries_v2_payrun_crew
  ON acc_payrun_entries_v2 (payrun_uuid, crew_uuid)
  WHERE is_deleted = FALSE;
