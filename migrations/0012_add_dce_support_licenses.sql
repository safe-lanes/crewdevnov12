-- Add DCE Support Level Certificates to Master 016
-- These are the Support-level endorsements for Oil, Chem, and Gas dangerous cargo handling

-- Step A: Ensure parent record exists in data_masters
-- Never assume master_id '016' exists - create it if missing
INSERT INTO data_masters (id, name, description)
SELECT '016', 'License & DCE Master', 'Predefined license and certificate templates for crew members'
WHERE NOT EXISTS (SELECT 1 FROM data_masters WHERE id = '016');

-- Step B: Insert child records only after parent exists

-- DCE_Oil_Support
INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC018', 'DCE_Oil_Support', 'DC_O_S', 'STCW A-V1-1', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC018');

-- DCE_Chem_Support
INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC019', 'DCE_Chem_Support', 'DC_C_S', 'STCW A-V1-1', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC019');

-- DCE_Gas_Support
INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC020', 'DCE_Gas_Support', 'DC_G_S', 'STCW A-V1-2', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC020');
