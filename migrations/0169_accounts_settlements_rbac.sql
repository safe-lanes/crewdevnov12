-- Migration 0160: Register the Accounts Settlements page in RBAC.
--
-- Activates the previously "coming soon" Settlements page as an RBAC-gated
-- menu under the top-level 'Account' menu:
--   - Account Settlements  /accounts/payroll/settlements
--
-- Role permissions are seeded by copying each role's grant on the top-level
-- 'Account' menu (same pattern as migrations 0155/0158). Roles with no
-- Account grant get no row (default no access). adm_menumaster_ac.name is
-- UNIQUE globally, so the name is prefixed with 'Account ' and the insert
-- uses ON CONFLICT (name) DO NOTHING. Fully idempotent and safe to re-run.

-- =========================================================================
-- 1. Register the new page menu under the top-level 'Account' menu.
--    Sort order continues after the 0158 pages (5-7).
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Account Settlements', 'Settlements', '/accounts/payroll/settlements', 8)
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
WHERE m.name IN ('Account Settlements')
AND NOT EXISTS (
  SELECT 1 FROM adm_roleaccess_ac ra
  WHERE ra.role_id = src.role_id AND ra.menu_id = m.muid
);
