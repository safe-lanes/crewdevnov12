-- Categories are security-relevant: only explicit, known categories may be stored.
-- Client-created forms use 'dynamic'; Standard Form categories are seeded by migrations.
ALTER TABLE adm_forms_v2 ALTER COLUMN category DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'adm_forms_v2'::regclass
      AND conname = 'adm_forms_v2_category_check'
  ) THEN
    ALTER TABLE adm_forms_v2
      ADD CONSTRAINT adm_forms_v2_category_check
      CHECK (category IN ('briefing', 'interview', 'debriefing', 'appraisal', 'promotion', 'dynamic'));
  END IF;
END $$;