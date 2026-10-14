-- Additive: existing frozen rows and released configuration are not backfilled.
ALTER TABLE frm_sections
  ADD COLUMN IF NOT EXISTS signature_vessel_management_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vessel_signature_role_uuids text[] NOT NULL DEFAULT '{}';
ALTER TABLE frm_section_signatures
  ADD COLUMN IF NOT EXISTS signer_role_uuid text REFERENCES adm_rolemaster_ac(ruid) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS witness_user_id integer,
  ADD COLUMN IF NOT EXISTS witness_rank text;
ALTER TABLE frm_section_signatures DROP CONSTRAINT IF EXISTS chk_frm_section_signatures_type;
ALTER TABLE frm_section_signatures ADD CONSTRAINT chk_frm_section_signatures_type
  CHECK (signature_type IN ('officer','seafarer','vessel_management'));
ALTER TABLE frm_section_signatures DROP CONSTRAINT IF EXISTS chk_frm_section_signatures_method;
ALTER TABLE frm_section_signatures ADD CONSTRAINT chk_frm_section_signatures_method
  CHECK (signature_method IN ('officer','witnessed','authenticated','vessel_management'));
ALTER TABLE frm_section_signatures DROP CONSTRAINT IF EXISTS chk_frm_section_signatures_vessel;
ALTER TABLE frm_section_signatures ADD CONSTRAINT chk_frm_section_signatures_vessel
  CHECK (signature_type <> 'vessel_management' OR
    (signature_method = 'vessel_management' AND btrim(signer_name) <> ''
     AND signer_rank IS NOT NULL AND btrim(signer_rank) <> '' AND signer_role_uuid IS NOT NULL));