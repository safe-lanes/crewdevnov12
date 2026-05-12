-- Add foreign key constraint on crew_terminations.crew_uuid → crew_members_v2(crew_uuid)
-- Idempotent: only add if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crew_terminations_crew_uuid_fk'
  ) THEN
    ALTER TABLE crew_terminations
      ADD CONSTRAINT crew_terminations_crew_uuid_fk
      FOREIGN KEY (crew_uuid)
      REFERENCES crew_members_v2(crew_uuid)
      ON DELETE RESTRICT;
  END IF;
END
$$;
