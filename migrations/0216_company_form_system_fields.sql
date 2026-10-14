-- Existing Company Forms are crew-assignment forms. Standard Forms have no subject.
ALTER TABLE adm_forms_v2 ADD COLUMN IF NOT EXISTS subject_type TEXT;
UPDATE adm_forms_v2 SET subject_type = 'crew_assignment'
WHERE category = 'dynamic' AND subject_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'adm_forms_v2'::regclass
                   AND conname = 'chk_adm_forms_v2_subject_type') THEN
    ALTER TABLE adm_forms_v2 ADD CONSTRAINT chk_adm_forms_v2_subject_type
      CHECK (subject_type IN ('crew_assignment'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'adm_forms_v2'::regclass
                   AND conname = 'chk_adm_forms_v2_category_subject') THEN
    ALTER TABLE adm_forms_v2 ADD CONSTRAINT chk_adm_forms_v2_category_subject
      CHECK ((category = 'dynamic' AND subject_type IS NOT NULL)
          OR (category <> 'dynamic' AND subject_type IS NULL));
  END IF;
END $$;

ALTER TABLE frm_questions ADD COLUMN IF NOT EXISTS system_field_key TEXT;
ALTER TABLE frm_questions DROP CONSTRAINT IF EXISTS chk_frm_questions_response_type;
ALTER TABLE frm_questions ADD CONSTRAINT chk_frm_questions_response_type
  CHECK (response_type IN (
    'yes_no', 'yes_no_na', 'single_select', 'multi_select',
    'free_text', 'date', 'number', 'checkbox', 'info_only', 'content', 'system_field'
  ));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'frm_questions'::regclass
                   AND conname = 'chk_frm_questions_system_field_key') THEN
    ALTER TABLE frm_questions ADD CONSTRAINT chk_frm_questions_system_field_key
      CHECK ((response_type = 'system_field' AND system_field_key IS NOT NULL AND BTRIM(system_field_key) <> '')
          OR (response_type <> 'system_field' AND system_field_key IS NULL));
  END IF;
END $$;