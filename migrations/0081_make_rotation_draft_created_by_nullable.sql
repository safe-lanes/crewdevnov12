-- Make created_by_uuid nullable in rotation_drafts_v2
-- Follows Crew Pool V2 pattern: set value if found, else null
ALTER TABLE rotation_drafts_v2 ALTER COLUMN created_by_uuid DROP NOT NULL;
