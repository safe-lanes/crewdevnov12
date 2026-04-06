-- Migration: Add Country Master (ID 020)
-- Date: 2024-12-19
-- Description: Add Country Master to data_masters for Admin -> Masters section

INSERT INTO data_masters (id, name, description) 
VALUES ('020', 'Country', 'Country reference data')
ON CONFLICT (id) DO NOTHING;
