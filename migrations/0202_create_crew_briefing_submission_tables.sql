-- Configurable Crew Briefing submission storage.
--
-- The submission parent is intentionally thin. Section states and answers are
-- shared by future configured forms, while this migration provides the first
-- form-specific parent and reporting projection.

CREATE TABLE IF NOT EXISTS crew_briefing_submissions (
  id SERIAL PRIMARY KEY,
  briefing_submission_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT,
  vessel_type_uuid TEXT,
  form_uuid TEXT NOT NULL
    REFERENCES adm_forms_v2(form_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  form_version_uuid TEXT NOT NULL
    REFERENCES adm_form_versions_v2(fv_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TIMESTAMP,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT chk_crew_briefing_submissions_status
    CHECK (status IN ('in_progress', 'completed'))
);

CREATE TABLE IF NOT EXISTS frm_section_states (
  id SERIAL PRIMARY KEY,
  section_state_uuid TEXT NOT NULL UNIQUE,
  submission_uuid TEXT NOT NULL,
  section_uuid TEXT NOT NULL
    REFERENCES frm_sections(section_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'not_started',
  section_comment TEXT,
  submitted_by_uuid TEXT,
  submitted_by_name TEXT,
  submitted_at TIMESTAMP,
  signature_att_uuid TEXT,
  signature_name TEXT,
  signed_by_uuid TEXT,
  signed_at TIMESTAMP,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT chk_frm_section_states_status
    CHECK (status IN ('not_started', 'in_progress', 'submitted', 'not_applicable')),
  CONSTRAINT uq_frm_section_states_submission_section
    UNIQUE (submission_uuid, section_uuid)
);

CREATE TABLE IF NOT EXISTS frm_answers (
  id SERIAL PRIMARY KEY,
  answer_uuid TEXT NOT NULL UNIQUE,
  submission_uuid TEXT NOT NULL,
  question_uuid TEXT NOT NULL
    REFERENCES frm_questions(question_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  answer_value TEXT,
  answer_comment TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT uq_frm_answers_submission_question
    UNIQUE (submission_uuid, question_uuid)
);

CREATE TABLE IF NOT EXISTS frm_signature_attachments (
  id SERIAL PRIMARY KEY,
  sig_att_uuid TEXT NOT NULL UNIQUE,
  section_state_uuid TEXT NOT NULL
    REFERENCES frm_section_states(section_state_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_crew_briefing_submissions_crew_uuid
  ON crew_briefing_submissions(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_briefing_submissions_vessel_uuid
  ON crew_briefing_submissions(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_briefing_submissions_vessel_type_uuid
  ON crew_briefing_submissions(vessel_type_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_briefing_submissions_form_uuid
  ON crew_briefing_submissions(form_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_briefing_submissions_form_version_uuid
  ON crew_briefing_submissions(form_version_uuid);

CREATE INDEX IF NOT EXISTS idx_frm_section_states_submission_uuid
  ON frm_section_states(submission_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_section_states_section_uuid
  ON frm_section_states(section_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_section_states_submitted_by_uuid
  ON frm_section_states(submitted_by_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_answers_submission_uuid
  ON frm_answers(submission_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_answers_question_uuid
  ON frm_answers(question_uuid);

CREATE INDEX IF NOT EXISTS idx_frm_signature_attachments_section_state_uuid
  ON frm_signature_attachments(section_state_uuid);

-- Long-format reporting projection.  Starting from the pinned structure
-- preserves unanswered applicable questions as rows with NULL answer fields.
-- submission_uuid is intentionally not an FK in the shared tables: future
-- configured forms will provide their own thin parent table.
CREATE OR REPLACE VIEW crew_briefing_submission_report AS
SELECT
  submission.briefing_submission_uuid,
  submission.crew_uuid,
  submission.vessel_uuid,
  submission.vessel_type_uuid,
  submission.form_uuid,
  submission.form_version_uuid,
  submission.status AS submission_status,
  submission.completed_at,
  section.section_uuid,
  section.section_code,
  section.section_title,
  section_state.status AS section_status,
  section_state.section_comment,
  section_state.submitted_by_name,
  section_state.submitted_at,
  question.question_uuid,
  question.question_code,
  question.question_text,
  question.response_type,
  answer.answer_value,
  CASE
    WHEN answer.answer_value IS NULL THEN NULL
    WHEN question.response_type IN ('yes_no', 'yes_no_na') THEN
      CASE LOWER(answer.answer_value)
        WHEN 'yes' THEN 'Yes'
        WHEN 'no' THEN 'No'
        WHEN 'na' THEN 'N/A'
        ELSE answer.answer_value
      END
    WHEN question.response_type = 'checkbox' THEN
      CASE LOWER(answer.answer_value)
        WHEN 'true' THEN 'Yes'
        WHEN 'false' THEN 'No'
        ELSE answer.answer_value
      END
    WHEN question.response_type = 'single_select' THEN (
      SELECT option.option_label
      FROM frm_options AS option
      WHERE option.option_set_uuid = COALESCE(question.option_set_uuid, section.default_option_set_uuid)
        AND option.option_value = answer.answer_value
        AND COALESCE(option.is_deleted, false) = false
      ORDER BY option.sort_order, option.id
      LIMIT 1
    )
    WHEN question.response_type = 'multi_select' THEN (
      SELECT string_agg(option.option_label, ', ' ORDER BY option.sort_order, option.id)
      FROM jsonb_array_elements_text(answer.answer_value::jsonb) AS selected(option_value)
      JOIN frm_options AS option
        ON option.option_set_uuid = COALESCE(question.option_set_uuid, section.default_option_set_uuid)
       AND option.option_value = selected.option_value
       AND COALESCE(option.is_deleted, false) = false
    )
    ELSE answer.answer_value
  END AS answer_label,
  answer.answer_comment
FROM crew_briefing_submissions AS submission
JOIN frm_sections AS section
  ON section.form_version_uuid = submission.form_version_uuid
JOIN frm_form_parts AS form_part
  ON form_part.form_part_uuid = section.form_part_uuid
 AND form_part.form_uuid = submission.form_uuid
JOIN frm_questions AS question
  ON question.section_uuid = section.section_uuid
LEFT JOIN frm_section_states AS section_state
  ON section_state.submission_uuid = submission.briefing_submission_uuid
 AND section_state.section_uuid = section.section_uuid
LEFT JOIN frm_answers AS answer
  ON answer.submission_uuid = submission.briefing_submission_uuid
 AND answer.question_uuid = question.question_uuid
WHERE section_state.status IS NULL
   OR section_state.status <> 'not_applicable';