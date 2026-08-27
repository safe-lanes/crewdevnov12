-- Form-version-owned option sets.
--
-- Legacy dependency audit (27-Aug-2026):
--   frm_question_options is referenced only by the configurable-form
--   structure repository and no answer/submission table or foreign key.
--   The guarded dependency check below is deliberately retained so a
--   later answer table cannot make this migration silently destructive.
--
-- The migration is idempotent when run directly as well as through the
-- file-based migration runner.  Unnamed sets are intentionally allowed:
-- migration converts each legacy question into its own compatibility set.

DO $$
DECLARE
  dependency_count INTEGER;
BEGIN
  IF to_regclass('public.frm_question_options') IS NULL THEN
    RETURN;
  END IF;
  SELECT COUNT(*) INTO dependency_count
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.confrelid = 'public.frm_question_options'::regclass;
  IF dependency_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to migrate frm_question_options: % foreign-key dependenc(ies) remain',
      dependency_count;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS frm_option_sets (
  id SERIAL PRIMARY KEY,
  option_set_uuid TEXT NOT NULL UNIQUE,
  form_version_uuid TEXT NOT NULL
    REFERENCES adm_form_versions_v2(fv_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  set_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS frm_options (
  id SERIAL PRIMARY KEY,
  option_uuid TEXT NOT NULL UNIQUE,
  option_set_uuid TEXT NOT NULL
    REFERENCES frm_option_sets(option_set_uuid) ON UPDATE CASCADE ON DELETE RESTRICT,
  option_label TEXT NOT NULL,
  option_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT uq_frm_options_set_value UNIQUE (option_set_uuid, option_value)
);

ALTER TABLE frm_sections
  ADD COLUMN IF NOT EXISTS default_option_set_uuid TEXT,
  ADD COLUMN IF NOT EXISTS layout_preference TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE frm_questions
  ADD COLUMN IF NOT EXISTS option_set_uuid TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_frm_sections_layout_preference'
  ) THEN
    ALTER TABLE frm_sections
      ADD CONSTRAINT chk_frm_sections_layout_preference
      CHECK (layout_preference IN ('auto', 'list', 'matrix'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_frm_sections_default_option_set'
  ) THEN
    ALTER TABLE frm_sections
      ADD CONSTRAINT fk_frm_sections_default_option_set
      FOREIGN KEY (default_option_set_uuid)
      REFERENCES frm_option_sets(option_set_uuid)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_frm_questions_option_set'
  ) THEN
    ALTER TABLE frm_questions
      ADD CONSTRAINT fk_frm_questions_option_set
      FOREIGN KEY (option_set_uuid)
      REFERENCES frm_option_sets(option_set_uuid)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_frm_option_sets_version_name
  ON frm_option_sets(form_version_uuid, set_name)
  WHERE set_name IS NOT NULL AND COALESCE(is_deleted, false) = false;
CREATE INDEX IF NOT EXISTS idx_frm_option_sets_form_version_uuid
  ON frm_option_sets(form_version_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_options_option_set_uuid
  ON frm_options(option_set_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_sections_default_option_set_uuid
  ON frm_sections(default_option_set_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_questions_option_set_uuid
  ON frm_questions(option_set_uuid);

-- Convert every legacy question-owned list to an unnamed set.  The
-- existence check makes this block safe after a prior successful run.
DO $$
DECLARE
  legacy_question RECORD;
  legacy_option RECORD;
  new_set_uuid TEXT;
  old_count INTEGER;
  new_count INTEGER;
BEGIN
  IF to_regclass('public.frm_question_options') IS NULL THEN
    RETURN;
  END IF;

  FOR legacy_question IN
    SELECT q.question_uuid, q.option_set_uuid
    FROM frm_questions q
    WHERE q.option_set_uuid IS NULL
      AND EXISTS (
        SELECT 1 FROM frm_question_options o
        WHERE o.question_uuid = q.question_uuid
      )
  LOOP
    new_set_uuid := gen_random_uuid()::text;
    INSERT INTO frm_option_sets(option_set_uuid, form_version_uuid, set_name, sort_order)
    SELECT new_set_uuid, s.form_version_uuid, NULL, q.sort_order
    FROM frm_questions q
    JOIN frm_sections s ON s.section_uuid = q.section_uuid
    WHERE q.question_uuid = legacy_question.question_uuid;

    INSERT INTO frm_options(option_uuid, option_set_uuid, option_label, option_value, sort_order,
                            created_at, updated_at, created_by_uuid, updated_by_uuid, is_deleted, is_sync)
    SELECT option_uuid, new_set_uuid, option_label, option_value, sort_order,
           created_at, updated_at, created_by_uuid, updated_by_uuid, is_deleted, is_sync
    FROM frm_question_options
    WHERE question_uuid = legacy_question.question_uuid
    ORDER BY sort_order, id;

    UPDATE frm_questions SET option_set_uuid = new_set_uuid
    WHERE question_uuid = legacy_question.question_uuid;

    SELECT COUNT(*) INTO old_count
    FROM frm_question_options
    WHERE question_uuid = legacy_question.question_uuid;
    SELECT COUNT(*) INTO new_count
    FROM frm_options WHERE option_set_uuid = new_set_uuid;
    IF old_count <> new_count THEN
      RAISE EXCEPTION 'Option migration count mismatch for question %: legacy %, new %',
        legacy_question.question_uuid, old_count, new_count;
    END IF;
    IF EXISTS (
      SELECT option_uuid, option_label, option_value, sort_order
      FROM frm_question_options
      WHERE question_uuid = legacy_question.question_uuid
      EXCEPT
      SELECT option_uuid, option_label, option_value, sort_order
      FROM frm_options
      WHERE option_set_uuid = new_set_uuid
    ) THEN
      RAISE EXCEPTION 'Option migration content mismatch for question %',
        legacy_question.question_uuid;
    END IF;
  END LOOP;

  -- Global reconciliation also covers soft-deleted history and catches a
  -- partially migrated database before the legacy table can be removed.
  SELECT COUNT(*) INTO old_count FROM frm_question_options;
  SELECT COUNT(*) INTO new_count
  FROM frm_options destination
  JOIN frm_question_options legacy
    ON legacy.option_uuid = destination.option_uuid;
  IF old_count <> new_count OR EXISTS (
    SELECT option_uuid, option_label, option_value, sort_order,
           COALESCE(is_deleted, false), COALESCE(is_sync, false)
    FROM frm_question_options
    EXCEPT
    SELECT destination.option_uuid, destination.option_label,
           destination.option_value, destination.sort_order,
           COALESCE(destination.is_deleted, false),
           COALESCE(destination.is_sync, false)
    FROM frm_options destination
    JOIN frm_question_options legacy
      ON legacy.option_uuid = destination.option_uuid
  ) THEN
    RAISE EXCEPTION
      'Global legacy option reconciliation failed: legacy %, matched new %',
      old_count, new_count;
  END IF;
END $$;

-- Do not drop the legacy table if an answer/submission table (or any
-- other foreign key) has started depending on it after the audit.
DO $$
DECLARE
  dependency_count INTEGER;
BEGIN
  IF to_regclass('public.frm_question_options') IS NULL THEN
    RETURN;
  END IF;
  SELECT COUNT(*) INTO dependency_count
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.confrelid = 'public.frm_question_options'::regclass;
  IF dependency_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to remove frm_question_options: % foreign-key dependenc(ies) remain',
      dependency_count;
  END IF;
  DROP TABLE frm_question_options;
END $$;