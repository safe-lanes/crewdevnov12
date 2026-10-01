-- Officer signatures may freeze the signer's designation in signer_rank.
-- Do not backfill existing signatures; NULL remains valid for legacy rows.
ALTER TABLE frm_section_signatures
  DROP CONSTRAINT IF EXISTS chk_frm_section_signatures_officer;

ALTER TABLE frm_section_signatures
  ADD CONSTRAINT chk_frm_section_signatures_officer
    CHECK (signature_type <> 'officer' OR
      (signature_method = 'officer'
       AND (signer_rank IS NULL OR BTRIM(signer_rank) <> '')));