ALTER TABLE promo_checklist_progress_v2
  ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS section_title text,
  ADD COLUMN IF NOT EXISTS assessment_point_text text,
  ADD COLUMN IF NOT EXISTS verifier_rank text,
  ADD COLUMN IF NOT EXISTS verifications_data text,
  ADD COLUMN IF NOT EXISTS comments_data text,
  ADD COLUMN IF NOT EXISTS attachments_data text;
