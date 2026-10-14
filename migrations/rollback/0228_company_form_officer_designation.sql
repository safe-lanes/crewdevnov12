-- MANUAL ROLLBACK ONLY. This file is under migrations/rollback/ and is not
-- included by the numbered root-migration runner.
-- Refuse to discard any frozen officer designation; never rewrite signatures.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM frm_section_signatures
    WHERE signature_type = 'officer'
      AND signer_rank IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Refusing 0228 rollback: officer signatures contain signer_rank designations';
  END IF;
END $$;

ALTER TABLE frm_section_signatures
  DROP CONSTRAINT IF EXISTS chk_frm_section_signatures_officer;

ALTER TABLE frm_section_signatures
  ADD CONSTRAINT chk_frm_section_signatures_officer
    CHECK (signature_type <> 'officer' OR
      (signature_method = 'officer' AND signer_rank IS NULL));