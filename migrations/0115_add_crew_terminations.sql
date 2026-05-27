-- Terminate Employment feature
-- 1) crew_terminations: immutable per-event log of crew terminations.
-- 2) crew_members_v2 mirror columns: latest termination summary for fast list rendering.

CREATE TABLE IF NOT EXISTS crew_terminations (
  id SERIAL PRIMARY KEY,
  term_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  termination_date TEXT,
  initiated_by TEXT,
  reason TEXT,
  category TEXT,
  not_for_hire BOOLEAN DEFAULT FALSE,
  comments TEXT,
  -- Submitter identity (server-derived from auth context)
  submitted_by_user_id TEXT,
  submitted_by_name TEXT,
  submitted_by_role TEXT,
  -- Snapshots at termination time (retention reporting)
  rank_id_snapshot TEXT,
  pool_id_snapshot TEXT,
  manning_agent_id_snapshot TEXT,
  -- Audit columns
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_crew_terminations_crew_uuid ON crew_terminations(crew_uuid);

ALTER TABLE crew_members_v2 ADD COLUMN IF NOT EXISTS last_termination_date TEXT;
ALTER TABLE crew_members_v2 ADD COLUMN IF NOT EXISTS last_termination_reason TEXT;
ALTER TABLE crew_members_v2 ADD COLUMN IF NOT EXISTS last_termination_category TEXT;
ALTER TABLE crew_members_v2 ADD COLUMN IF NOT EXISTS termination_initiated_by TEXT;
ALTER TABLE crew_members_v2 ADD COLUMN IF NOT EXISTS not_for_hire BOOLEAN DEFAULT FALSE;
