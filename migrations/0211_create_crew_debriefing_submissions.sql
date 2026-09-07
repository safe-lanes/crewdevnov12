-- Configurable detail submissions for read-only crew debriefing G2 rows.
-- All statements are deliberately idempotent for tenant migration replays.
CREATE TABLE IF NOT EXISTS crew_debriefing_submissions (
  id SERIAL PRIMARY KEY,
  debriefing_submission_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  debriefing_uuid TEXT UNIQUE REFERENCES crew_debriefings(debriefing_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  form_uuid TEXT NOT NULL REFERENCES adm_forms_v2(form_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  form_version_uuid TEXT NOT NULL REFERENCES adm_form_versions_v2(fv_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TIMESTAMP,
  debriefing_date DATE,
  mode_of_debriefing TEXT CHECK (mode_of_debriefing IN ('company_office', 'manning_agent', 'video_call')),
  office_review_comments TEXT,
  office_reviewed_by_uuid TEXT,
  office_reviewed_by_name TEXT,
  office_reviewed_at TIMESTAMP,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_crew_debriefing_submissions_crew_uuid ON crew_debriefing_submissions(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_debriefing_submissions_form_uuid ON crew_debriefing_submissions(form_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_debriefing_submissions_form_version_uuid ON crew_debriefing_submissions(form_version_uuid);