-- Crew-portal entries awaiting office verification before they publish into
-- the canonical crew-pool tables (crew_documents, crew_visas, etc.).
-- All statements are deliberately idempotent for tenant migration replays.
CREATE TABLE IF NOT EXISTS app_crew_pending_changes (
  id SERIAL PRIMARY KEY,
  pending_uuid TEXT NOT NULL UNIQUE,
  domain VARCHAR(255) NOT NULL,
  crew_uuid TEXT NOT NULL,
  section TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  target_uuid TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  staged_attachments TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_uuid TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_app_crew_pending_changes_crew_uuid_domain
  ON app_crew_pending_changes(crew_uuid, domain);
CREATE INDEX IF NOT EXISTS idx_app_crew_pending_changes_status
  ON app_crew_pending_changes(status);
CREATE INDEX IF NOT EXISTS idx_app_crew_pending_changes_section_target
  ON app_crew_pending_changes(section, target_uuid);
