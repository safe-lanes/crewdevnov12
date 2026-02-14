-- Add checklist_progress_data column to promotion_reviews_v2
-- Stores the full V2 checklist JSON (sections with verifications, comments, attachments)
ALTER TABLE promotion_reviews_v2 ADD COLUMN IF NOT EXISTS checklist_progress_data TEXT;
