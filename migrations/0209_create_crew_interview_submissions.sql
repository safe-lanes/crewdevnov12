-- Configurable detail submissions for the read-only recruitment B6 interview gate.
-- All statements are deliberately idempotent for tenant migration replays.
CREATE TABLE IF NOT EXISTS crew_interview_submissions (
  id SERIAL PRIMARY KEY,
  interview_submission_uuid TEXT NOT NULL UNIQUE,
  rec_can_uuid TEXT NOT NULL,
  interview_item_uuid TEXT UNIQUE,
  form_uuid TEXT NOT NULL REFERENCES adm_forms_v2(form_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  form_version_uuid TEXT NOT NULL REFERENCES adm_form_versions_v2(fv_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TIMESTAMP,
  interview_category TEXT,
  interview_stage TEXT,
  interviewer_comments TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_crew_interview_submissions_rec_can_uuid
  ON crew_interview_submissions(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_interview_submissions_form_uuid
  ON crew_interview_submissions(form_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_interview_submissions_form_version_uuid
  ON crew_interview_submissions(form_version_uuid);