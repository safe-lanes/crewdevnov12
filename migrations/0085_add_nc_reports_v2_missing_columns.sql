-- Add missing columns to rh_nc_reports_v2 for full NC report form support
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS preventive_action TEXT;
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS preventive_action_status TEXT DEFAULT 'Pending';
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS preventive_action_due_date TIMESTAMP;
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS preventive_action_date_completed TIMESTAMP;
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS office_closure_verified_by_name TEXT;
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS office_closure_verified_by_position TEXT;
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS office_closure_date TIMESTAMP;
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Open';
ALTER TABLE rh_nc_reports_v2 ADD COLUMN IF NOT EXISTS submission_status TEXT DEFAULT 'draft';
