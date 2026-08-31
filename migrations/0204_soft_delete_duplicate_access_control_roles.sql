-- Soft-delete the duplicate access-control roles created by a repeated default
-- role seed. Keep the rows as evidence and preserve every lower-id role/grant.

DO $$
DECLARE
  referenced_grants INTEGER;
  referenced_sections INTEGER;
BEGIN
  SELECT COUNT(*) INTO referenced_grants
  FROM adm_roleaccess_ac
  WHERE role_id IN (
    '93dea77c-6389-49f3-9ad9-6d68225f9640',
    'dd6b733f-3edc-4795-8582-f7fee10d4ec6',
    '883dda80-5f25-4ae9-8d04-a87583ee42cf',
    '277e6550-fea0-4b13-875e-dbbead3e5ab6',
    '18e536c7-e0df-40fc-a867-1c367e1a1f67',
    '34299522-df6b-42e8-8b39-2319e0bc1404',
    '6809fb30-c419-4820-a91d-499fc9c83701',
    '65b7376f-2e3f-4885-9a4d-f4b15092bf2c',
    '0d323122-912e-40fb-98ec-3f039f46e5b2',
    '14da2c90-f6ea-448d-94ce-538ecee82426',
    'f2d5bf0b-75a0-40d3-8a4d-2efa3a823048',
    '74bedef1-2e0c-4964-8dd1-2c585165f9fa',
    'd7adc27e-9e05-49e5-b8d4-a44f919840db'
  );

  SELECT COUNT(*) INTO referenced_sections
  FROM frm_sections
  WHERE responsible_role_uuid IN (
    '93dea77c-6389-49f3-9ad9-6d68225f9640',
    'dd6b733f-3edc-4795-8582-f7fee10d4ec6',
    '883dda80-5f25-4ae9-8d04-a87583ee42cf',
    '277e6550-fea0-4b13-875e-dbbead3e5ab6',
    '18e536c7-e0df-40fc-a867-1c367e1a1f67',
    '34299522-df6b-42e8-8b39-2319e0bc1404',
    '6809fb30-c419-4820-a91d-499fc9c83701',
    '65b7376f-2e3f-4885-9a4d-f4b15092bf2c',
    '0d323122-912e-40fb-98ec-3f039f46e5b2',
    '14da2c90-f6ea-448d-94ce-538ecee82426',
    'f2d5bf0b-75a0-40d3-8a4d-2efa3a823048',
    '74bedef1-2e0c-4964-8dd1-2c585165f9fa',
    'd7adc27e-9e05-49e5-b8d4-a44f919840db'
  );

  IF referenced_grants <> 0 OR referenced_sections <> 0 THEN
    RAISE EXCEPTION
      'Duplicate role cleanup stopped: grants=%, section references=%',
      referenced_grants,
      referenced_sections;
  END IF;

  UPDATE adm_rolemaster_ac
  SET is_deleted = true
  WHERE ruid IN (
    '93dea77c-6389-49f3-9ad9-6d68225f9640',
    'dd6b733f-3edc-4795-8582-f7fee10d4ec6',
    '883dda80-5f25-4ae9-8d04-a87583ee42cf',
    '277e6550-fea0-4b13-875e-dbbead3e5ab6',
    '18e536c7-e0df-40fc-a867-1c367e1a1f67',
    '34299522-df6b-42e8-8b39-2319e0bc1404',
    '6809fb30-c419-4820-a91d-499fc9c83701',
    '65b7376f-2e3f-4885-9a4d-f4b15092bf2c',
    '0d323122-912e-40fb-98ec-3f039f46e5b2',
    '14da2c90-f6ea-448d-94ce-538ecee82426',
    'f2d5bf0b-75a0-40d3-8a4d-2efa3a823048',
    '74bedef1-2e0c-4964-8dd1-2c585165f9fa',
    'd7adc27e-9e05-49e5-b8d4-a44f919840db'
  )
    AND is_deleted = false;
END
$$;