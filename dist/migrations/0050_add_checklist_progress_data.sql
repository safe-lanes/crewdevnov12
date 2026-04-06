-- Add checklist_progress_data column to promotion_reviews table
-- Stores the full checklist state including completed status, verifications, comments, attachments
ALTER TABLE promotion_reviews
ADD COLUMN IF NOT EXISTS checklist_progress_data TEXT;

-- Comment to explain the column purpose
COMMENT ON COLUMN promotion_reviews.checklist_progress_data IS 'JSON string storing promotion checklist progress: completed flags, verifications, comments, and attachments per assessment point';
