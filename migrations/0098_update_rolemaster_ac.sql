-- Migration 0098: Update adm_rolemaster_ac ruid and role assignments

-- Query 1: Update ruid values for ids 1-15
UPDATE adm_rolemaster_ac
SET ruid = CASE id
    WHEN 1 THEN 'd57dd06b-7c4f-4152-8902-c8af0422b3e6'
    WHEN 2 THEN '102d9bb7-cd0f-4514-b6c7-09b5b5a99912'
    WHEN 3 THEN '5f06d995-832d-42ba-96bd-7928ab9f099b'
    WHEN 4 THEN '5f06d995-832d-42ba-96bd-7928ab9f099c'
    WHEN 5 THEN '5f06d995-832d-42ba-96bd-7928ab9f099d'
    WHEN 6 THEN '5f06d995-832d-42ba-96bd-7928ab9f099e'
    WHEN 7 THEN '5f06d995-832d-42ba-96bd-7928ab9f099f'
    WHEN 8 THEN '5f06d995-832d-42ba-96bd-7928ab9f099g'
    WHEN 9 THEN '5f06d995-832d-42ba-96bd-7928ab9f099s'
    WHEN 10 THEN '5f06d995-832d-42ba-96bd-7928ab9f099u'
    WHEN 11 THEN '5f06d995-832d-42ba-96bd-7928ab9f09io'
    WHEN 12 THEN '5f06d995-832d-42ba-96bd-7928ab9f098o'
    WHEN 13 THEN 'b1dcced3-0c2a-11ee-b5dc-0ab7f96323de'
    WHEN 14 THEN 'b1de8a10-0c2a-11ee-b5dc-0ab7f96323de'
    WHEN 15 THEN 'b1df5bd7-0c2a-11ee-b5dc-0ab7f96323de'
END
WHERE id BETWEEN 1 AND 15;

-- Query 2: Update assigned_role, roletype, and sort_order
UPDATE adm_rolemaster_ac
SET assigned_role = 'Vessel Management',
    roletype = 'Ship',
    sort_order = 6
WHERE id = 2;

UPDATE adm_rolemaster_ac
SET sort_order = 2
WHERE id = 3;

UPDATE adm_rolemaster_ac
SET sort_order = 3
WHERE id = 4;

UPDATE adm_rolemaster_ac
SET sort_order = 4
WHERE id = 5;

UPDATE adm_rolemaster_ac
SET sort_order = 5
WHERE id = 6;
