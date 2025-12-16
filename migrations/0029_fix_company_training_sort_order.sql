-- Migration: Fix Company Training sort order to match Training Master UI display order
-- Uses correct category order: S (Statutory) before N (Industry)

UPDATE company_trainings ct
SET sort_order = ranked.global_order
FROM (
  SELECT 
    ct2.id as company_training_id,
    ROW_NUMBER() OVER (
      ORDER BY 
        CASE tm.category 
          WHEN 'S' THEN 1  -- Statutory first
          WHEN 'N' THEN 2  -- Industry second
          ELSE 3           -- Others last
        END ASC,
        tm.training_group ASC,
        tm.sort_order ASC
    ) as global_order
  FROM company_trainings ct2
  JOIN training_master tm ON ct2.training_master_id = tm.id
) ranked
WHERE ct.id = ranked.company_training_id;
