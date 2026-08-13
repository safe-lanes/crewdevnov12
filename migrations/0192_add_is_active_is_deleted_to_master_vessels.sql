-- Migration 0186: Add is_active and is_deleted columns to master_vessels
-- Idempotent: uses ADD COLUMN IF NOT EXISTS so safe to run multiple times.
-- Follows the same pattern used for master_vessel_types (is_active/is_deleted).
-- Default TRUE/FALSE preserves existing rows as active and not deleted.

ALTER TABLE master_vessels ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE master_vessels ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
