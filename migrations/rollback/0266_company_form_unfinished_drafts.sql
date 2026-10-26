-- Conditional rollback only. Once unfinished drafts exist, this transaction
-- MUST REFUSE until those drafts are completed or removed through an authorised
-- workflow. Never repair or delete drafts here. Constraint validation happens
-- before removing guards; any failure leaves the forward schema intact.
BEGIN;
ALTER TABLE frm_sections DROP CONSTRAINT chk_frm_sections_responsible_target;
ALTER TABLE frm_sections ADD CONSTRAINT chk_frm_sections_responsible_target CHECK (
  (responsible_mode='role' AND responsible_role_uuid IS NOT NULL AND responsible_department IS NULL)
  OR (responsible_mode='department' AND responsible_role_uuid IS NULL
    AND responsible_department IS NOT NULL AND btrim(responsible_department)<>'')
  OR (responsible_mode IN ('not_applicable','seafarer')
    AND responsible_role_uuid IS NULL AND responsible_department IS NULL)
);
ALTER TABLE frm_questions DROP CONSTRAINT chk_frm_questions_system_field_key;
ALTER TABLE frm_questions ADD CONSTRAINT chk_frm_questions_system_field_key CHECK (
  (response_type='system_field' AND system_field_key IS NOT NULL AND btrim(system_field_key)<>'')
  OR (response_type<>'system_field' AND system_field_key IS NULL)
);
ALTER TABLE frm_version_applicability DROP CONSTRAINT chk_frm_applicability_draft_shape;
ALTER TABLE frm_version_applicability ADD CONSTRAINT frm_version_applicability_check CHECK (
  (mode='manual_only' AND obligation IS NULL AND effective_kind IS NULL
    AND specific_date IS NULL AND effective_from IS NULL)
  OR (mode<>'manual_only' AND obligation IS NOT NULL AND effective_kind IS NOT NULL
    AND ((effective_kind='specific_date' AND specific_date IS NOT NULL)
      OR (effective_kind='on_release' AND specific_date IS NULL)))
);
DROP TRIGGER trg_company_release_completeness ON adm_form_versions_v2;
DROP TRIGGER trg_draft_section_completeness ON frm_sections;
DROP TRIGGER trg_draft_question_completeness ON frm_questions;
DROP TRIGGER trg_draft_policy_completeness ON frm_version_applicability;
DROP FUNCTION frm_guard_release_completeness();
DROP FUNCTION frm_guard_draft_completeness();
DROP FUNCTION frm_is_writable_company_draft(text);
COMMIT;
