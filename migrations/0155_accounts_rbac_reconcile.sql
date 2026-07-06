-- Migration 0155: RBAC reconciliation for the rebuilt Accounts module.
--
-- Migration 0141 registered an OLD Accounts submenu IA (Payrun Board, Rate
-- Tables & Rules, Contract Data, CBA Tables, Portage Bill, Allotments Manager,
-- Advances & Bond, Bank Files & Returns, Reports) whose routes no longer match
-- the rebuilt module. This migration:
--   1. De-registers those stale submenus (grants first for the FK, then menus).
--   2. Registers the NEW active page menus under the top-level 'Account' menu.
--   3. Seeds role permissions for the new pages by copying each role's grant on
--      the top-level 'Account' menu (a role with no Account grant gets no row).
--
-- Coming-soon sections (Payroll Run, Portage Bill, Allotments, Cash & Bond,
-- Monthly Transactions, Settlements, Reports) are intentionally NOT registered
-- here — they render as hard-coded disabled items in the module left nav, so
-- they add no Access Control surface and cannot collide with the globally-unique
-- adm_menumaster_ac.name of other modules.
--
-- adm_menumaster_ac.name is UNIQUE globally, so new page names are prefixed with
-- 'Account ' and inserts use ON CONFLICT (name) DO NOTHING. Fully idempotent and
-- safe to re-run per tenant.

-- =========================================================================
-- 1. De-register the stale 0141 Account submenus.
--    Delete role-access grants first (FK on menu_id), then the menu rows.
-- =========================================================================
DELETE FROM adm_roleaccess_ac
WHERE menu_id IN (
  SELECT muid FROM adm_menumaster_ac
  WHERE name IN (
    'Payrun Board', 'Rate Tables & Rules', 'Contract Data', 'CBA Tables',
    'Portage Bill', 'Allotments Manager', 'Advances & Bond',
    'Bank Files & Returns', 'Account Reports'
  )
);

DELETE FROM adm_menumaster_ac
WHERE name IN (
  'Payrun Board', 'Rate Tables & Rules', 'Contract Data', 'CBA Tables',
  'Portage Bill', 'Allotments Manager', 'Advances & Bond',
  'Bank Files & Returns', 'Account Reports'
);

-- =========================================================================
-- 2. Register the NEW active page menus under the top-level 'Account' menu.
--    Grouped in the UI under "Master Tables" and "Admin" (visual sections);
--    each functional page is its own RBAC-gated menu row.
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Account Pay Elements',        'Pay Elements',        '/accounts/master-tables/pay-elements', 1),
  ('Account Wage Scales',         'Wage Scales',         '/accounts/master-tables/wage-scales',  2),
  ('Account CBA Reference',       'CBA Reference',       '/accounts/master-tables/cba-reference', 3),
  ('Account Tenant Configuration','Tenant Configuration','/accounts/admin/tenant-config',        4)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (
  SELECT muid FROM adm_menumaster_ac WHERE name = 'Account' AND parent_menu IS NULL LIMIT 1
) p
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 3. Seed role permissions for the new pages by copying each role's pattern
--    from the top-level 'Account' menu. Roles with no Account grant get no
--    row (default no access). Idempotent via NOT EXISTS.
-- =========================================================================
INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete)
SELECT gen_random_uuid(), src.role_id, m.muid, src.canview, src.cancreate, src.canedit, src.candelete
FROM adm_roleaccess_ac src
JOIN adm_menumaster_ac am ON am.muid = src.menu_id AND am.name = 'Account' AND am.parent_menu IS NULL
CROSS JOIN adm_menumaster_ac m
WHERE m.name IN (
  'Account Pay Elements', 'Account Wage Scales',
  'Account CBA Reference', 'Account Tenant Configuration'
)
AND NOT EXISTS (
  SELECT 1 FROM adm_roleaccess_ac ra
  WHERE ra.role_id = src.role_id AND ra.menu_id = m.muid
);
