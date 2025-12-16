-- Migration: Align Company Training sort order with Training Master display order
-- Calculates global sequential sort order based on Training Master's category → training_group → sort_order

UPDATE company_trainings ct
SET sort_order = ranked.global_order
FROM (
  SELECT 
    ct2.id as company_training_id,
    ROW_NUMBER() OVER (
      ORDER BY tm.category ASC, tm.training_group ASC, tm.sort_order ASC
    ) as global_order
  FROM company_trainings ct2
  JOIN training_master tm ON ct2.training_master_id = tm.id
) ranked
WHERE ct.id = ranked.company_training_id;
