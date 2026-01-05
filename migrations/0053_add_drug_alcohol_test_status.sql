-- Add status column to drug_alcohol_test_records table
-- This allows tracking whether a record is a draft or has been submitted

ALTER TABLE drug_alcohol_test_records 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_drug_alcohol_test_records_status 
ON drug_alcohol_test_records(status);
