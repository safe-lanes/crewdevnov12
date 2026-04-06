-- Migration: Migrate vessel IDs from local VSL-XXX format to external SAIL ERP API UUIDs
-- This migration preserves rollback capability through a mapping table
-- Date: 2024-12-24

-- =====================================================
-- PHASE 1: Create vessel ID mapping table for rollback
-- =====================================================
CREATE TABLE IF NOT EXISTS vessel_id_mappings (
    id SERIAL PRIMARY KEY,
    old_vessel_id TEXT NOT NULL UNIQUE,
    new_vessel_id TEXT NOT NULL UNIQUE,
    old_vessel_name TEXT NOT NULL,
    new_vessel_name TEXT NOT NULL,
    migrated_at TIMESTAMP DEFAULT NOW()
);

-- Insert the mapping data
INSERT INTO vessel_id_mappings (old_vessel_id, new_vessel_id, old_vessel_name, new_vessel_name)
VALUES 
    ('VSL-001', '743ef9d1-841a-11ed-aa7c-7003bca91a86', 'MV Atlantic Pioneer', 'Vessel 1'),
    ('VSL-002', '743feb08-841a-11ed-aa7c-7003bca91a86', 'MV Ocean Explorer', 'Vessel 2'),
    ('VSL-003', '7440571a-841a-11ed-aa7c-7003bca91a86', 'MT Nordic Star', 'Vessel 3'),
    ('VSL-004', '744535d0-841a-11ed-aa7c-7003bca91a86', 'MV Pacific Voyager', 'Vessel 4'),
    ('VSL-005', '7446783c-841a-11ed-aa7c-7003bca91a86', 'MT Liberty Gas', 'Vessel 5'),
    ('VSL-006', '74481b72-841a-11ed-aa7c-7003bca91a86', 'MV Global Trader', 'Vessel 6')
ON CONFLICT (old_vessel_id) DO NOTHING;

-- =====================================================
-- PHASE 2: Update Master 014 vessel entries
-- =====================================================
UPDATE master_data_entries 
SET entry_id = m.new_vessel_id, name = m.new_vessel_name
FROM vessel_id_mappings m
WHERE master_data_entries.master_id = '014' 
  AND master_data_entries.entry_id = m.old_vessel_id;

-- =====================================================
-- PHASE 3A: Migrate crew_members vessel references
-- =====================================================
UPDATE crew_members 
SET present_vessel = m.new_vessel_id
FROM vessel_id_mappings m
WHERE crew_members.present_vessel = m.old_vessel_id;

UPDATE crew_members 
SET last_vessel = m.new_vessel_id
FROM vessel_id_mappings m
WHERE crew_members.last_vessel = m.old_vessel_id;

-- =====================================================
-- PHASE 3B: Migrate vessel_planning and rotation tables
-- =====================================================
UPDATE vessel_planning 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE vessel_planning.vessel_id = m.old_vessel_id;

UPDATE rotation_archive 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE rotation_archive.vessel_id = m.old_vessel_id;

-- rotation_plans.vessels is a JSON column with vessel names/codes
-- We need to update the JSON content
UPDATE rotation_plans
SET vessels = (
    SELECT jsonb_agg(
        CASE 
            WHEN m.old_vessel_id IS NOT NULL THEN m.new_vessel_id
            ELSE v.value
        END
    )::text
    FROM jsonb_array_elements_text(rotation_plans.vessels::jsonb) v
    LEFT JOIN vessel_id_mappings m ON v.value = m.old_vessel_id
)
WHERE vessels IS NOT NULL 
  AND vessels != '' 
  AND vessels != '[]';

-- =====================================================
-- PHASE 3C: Migrate rest_hours tables
-- =====================================================
UPDATE rest_hours_vessel_records 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE rest_hours_vessel_records.vessel_id = m.old_vessel_id;

UPDATE rest_hours_crew_records 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE rest_hours_crew_records.vessel_id = m.old_vessel_id;

UPDATE rest_hours_daily_records 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE rest_hours_daily_records.vessel_id = m.old_vessel_id;

-- =====================================================
-- PHASE 3D: Migrate other modules
-- =====================================================

-- Drug & Alcohol test records
UPDATE drug_alcohol_test_records 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE drug_alcohol_test_records.vessel_id = m.old_vessel_id;

-- Training matrix tables
UPDATE training_matrix_vessel_drafts 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE training_matrix_vessel_drafts.vessel_id = m.old_vessel_id;

UPDATE training_matrix_vessel_revisions 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE training_matrix_vessel_revisions.vessel_id = m.old_vessel_id;

-- Vessel drafts and revisions
UPDATE vessel_drafts 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE vessel_drafts.vessel_id = m.old_vessel_id;

UPDATE vessel_revisions 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE vessel_revisions.vessel_id = m.old_vessel_id;

-- NOTE: vessel_ranks and revisions tables have INTEGER vessel_id columns
-- that reference vessels.id (internal numeric IDs 1-6), NOT the VSL-XXX entry_ids
-- These tables do NOT need migration as they reference the internal vessels table

-- NC Reports
UPDATE nc_reports 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE nc_reports.vessel_id = m.old_vessel_id;

-- Violation comments
UPDATE vessel_violation_comments 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE vessel_violation_comments.vessel_id = m.old_vessel_id;

UPDATE office_violation_comments 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE office_violation_comments.vessel_id = m.old_vessel_id;

-- Variable and Fixed tasks
UPDATE variable_tasks 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE variable_tasks.vessel_id = m.old_vessel_id;

UPDATE fixed_tasks 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE fixed_tasks.vessel_id = m.old_vessel_id;

-- Vessel dateline adjustments
UPDATE vessel_dateline_adjustments 
SET vessel_id = m.new_vessel_id
FROM vessel_id_mappings m
WHERE vessel_dateline_adjustments.vessel_id = m.old_vessel_id;

-- Vessel groups (JSON array of vessel IDs)
UPDATE vessel_groups
SET vessel_ids = (
    SELECT jsonb_agg(
        CASE 
            WHEN m.new_vessel_id IS NOT NULL THEN m.new_vessel_id
            ELSE v.value
        END
    )::text
    FROM jsonb_array_elements_text(vessel_groups.vessel_ids::jsonb) v
    LEFT JOIN vessel_id_mappings m ON v.value = m.old_vessel_id
)
WHERE vessel_ids IS NOT NULL 
  AND vessel_ids != '' 
  AND vessel_ids != '[]';
