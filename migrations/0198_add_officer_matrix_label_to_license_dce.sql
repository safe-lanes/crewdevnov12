-- Migration 0198: Add officer_matrix_label to master_licenses_dce
-- Lets Officer Matrix Label (e.g. "Master II/2") be admin-editable per License/DCE entry,
-- instead of only existing hardcoded in client/src/utils/data/licenseDceTemplates.ts.

ALTER TABLE master_licenses_dce ADD COLUMN IF NOT EXISTS officer_matrix_label TEXT;

-- Backfill the 7 known COC rows from the existing hardcoded hierarchy values
-- (matches client/src/utils/data/licenseDceTemplates.ts COC_HIERARCHY), so the
-- License & DCE picker's Officer Matrix Label column keeps showing correct values.
UPDATE master_licenses_dce SET officer_matrix_label = 'Master II/2' WHERE entry_id = 'LIC007' AND officer_matrix_label IS NULL;
UPDATE master_licenses_dce SET officer_matrix_label = 'Chief Mate II/2' WHERE entry_id = 'LIC008' AND officer_matrix_label IS NULL;
UPDATE master_licenses_dce SET officer_matrix_label = 'OOW Deck II/1' WHERE entry_id = 'LIC009' AND officer_matrix_label IS NULL;
UPDATE master_licenses_dce SET officer_matrix_label = 'Chief Eng III/2' WHERE entry_id = 'LIC010' AND officer_matrix_label IS NULL;
UPDATE master_licenses_dce SET officer_matrix_label = 'Second Eng III/2' WHERE entry_id = 'LIC011' AND officer_matrix_label IS NULL;
UPDATE master_licenses_dce SET officer_matrix_label = 'OOW Eng III/1' WHERE entry_id = 'LIC012' AND officer_matrix_label IS NULL;
UPDATE master_licenses_dce SET officer_matrix_label = 'ETO III/6' WHERE entry_id = 'LIC013' AND officer_matrix_label IS NULL;
