-- Migration 0113: Add "Users" entry under Admin in Access Control matrix
-- Adds the missing menu row consumed by /admin/users (sidebar + AdminModule
-- already reference it as "Users") and backfills permissions so any role that
-- currently has access on "Access Control" gets the same access on "Users".

-- 0) Resync serial sequences. Some tenant DBs have drifted (e.g. from manual
--    inserts or restores), causing nextval() to collide with existing rows.
SELECT setval(
  pg_get_serial_sequence('adm_menumaster_ac', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM adm_menumaster_ac), 1)
);
SELECT setval(
  pg_get_serial_sequence('adm_roleaccess_ac', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM adm_roleaccess_ac), 1)
);

-- 1) Insert the Users menu under the Admin parent.
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Users', 'Users', '/admin/users', 6)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (
  SELECT muid FROM adm_menumaster_ac
  WHERE name = 'Admin' AND parent_menu IS NULL
  LIMIT 1
) p
ON CONFLICT (name) DO NOTHING;

-- 2) Backfill role permissions: clone whatever each role has on "Access Control"
--    onto the new "Users" menu, so admin-equivalent roles do not silently lose
--    access to /admin/users when this menu becomes permission-gated.
INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete, sort_order)
SELECT
  gen_random_uuid(),
  ra.role_id,
  users_menu.muid,
  ra.canview,
  ra.cancreate,
  ra.canedit,
  ra.candelete,
  COALESCE(ra.sort_order, 0)
FROM adm_roleaccess_ac ra
JOIN adm_menumaster_ac ac_menu
  ON ac_menu.muid = ra.menu_id
 AND ac_menu.name = 'Access Control'
 AND ac_menu.is_deleted = false
CROSS JOIN (
  SELECT muid FROM adm_menumaster_ac
  WHERE name = 'Users' AND is_deleted = false
  LIMIT 1
) users_menu
WHERE ra.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM adm_roleaccess_ac existing
    WHERE existing.role_id = ra.role_id
      AND existing.menu_id = users_menu.muid
      AND existing.is_deleted = false
  );
