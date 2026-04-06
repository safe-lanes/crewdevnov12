-- V2 Migration: rotation_draft_ranks_v2 (11 columns)
-- Links ranks to rotation drafts (normalized from CSV)

CREATE TABLE IF NOT EXISTS rotation_draft_ranks_v2 (
  id SERIAL PRIMARY KEY,
  rr_uuid TEXT NOT NULL UNIQUE,
  draft_uuid TEXT NOT NULL,
  rank_name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_draft_ranks_v2_draft ON rotation_draft_ranks_v2(draft_uuid);
CREATE INDEX IF NOT EXISTS idx_draft_ranks_v2_deleted ON rotation_draft_ranks_v2(is_deleted) WHERE is_deleted = false;
