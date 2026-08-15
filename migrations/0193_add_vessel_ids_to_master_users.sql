-- Migration 0193: Add vessel_ids column to master_users
-- Stores comma-separated vessel IDs from the parent system API (e.g. "24,35,40,41").
-- Idempotent: uses ADD COLUMN IF NOT EXISTS so safe to run multiple times.

ALTER TABLE master_users ADD COLUMN IF NOT EXISTS vessel_ids VARCHAR(255);
