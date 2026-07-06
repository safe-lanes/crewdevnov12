-- 0156: Register Training Category (026) in the Data Masters list.
-- The actual category values live in master_training_category (migration 0155);
-- this entry only makes Training Category appear in the Admin > Masters list.

INSERT INTO data_masters (id, name, description)
VALUES ('026', 'Training Category', 'Training-item category values per module (Recruitment, Appraisal, Promotion, Training & Retention)')
ON CONFLICT (id) DO NOTHING;
