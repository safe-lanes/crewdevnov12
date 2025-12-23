-- Migration: Add Crew Pool Master (022)
-- This migration adds the Crew Pool master data category for managing crew pool groupings

INSERT INTO data_masters (id, name, description)
SELECT '022', 'Crew Pool', 'Crew pool groupings'
WHERE NOT EXISTS (SELECT 1 FROM data_masters WHERE id = '022');
