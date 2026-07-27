-- Migration: add appr_reviewers_v2 table for appraisal reviewer assignment workflow
CREATE TABLE IF NOT EXISTS appr_reviewers_v2 (
  id SERIAL PRIMARY KEY,
  reviewer_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  user_uuid TEXT,
  reviewer_name TEXT,
  designation TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_appr_reviewers_v2_appraisal_uuid ON appr_reviewers_v2 (appraisal_uuid);
