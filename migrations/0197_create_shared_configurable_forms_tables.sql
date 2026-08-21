-- Shared configurable-forms engine definitions.
-- All inter-table references intentionally use stable UUID text columns.

CREATE TABLE IF NOT EXISTS frm_form_parts (
  id SERIAL PRIMARY KEY,
  form_part_uuid TEXT NOT NULL UNIQUE,
  form_uuid TEXT NOT NULL REFERENCES adm_forms_v2(form_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  part_code TEXT NOT NULL,
  part_title TEXT NOT NULL,
  part_type TEXT NOT NULL,
  is_office_only BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT chk_frm_form_parts_part_type
    CHECK (part_type IN ('fixed', 'configurable')),
  CONSTRAINT uq_frm_form_parts_form_code
    UNIQUE (form_uuid, part_code)
);

CREATE TABLE IF NOT EXISTS frm_sections (
  id SERIAL PRIMARY KEY,
  section_uuid TEXT NOT NULL UNIQUE,
  form_version_uuid TEXT NOT NULL REFERENCES adm_form_versions_v2(fv_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  form_part_uuid TEXT NOT NULL REFERENCES frm_form_parts(form_part_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  section_code TEXT NOT NULL,
  section_title TEXT NOT NULL,
  applicable_vessel_types TEXT,
  responsible_mode TEXT NOT NULL DEFAULT 'not_applicable',
  responsible_role_uuid TEXT REFERENCES adm_rolemaster_ac(ruid) ON UPDATE CASCADE ON DELETE RESTRICT,
  responsible_department TEXT,
  comment_box_required BOOLEAN NOT NULL DEFAULT FALSE,
  signature_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT chk_frm_sections_responsible_mode
    CHECK (responsible_mode IN ('role', 'department', 'not_applicable')),
  CONSTRAINT chk_frm_sections_responsible_target
    CHECK (
      (responsible_mode = 'role'
        AND responsible_role_uuid IS NOT NULL
        AND responsible_department IS NULL)
      OR (responsible_mode = 'department'
        AND responsible_role_uuid IS NULL
        AND responsible_department IS NOT NULL)
      OR (responsible_mode = 'not_applicable'
        AND responsible_role_uuid IS NULL
        AND responsible_department IS NULL)
    ),
  CONSTRAINT chk_frm_sections_vessel_types_json_array
    CHECK (
      applicable_vessel_types IS NULL
      OR jsonb_typeof(applicable_vessel_types::jsonb) = 'array'
    ),
  CONSTRAINT uq_frm_sections_version_part_code
    UNIQUE (form_version_uuid, form_part_uuid, section_code)
);

CREATE TABLE IF NOT EXISTS frm_questions (
  id SERIAL PRIMARY KEY,
  question_uuid TEXT NOT NULL UNIQUE,
  section_uuid TEXT NOT NULL REFERENCES frm_sections(section_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  question_code TEXT NOT NULL,
  question_text TEXT NOT NULL,
  response_type TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  comment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT chk_frm_questions_response_type
    CHECK (response_type IN (
      'yes_no', 'yes_no_na', 'single_select', 'multi_select',
      'free_text', 'date', 'number', 'checkbox', 'info_only'
    )),
  CONSTRAINT uq_frm_questions_section_code
    UNIQUE (section_uuid, question_code)
);

CREATE TABLE IF NOT EXISTS frm_question_options (
  id SERIAL PRIMARY KEY,
  option_uuid TEXT NOT NULL UNIQUE,
  question_uuid TEXT NOT NULL REFERENCES frm_questions(question_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  option_label TEXT NOT NULL,
  option_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT uq_frm_question_options_question_value
    UNIQUE (question_uuid, option_value)
);

CREATE INDEX IF NOT EXISTS idx_frm_form_parts_form_uuid
  ON frm_form_parts(form_uuid);

CREATE INDEX IF NOT EXISTS idx_frm_sections_form_version_uuid
  ON frm_sections(form_version_uuid);

CREATE INDEX IF NOT EXISTS idx_frm_sections_form_part_uuid
  ON frm_sections(form_part_uuid);

CREATE INDEX IF NOT EXISTS idx_frm_sections_responsible_role_uuid
  ON frm_sections(responsible_role_uuid);

CREATE INDEX IF NOT EXISTS idx_frm_questions_section_uuid
  ON frm_questions(section_uuid);

CREATE INDEX IF NOT EXISTS idx_frm_question_options_question_uuid
  ON frm_question_options(question_uuid);