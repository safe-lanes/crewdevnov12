-- ROLLBACK Migration: Revert vessel IDs from external SAIL ERP API UUIDs back to local VSL-XXX format
-- Use this migration ONLY if you need to rollback the changes made by 0038_migrate_vessel_ids_to_external_api.sql
-- This file should NOT be applied automatically - it's for emergency rollback only
-- Date: 2024-12-24

-- =====================================================
-- ROLLBACK PHASE 1: Revert Master 014 vessel entries
-- =====================================================
UPDATE master_data_entries 
SET entry_id = m.old_vessel_id, name = m.old_vessel_name
FROM vessel_id_mappings m
WHERE master_data_entries.master_id = '014' 
  AND master_data_entries.entry_id = m.new_vessel_id;

-- =====================================================
-- ROLLBACK PHASE 2: Revert crew_members vessel references
-- =====================================================
UPDATE crew_members 
SET present_vessel = m.old_vessel_id
FROM vessel_id_mappings m
WHERE crew_members.present_vessel = m.new_vessel_id;

UPDATE crew_members 
SET last_vessel = m.old_vessel_id
FROM vessel_id_mappings m
WHERE crew_members.last_vessel = m.new_vessel_id;

-- =====================================================
-- ROLLBACK PHASE 3: Revert vessel_planning and rotation tables
-- =====================================================
UPDATE vessel_planning 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE vessel_planning.vessel_id = m.new_vessel_id;

UPDATE rotation_archive 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE rotation_archive.vessel_id = m.new_vessel_id;

UPDATE rotation_plans
SET vessels = (
    SELECT jsonb_agg(
        CASE 
            WHEN m.old_vessel_id IS NOT NULL THEN m.old_vessel_id
            ELSE v.value
        END
    )::text
    FROM jsonb_array_elements_text(rotation_plans.vessels::jsonb) v
    LEFT JOIN vessel_id_mappings m ON v.value = m.new_vessel_id
)
WHERE vessels IS NOT NULL 
  AND vessels != '' 
  AND vessels != '[]';

-- =====================================================
-- ROLLBACK PHASE 4: Revert rest_hours tables
-- =====================================================
UPDATE rest_hours_vessel_records 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE rest_hours_vessel_records.vessel_id = m.new_vessel_id;

UPDATE rest_hours_crew_records 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE rest_hours_crew_records.vessel_id = m.new_vessel_id;

UPDATE rest_hours_daily_records 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE rest_hours_daily_records.vessel_id = m.new_vessel_id;

-- =====================================================
-- ROLLBACK PHASE 5: Revert other modules
-- =====================================================
UPDATE drug_alcohol_test_records 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE drug_alcohol_test_records.vessel_id = m.new_vessel_id;

UPDATE training_matrix_vessel_drafts 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE training_matrix_vessel_drafts.vessel_id = m.new_vessel_id;

UPDATE training_matrix_vessel_revisions 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE training_matrix_vessel_revisions.vessel_id = m.new_vessel_id;

UPDATE vessel_drafts 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE vessel_drafts.vessel_id = m.new_vessel_id;

UPDATE vessel_revisions 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE vessel_revisions.vessel_id = m.new_vessel_id;

-- NOTE: vessel_ranks and revisions tables have INTEGER vessel_id columns
-- that reference vessels.id (internal numeric IDs), NOT the UUID entry_ids
-- These tables do NOT need rollback as they reference the internal vessels table

UPDATE nc_reports 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE nc_reports.vessel_id = m.new_vessel_id;

UPDATE vessel_violation_comments 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE vessel_violation_comments.vessel_id = m.new_vessel_id;

UPDATE office_violation_comments 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE office_violation_comments.vessel_id = m.new_vessel_id;

UPDATE variable_tasks 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE variable_tasks.vessel_id = m.new_vessel_id;

UPDATE fixed_tasks 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE fixed_tasks.vessel_id = m.new_vessel_id;

UPDATE vessel_dateline_adjustments 
SET vessel_id = m.old_vessel_id
FROM vessel_id_mappings m
WHERE vessel_dateline_adjustments.vessel_id = m.new_vessel_id;

UPDATE vessel_groups
SET vessel_ids = (
    SELECT jsonb_agg(
        CASE 
            WHEN m.old_vessel_id IS NOT NULL THEN m.old_vessel_id
            ELSE v.value
        END
    )::text
    FROM jsonb_array_elements_text(vessel_groups.vessel_ids::jsonb) v
    LEFT JOIN vessel_id_mappings m ON v.value = m.new_vessel_id
)
WHERE vessel_ids IS NOT NULL 
  AND vessel_ids != '' 
  AND vessel_ids != '[]';

-- Note: Keep the vessel_id_mappings table for reference
-- To fully rollback, you can optionally drop it:
-- DROP TABLE IF EXISTS vessel_id_mappings;
