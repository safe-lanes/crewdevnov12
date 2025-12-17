-- Sync SC001 training_label from Training Master to company_trainings
-- This fixes the label that was updated in training_master but not synced to company_trainings

UPDATE company_trainings 
SET training_label = 'Basic Training for Oil Tanker Cargo operations'
WHERE training_master_id = (SELECT id FROM training_master WHERE training_id = 'SC001');
