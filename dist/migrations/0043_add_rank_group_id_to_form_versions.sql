-- Add rank_group_id column to form_versions table
-- This allows each rank group to have its own independent version history

-- Add the column (nullable to preserve existing data)
ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS rank_group_id INTEGER REFERENCES rank_groups(id) ON DELETE CASCADE;

-- Create an index for efficient querying by rank group
CREATE INDEX IF NOT EXISTS idx_form_versions_rank_group_id ON form_versions(rank_group_id);

-- Note: Existing versions will have NULL rank_group_id
-- New versions created after this migration will have the rank_group_id set
