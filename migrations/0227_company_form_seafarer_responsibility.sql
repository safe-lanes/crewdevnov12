-- Allow sections to be explicitly owned by the seafarer without role or
-- department companions. Existing responsibility modes retain their contracts.
ALTER TABLE frm_sections
  DROP CONSTRAINT IF EXISTS chk_frm_sections_responsible_mode,
  DROP CONSTRAINT IF EXISTS chk_frm_sections_responsible_target;

ALTER TABLE frm_sections
  ADD CONSTRAINT chk_frm_sections_responsible_mode
    CHECK (responsible_mode IN ('role', 'department', 'not_applicable', 'seafarer')),
  ADD CONSTRAINT chk_frm_sections_responsible_target
    CHECK (
      (responsible_mode = 'role'
        AND responsible_role_uuid IS NOT NULL
        AND responsible_department IS NULL)
      OR (responsible_mode = 'department'
        AND responsible_role_uuid IS NULL
        AND responsible_department IS NOT NULL
        AND BTRIM(responsible_department) <> '')
      OR (responsible_mode IN ('not_applicable', 'seafarer')
        AND responsible_role_uuid IS NULL
        AND responsible_department IS NULL)
    );