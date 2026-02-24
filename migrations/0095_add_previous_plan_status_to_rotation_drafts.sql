ALTER TABLE rotation_drafts_v2
ADD COLUMN IF NOT EXISTS previous_plan_status TEXT;
