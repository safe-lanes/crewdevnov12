-- V2 Migration: vessel_planning_attachments_v2 (17 columns)
-- Stores file attachments for vessel planning records

CREATE TABLE IF NOT EXISTS vessel_planning_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  plan_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  upload_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_planning_attachments_v2_plan ON vessel_planning_attachments_v2(plan_uuid);
CREATE INDEX IF NOT EXISTS idx_planning_attachments_v2_deleted ON vessel_planning_attachments_v2(is_deleted) WHERE is_deleted = false;
