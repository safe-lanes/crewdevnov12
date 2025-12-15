-- Migration: Backfill company_trainings for existing training_master records with applicableToCompany=true
-- This ensures existing trainings marked as "Applicable to Company" appear in the Company tab

INSERT INTO company_trainings (training_master_id, company_id, training_label, abr, requirement, sort_order)
SELECT 
  tm.id as training_master_id,
  'COMPANY' as company_id,
  tm.training_label as training_label,
  NULL as abr,
  NULL as requirement,
  tm.sort_order as sort_order
FROM training_master tm
WHERE tm.applicable_to_company = true
  AND NOT EXISTS (
    SELECT 1 FROM company_trainings ct WHERE ct.training_master_id = tm.id
  );
