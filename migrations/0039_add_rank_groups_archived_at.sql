-- Add archived_at column to rank_groups table for soft-delete functionality
-- This allows archiving rank groups while preserving historical data

ALTER TABLE rank_groups 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN rank_groups.archived_at IS 'Timestamp when rank group was archived (soft-deleted), NULL if active';
