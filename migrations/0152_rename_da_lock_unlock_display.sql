-- Rename the visible label of the DA lock permission in Admin Access Control
UPDATE adm_menumaster_ac
SET display_name = 'DA Form Lock / Unlock',
    updated_at = NOW()
WHERE muid = 'c3d4e5f6-a7b8-9012-cdef-123456789012'
  AND is_deleted = false;
