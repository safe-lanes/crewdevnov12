-- Link configured Briefing submissions to their originating G1 joining row
-- and add the editable Part A / Part C fields.

ALTER TABLE crew_briefing_submissions
  ADD COLUMN IF NOT EXISTS briefing_uuid TEXT,
  ADD COLUMN IF NOT EXISTS date_of_briefing DATE,
  ADD COLUMN IF NOT EXISTS mode_of_briefing TEXT,
  ADD COLUMN IF NOT EXISTS office_review_comments TEXT,
  ADD COLUMN IF NOT EXISTS office_reviewed_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS office_reviewed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS office_reviewed_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crew_briefing_submissions_briefing_uuid
  ON crew_briefing_submissions(briefing_uuid);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_crew_briefing_submissions_briefing_uuid'
      AND conrelid = 'crew_briefing_submissions'::regclass
  ) THEN
    ALTER TABLE crew_briefing_submissions
      ADD CONSTRAINT fk_crew_briefing_submissions_briefing_uuid
      FOREIGN KEY (briefing_uuid)
      REFERENCES crew_briefings(briefing_uuid)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_crew_briefing_submissions_mode'
      AND conrelid = 'crew_briefing_submissions'::regclass
  ) THEN
    ALTER TABLE crew_briefing_submissions
      ADD CONSTRAINT chk_crew_briefing_submissions_mode
      CHECK (
        mode_of_briefing IS NULL OR
        mode_of_briefing IN ('company_office', 'manning_agent', 'video_call')
      );
  END IF;
END $$;