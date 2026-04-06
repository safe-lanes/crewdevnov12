-- Create Master 016 for License & DCE Templates
-- This master contains predefined certificate/document options that can be selected via "Add From Database"

-- First, create the master entry in data_masters if it doesn't exist
INSERT INTO data_masters (id, name, description)
SELECT '016', 'License & DCE Master', 'Predefined license and certificate templates for crew members'
WHERE NOT EXISTS (SELECT 1 FROM data_masters WHERE id = '016');

-- Insert the 17 predefined license/certificate options
-- Using: name = Certificate/Document, shortCode = Abbreviation, description = Requirement

-- DCE Certificates
INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC001', 'DCE_Oil_Operation', 'DC_O_O', 'STCW A-V1-1-1', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC001');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC002', 'DCE_Oil_Management', 'DC_O_M', 'STCW A-V1-1-2', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC002');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC003', 'DCE_Chem_Operation', 'DC_C_O', 'STCW A-V1-1-1', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC003');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC004', 'DCE_Chem_Management', 'DC_C_M', 'STCW A-V1-1-3', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC004');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC005', 'DCE_Gas_Operation', 'DC_G_O', 'STCW A-V1-2-1', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC005');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC006', 'DCE_Gas_Management', 'DC_G_M', 'STCW A-V1-2-2', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC006');

-- COC Certificates
INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC007', 'COC Master', 'COC_DM', 'STCW II/2', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC007');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC008', 'COC Chief Mate', 'COC_DC', 'STCW II/2', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC008');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC009', 'COC OIC Nav Watch', 'COC_DW', 'STCW II/1', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC009');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC010', 'COC Chief Engineer', 'COC_EC', 'STCW III/2', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC010');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC011', 'COC 2nd Engineer', 'COC_ES', 'STCW III/2', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC011');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC012', 'COC OIC Eng Watch', 'COC_EW', 'STCW III/1', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC012');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC013', 'COC ETO', 'COC_EO', 'STCW III/6', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC013');

-- COP Certificates
INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC014', 'COP Deck Rating (AB)', 'COP_DRA', 'STCW II/5', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC014');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC015', 'COP Deck Rating (OS)', 'COP_DRB', 'STCW II/4', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC015');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC016', 'COP Engine Rating (ABE)', 'COP_ERA', 'STCW III/5', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC016');

INSERT INTO master_data_entries (master_id, entry_id, name, "shortCode", description, "isActive", "createdBy")
SELECT '016', 'LIC017', 'COP Engine Rating', 'COP_ERB', 'STCW III/4', true, 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_data_entries WHERE master_id = '016' AND entry_id = 'LIC017');
