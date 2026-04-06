-- Add Users Master (024) for SAIL Audits API user data
INSERT INTO data_masters (id, name, description)
SELECT '024', 'Users', 'System users from SAIL Audits API'
WHERE NOT EXISTS (
    SELECT 1 FROM data_masters WHERE id = '024'
);
