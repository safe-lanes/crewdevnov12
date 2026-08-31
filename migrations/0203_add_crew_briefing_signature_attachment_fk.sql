-- Complete the bidirectional section-state/signature relationship.
--
-- A section state is created before its signature attachment, then updated
-- with the stored attachment UUID. Both directions use stable UUID columns.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_frm_section_states_signature_attachment'
      AND conrelid = 'frm_section_states'::regclass
  ) THEN
    ALTER TABLE frm_section_states
      ADD CONSTRAINT fk_frm_section_states_signature_attachment
      FOREIGN KEY (signature_att_uuid)
      REFERENCES frm_signature_attachments(sig_att_uuid)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_frm_section_states_signature_att_uuid
  ON frm_section_states(signature_att_uuid);