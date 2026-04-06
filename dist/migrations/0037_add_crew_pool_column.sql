-- Migration: Add crew_pool column to crew_members table
-- This migration adds the crew_pool column for storing crew pool assignments

ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS crew_pool VARCHAR(255);
