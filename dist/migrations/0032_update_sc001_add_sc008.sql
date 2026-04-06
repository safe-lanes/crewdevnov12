-- Update SC001 to separate Oil Tanker training and add SC008 for Chemical Tanker training
-- SC001: Change from "Basic Training for Oil & Chemical Tanker Cargo Operations" to "Basic Training for Oil Tanker Cargo operations"
-- SC008: New entry for "Basic Training for Chemical Tanker Cargo operations"

-- Update SC001 name and label
UPDATE training_master 
SET training_name = 'Basic Training for Oil Tanker Cargo operations',
    training_label = 'Basic Training for Oil Tanker Cargo operations'
WHERE training_id = 'SC001';

-- Insert SC008 - Basic Training for Chemical Tanker Cargo operations
-- Position it after SC007 with sort_order 8
INSERT INTO training_master (training_id, training_name, category, training_group, requirement_reference, applicable_to_company, training_label, sort_order, is_default)
VALUES ('SC008', 'Basic Training for Chemical Tanker Cargo operations', 'S', 'C', 'STCW V/1-1, Table A-V/1-1-1', false, 'Basic Training for Chemical Tanker Cargo operations', 8, true)
ON CONFLICT (training_id) DO UPDATE SET
    training_name = EXCLUDED.training_name,
    training_label = EXCLUDED.training_label,
    category = EXCLUDED.category,
    training_group = EXCLUDED.training_group,
    requirement_reference = EXCLUDED.requirement_reference;
