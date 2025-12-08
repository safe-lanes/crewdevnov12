-- Migration: Allow NULL for file_no column
-- Reason: File No is auto-generated at "Submit for Screening" stage, not at candidate creation
-- This allows multiple candidates to have NULL file_no without violating unique constraint

ALTER TABLE recruitment_candidates ALTER COLUMN file_no DROP NOT NULL;
