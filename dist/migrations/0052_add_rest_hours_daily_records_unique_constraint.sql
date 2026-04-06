-- Add unique constraint to prevent duplicate rest_hours_daily_records entries
-- This ensures only one record per crew_member_id/vessel_id/month_year combination
CREATE UNIQUE INDEX IF NOT EXISTS rest_hours_daily_records_unique_idx 
ON rest_hours_daily_records (crew_member_id, vessel_id, month_year);
