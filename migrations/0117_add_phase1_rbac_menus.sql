-- Migration 0117: RBAC Phase 1 — register new modules in Access Control
-- Modules: Dashboard (top-level), Crew Pool > Terminated,
--          Training & Ret. (top-level) > Training / Retention,
--          Reports category submenus.
--
-- NOTE: 'Dashboard' already existed in migration 0096 as a Rest Hours submenu.
-- adm_menumaster_ac.name is UNIQUE, so this migration first renames that
-- submenu to 'Rest Hours Dashboard' (its display_name stays "Dashboard"),
-- freeing the canonical 'Dashboard' name for the new top-level menu. The
-- submenu's UUID is preserved, so existing adm_roleaccess_ac rows (keyed by
-- menu_id) remain valid.
--
-- NOTE: This migration does NOT seed adm_roleaccess_ac. Administrators
-- grant View access per role manually from the Access Control admin page.
-- Until then, the new top-level Dashboard route redirects to /recruitment
-- (via ProtectedRoute fallbackRoute), and the other new submenus are
-- hidden / blocked for roles without an explicit grant.

-- =========================================================================
-- 1. Resolve name collision: rename existing Rest Hours 'Dashboard' submenu.
--    Use the parent-scoped subquery so we only touch the Rest Hours submenu,
--    never any future top-level row.
-- =========================================================================
UPDATE adm_menumaster_ac
SET name = 'Rest Hours Dashboard'
WHERE name = 'Dashboard'
  AND parent_menu = (SELECT muid FROM adm_menumaster_ac WHERE name = 'Rest Hours' AND parent_menu IS NULL LIMIT 1);

-- =========================================================================
-- 2. Reorder existing top-level menus so 'Training & Ret.' (new, sort 9)
--    fits between Rest Hours (8) and Reports.
-- =========================================================================
UPDATE adm_menumaster_ac SET sort_order = 10 WHERE name = 'Reports'  AND parent_menu IS NULL;
UPDATE adm_menumaster_ac SET sort_order = 11 WHERE name = 'Admin'    AND parent_menu IS NULL;

-- =========================================================================
-- 3. New top-level menus: Dashboard, Training & Ret.
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order) VALUES
  (gen_random_uuid(), 'Dashboard',       'Dashboard',       '/dashboard',          NULL, true, 0),
  (gen_random_uuid(), 'Training & Ret.', 'Training & Ret.', '/training-retention', NULL, true, 9)
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 4. Crew Pool submenu: Terminated
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Terminated', 'Terminated', '/crew-pool/terminated', 7)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Crew Pool' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 5. Training & Ret. submenus: Training, Retention
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Training',  'Training',  '/training-retention/training',  1),
  ('Retention', 'Retention', '/training-retention/retention', 2)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Training & Ret.' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 6. Reports category submenus
--    Mirrors REPORT_TREE in client/src/pages/ReportsPage.tsx. Reports is a
--    single page with a category tree picker (no real per-category routes);
--    synthetic routes /reports/<category> satisfy the unique route
--    constraint and let Access Control list the categories.
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Reports Recruitment',  'Recruitment',    '/reports/recruitment',  1),
  ('Reports Vessel',       'Vessel',         '/reports/vessel',       2),
  ('Reports Crew Pool',    'Crew Pool',      '/reports/crew-pool',    3),
  ('Reports Rotation',     'Rotation',       '/reports/rotation',     4),
  ('Reports Promotion',    'Promotion',      '/reports/promotion',    5),
  ('Reports Appraisals',   'Appraisals',     '/reports/appraisals',   6),
  ('Reports Drug Alcohol', 'Drug & Alcohol', '/reports/drug-alcohol', 7),
  ('Reports Rest Hours',   'Rest Hours',     '/reports/rest-hours',   8),
  ('Reports Training',     'Training',       '/reports/training',     9)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Reports' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;
