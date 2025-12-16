-- Migration: Update company_trainings to populate companyId and requirement from training_master
-- Copy trainingId → companyId and requirementReference → requirement

UPDATE company_trainings ct
SET 
  company_id = tm.training_id,
  requirement = tm.requirement_reference
FROM training_master tm
WHERE ct.training_master_id = tm.id;
