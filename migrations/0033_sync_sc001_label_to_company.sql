-- Comprehensive sync of Training Master to company_trainings
-- This migration ensures all Training Master entries with applicable_to_company=true 
-- are properly synced to company_trainings, including any that were added/updated via SQL

-- Step 1: Update all existing company_trainings records to match their Training Master labels
UPDATE company_trainings ct
SET training_label = COALESCE(tm.training_label, tm.training_name)
FROM training_master tm
WHERE ct.training_master_id = tm.id
  AND tm.applicable_to_company = true
  AND ct.training_label != COALESCE(tm.training_label, tm.training_name);

-- Step 2: Insert any missing company_trainings for Training Master entries with applicable_to_company=true
-- that don't already exist in company_trainings
INSERT INTO company_trainings (training_master_id, company_id, training_label, abr, requirement, sort_order, group_code)
SELECT 
    tm.id,
    tm.training_id,
    COALESCE(tm.training_label, tm.training_name),
    NULL,
    tm.requirement_reference,
    tm.sort_order,
    NULL
FROM training_master tm
WHERE tm.applicable_to_company = true
  AND NOT EXISTS (
    SELECT 1 FROM company_trainings ct WHERE ct.training_master_id = tm.id
  );
