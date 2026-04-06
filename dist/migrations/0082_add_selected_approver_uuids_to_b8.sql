-- Add selectedApproverUuids array column to screening_b8_shortlisting table
ALTER TABLE screening_b8_shortlisting 
ADD COLUMN IF NOT EXISTS selected_approver_uuids TEXT[] DEFAULT '{}';
