CREATE TABLE IF NOT EXISTS crew_reactivations (
  id SERIAL PRIMARY KEY,
  reactivation_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  reactivation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reactivated_by_user_id TEXT NOT NULL,
  reactivated_by_name TEXT NOT NULL,
  target_status TEXT NOT NULL CHECK (target_status IN ('On Leave', 'Inactive')),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS crew_reactivations_crew_latest_idx
  ON crew_reactivations (crew_uuid, id DESC);
