-- Add Appraisal Type Master (023) with default entries
-- This replaces the sharedConfig-based appraisal type options in forms

-- Insert the master entry
INSERT INTO data_masters (id, name, description)
VALUES ('023', 'Appraisal Type', 'Types of crew appraisals')
ON CONFLICT (id) DO NOTHING;

-- Insert default appraisal type entries
INSERT INTO master_data_entries (master_id, entry_id, name, description)
VALUES 
  ('023', 'AT001', 'End of Contract', 'Appraisal at end of contract period'),
  ('023', 'AT002', 'Mid Term', 'Mid-term appraisal during contract'),
  ('023', 'AT003', 'Special', 'Special circumstance appraisal'),
  ('023', 'AT004', 'Probation', 'Probationary period appraisal')
ON CONFLICT DO NOTHING;
