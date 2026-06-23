-- Migration 0139: RBAC — register the Account (payroll) module in Access Control.
-- Adds the 'Account' top-level menu plus its in-module sections as submenus,
-- matching the nav order in HeaderComponent (between Reports and Admin) and the
-- section routes used by client/src/modules/accounts/AccountsModule.tsx.
--
-- adm_menumaster_ac.name is UNIQUE, so all inserts are idempotent via
-- ON CONFLICT (name) DO NOTHING.
--
-- NOTE: This migration does NOT seed adm_roleaccess_ac. Administrators grant
-- View access per role manually from the Access Control admin page. Until a role
-- is granted, PermissionsContext denies the new menu for that role (menus with a
-- registered entry but no grant are hidden/blocked).

-- =========================================================================
-- 1. Make room: shift Admin to sort_order 12 so Account can take 11.
-- =========================================================================
UPDATE adm_menumaster_ac SET sort_order = 12 WHERE name = 'Admin' AND parent_menu IS NULL;

-- =========================================================================
-- 2. New top-level menu: Account
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order) VALUES
  (gen_random_uuid(), 'Account', 'Account', '/accounts', NULL, true, 11)
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 3. Account submenus (one per in-module section).
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Rate Tables & Rules', 'Rate Tables & Rules', '/accounts/rate-tables',         1),
  ('Contract Data',       'Contract Data',       '/accounts/contract-data',       2),
  ('CBA Tables',          'CBA Tables',          '/accounts/cba-tables',          3),
  ('Portage Bill',        'Portage Bill',        '/accounts/portage-bill',        4),
  ('Allotments Manager',  'Allotments Manager',  '/accounts/allotments-manager',  5),
  ('Advances & Bond',     'Advances & Bond',     '/accounts/advances-bond',       6),
  ('Bank Files & Returns','Bank Files & Returns','/accounts/bank-files-returns',  7),
  ('Account Reports',     'Reports',             '/accounts/reports',             8)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Account' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;
