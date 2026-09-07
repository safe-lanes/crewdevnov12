-- Office reviewer audit metadata for Crew Interview Part C.
-- Statements are idempotent for tenant migration replays.
ALTER TABLE crew_interview_submissions
  ADD COLUMN IF NOT EXISTS office_reviewed_by_uuid TEXT;
ALTER TABLE crew_interview_submissions
  ADD COLUMN IF NOT EXISTS office_reviewed_by_name TEXT;
ALTER TABLE crew_interview_submissions
  ADD COLUMN IF NOT EXISTS office_reviewed_at TIMESTAMP;