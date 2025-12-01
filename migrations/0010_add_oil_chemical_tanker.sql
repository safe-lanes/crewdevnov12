-- Add Oil Chemical Tanker vessel type to Master 004
-- This vessel type carries both oil and chemical cargo
-- Experience on this type counts towards both Oil Tanker and Chemical Tanker by default

-- Step A: Ensure parent record exists in data_masters
-- Never assume master_id '004' exists - create it if missing
INSERT INTO data_masters (id, name, description)
SELECT '004', 'Vessel Type Master', 'Master data for vessel types including tankers, bulk carriers, and other vessel categories'
WHERE NOT EXISTS (SELECT 1 FROM data_masters WHERE id = '004');

-- Step B: Insert child record only after parent exists
-- Only insert if not already exists
INSERT INTO master_data_entries (
  master_id,
  entry_id,
  name,
  description,
  vtuid,
  "vesselType",
  tanker,
  "oilTanker",
  "gasTanker",
  "chemicalTanker",
  bulk,
  level,
  "parentId",
  code,
  "isActive",
  "createdBy"
)
SELECT
  '004',
  'VT019',
  'Oil Chemical Tanker',
  'Tanker capable of carrying both oil and chemical cargo',
  'OCT019',
  'Oil Chemical Tanker',
  true,
  true,
  false,
  true,
  false,
  2,
  'VT001',
  'OIL_CHEMICAL_TANKER',
  true,
  'system'
WHERE NOT EXISTS (
  SELECT 1 FROM master_data_entries 
  WHERE master_id = '004' AND entry_id = 'VT019'
);
