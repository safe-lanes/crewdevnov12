-- Nullable, additive metadata only. Existing workflow statuses and rows stay unchanged.
ALTER TABLE frm_section_states
  ADD COLUMN IF NOT EXISTS last_draft_saved_at timestamp,
  ADD COLUMN IF NOT EXISTS last_draft_saved_by_uuid text,
  ADD COLUMN IF NOT EXISTS last_draft_saved_by_name text;
