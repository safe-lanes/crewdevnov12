-- 0154: Register Training Status (025) in the Data Masters list.
-- The actual status values live in master_training_status (migration 0153);
-- this entry only makes Training Status appear in the Admin > Masters list.

INSERT INTO data_masters (id, name, description)
VALUES ('025', 'Training Status', 'Training-item status values per module (Promotion, Appraisal, Training & Retention)')
ON CONFLICT (id) DO NOTHING;
