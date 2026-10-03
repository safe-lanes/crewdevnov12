-- Add capture metadata only. Never backfill or rewrite existing signed values.
ALTER TABLE frm_company_submission_system_snapshots
  ADD COLUMN IF NOT EXISTS system_value TEXT;
ALTER TABLE frm_company_submissions
  ADD COLUMN IF NOT EXISTS voided_by_designation TEXT,
  ADD COLUMN IF NOT EXISTS applicable_section_uuids JSONB;