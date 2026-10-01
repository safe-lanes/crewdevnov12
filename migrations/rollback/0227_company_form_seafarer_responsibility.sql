-- MANUAL ROLLBACK ONLY. This file is under migrations/rollback/ and is not
-- included by the numbered root-migration runner.
-- Refuse to discard seafarer responsibility assignments or empty department
-- values that are invalid under the previous target contract.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM frm_sections
    WHERE responsible_mode = 'seafarer'
  ) THEN
    RAISE EXCEPTION
      'Refusing 0227 rollback: frm_sections contains seafarer responsibility assignments';
  END IF;

  IF EXISTS (
    SELECT 1 FROM frm_sections
    WHERE responsible_mode = 'department'
      AND (responsible_department IS NULL OR BTRIM(responsible_department) = '')
  ) THEN
    RAISE EXCEPTION
      'Refusing 0227 rollback: department responsibility rows are incompatible with the prior constraint';
  END IF;
END $$;

ALTER TABLE frm_sections
  DROP CONSTRAINT IF EXISTS chk_frm_sections_responsible_mode,
  DROP CONSTRAINT IF EXISTS chk_frm_sections_responsible_target;

ALTER TABLE frm_sections
  ADD CONSTRAINT chk_frm_sections_responsible_mode
    CHECK (responsible_mode IN ('role', 'department', 'not_applicable')),
  ADD CONSTRAINT chk_frm_sections_responsible_target
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
    );