INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order, is_deleted, is_sync)
VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'RH Lock',
    'RH Lock',
    '/rest-hours/record/lock',
    '15532af4-7493-4205-9047-da3bd8488131',
    true,
    4,
    false,
    false
  ),
  (
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'RH Unlock',
    'RH Unlock',
    '/rest-hours/record/unlock',
    '15532af4-7493-4205-9047-da3bd8488131',
    true,
    5,
    false,
    false
  )
ON CONFLICT (name) DO NOTHING;
