-- V2 Migration: rotation_drafts_v2 (15 columns)
-- Stores rotation planning drafts

CREATE TABLE IF NOT EXISTS rotation_drafts_v2 (
  id SERIAL PRIMARY KEY,
  draft_uuid TEXT NOT NULL UNIQUE,
  draft_id TEXT NOT NULL,
  last_edited TEXT,
  plan_from_date TEXT NOT NULL,
  plan_to_date TEXT NOT NULL,
  created_by_uuid TEXT NOT NULL,
  plan_status TEXT DEFAULT 'In Draft',
  proposed_by_uuid TEXT,
  proposed_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rotation_drafts_v2_status ON rotation_drafts_v2(plan_status);
CREATE INDEX IF NOT EXISTS idx_rotation_drafts_v2_deleted ON rotation_drafts_v2(is_deleted) WHERE is_deleted = false;
