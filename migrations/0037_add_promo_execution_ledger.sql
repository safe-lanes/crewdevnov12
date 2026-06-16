-- Phase 2 (Rank Propagation Engine): durable execution ledger for applied
-- promotions. One row per executed promotion (keyed by review_uuid) records
-- who/when/from-rank/to-rank so the rank flip applies at most once and a
-- future correction tool can reverse it. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS promo_execution_ledger_v2 (
  id SERIAL PRIMARY KEY,
  ledger_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL UNIQUE,
  crew_member_id TEXT NOT NULL,
  crew_uuid TEXT,
  from_rank TEXT,
  to_rank TEXT NOT NULL,
  effective_date TEXT,
  promotion_timing TEXT,
  applied_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_promo_exec_ledger_review_uuid
  ON promo_execution_ledger_v2 (review_uuid);

CREATE INDEX IF NOT EXISTS idx_promo_exec_ledger_crew_member_id
  ON promo_execution_ledger_v2 (crew_member_id);
