-- Migration 0164: Register the Accounts Allotments and Cash & Bond pages in RBAC.
--
-- Adds the two crew-finance office pages as RBAC-gated menus under the
-- top-level 'Account' menu:
--   - Account Allotments   /accounts/crew-finance/allotments
--   - Account Cash & Bond  /accounts/crew-finance/cash-bond
--
-- Role permissions are seeded by copying each role's grant on the top-level
-- 'Account' menu (same pattern as migrations 0155/0158/0160/0162). Roles with
-- no Account grant get no row (default no access). adm_menumaster_ac.name is
-- UNIQUE globally, so names are prefixed with 'Account ' and the insert uses
-- ON CONFLICT (name) DO NOTHING. Fully idempotent and safe to re-run.

-- =========================================================================
-- 1. Register the new page menus under the top-level 'Account' menu.
--    Sort order continues after the 0162 page (9).
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Account Allotments', 'Allotments', '/accounts/crew-finance/allotments', 10),
  ('Account Cash & Bond', 'Cash & Bond', '/accounts/crew-finance/cash-bond', 11)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (
  SELECT muid FROM adm_menumaster_ac WHERE name = 'Account' AND parent_menu IS NULL LIMIT 1
) p
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 2. Seed role permissions by copying each role's pattern from the
--    top-level 'Account' menu. Idempotent via NOT EXISTS.
-- =========================================================================
INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete)
SELECT gen_random_uuid(), src.role_id, m.muid, src.canview, src.cancreate, src.canedit, src.candelete
FROM adm_roleaccess_ac src
JOIN adm_menumaster_ac am ON am.muid = src.menu_id AND am.name = 'Account' AND am.parent_menu IS NULL
JOIN adm_rolemaster_ac r ON r.ruid = src.role_id AND COALESCE(r.roletype, 'Office') <> 'Ship'
CROSS JOIN adm_menumaster_ac m
WHERE m.name IN ('Account Allotments', 'Account Cash & Bond')
AND NOT EXISTS (
  SELECT 1 FROM adm_roleaccess_ac ra
  WHERE ra.role_id = src.role_id AND ra.menu_id = m.muid
);
