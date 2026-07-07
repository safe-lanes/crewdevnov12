-- ============================================
-- MIGRATION: Add screening_date Column to recruitment_candidates_v2
-- ============================================
-- Purpose: Persist the system date captured when a candidate is
--          submitted for screening in Part A5 of the Recruitment Form.
-- Type: ALTER TABLE

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'recruitment_candidates_v2'
        AND column_name = 'screening_date'
    ) THEN
        ALTER TABLE recruitment_candidates_v2
        ADD COLUMN screening_date TEXT;

        RAISE NOTICE 'Column screening_date added to recruitment_candidates_v2 table';
    ELSE
        RAISE NOTICE 'Column screening_date already exists in recruitment_candidates_v2 table';
    END IF;
END $$;
