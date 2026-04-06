-- Migration: Add Fleet Group, Ports, and Language masters
-- Date: 2024-12-18
-- Description: Rename Vessel Type Master to Fleet Group (ID 015) and add new masters (017, 018, 019)

-- Rename existing master 015 from "Vessel Type Master" to "Fleet Group"
UPDATE data_masters SET name = 'Fleet Group' WHERE id = '015';

-- Add new masters with IDs 017, 018, 019
INSERT INTO data_masters (id, name, description) 
VALUES 
  ('017', 'Additional Group', 'Additional Group reference data'),
  ('018', 'Ports', 'Ports reference data'),
  ('019', 'Language', 'Language reference data')
ON CONFLICT (id) DO NOTHING;
