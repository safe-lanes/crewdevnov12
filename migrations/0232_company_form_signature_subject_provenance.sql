-- Additive; never reconstruct provenance for historical signatures.
ALTER TABLE frm_section_signatures
  ADD COLUMN IF NOT EXISTS subject_provenance jsonb;