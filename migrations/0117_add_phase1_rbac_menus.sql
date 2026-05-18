-- Migration 0117: RBAC Phase 1 — register new modules in Access Control
-- Modules: Main Dashboard (top-level), Crew Pool > Terminated,
--          Training & Ret. (top-level) > Training / Retention,
--          Reports category submenus.
--
-- NOTE: 'Main Dashboard' (display_name "Dashboard") is used because the name
-- 'Dashboard' already exists as a Rest Hours submenu in migration 0096
-- (adm_menumaster_ac.name has a UNIQUE constraint).
--
-- NOTE: Per Phase 1 decision, this migration does NOT seed adm_roleaccess_ac.
-- Administrators will grant View access per role from the Access Control admin
-- page after this migration runs. Until then, roles will see "Access Restricted"
-- on these pages (Dashboard redirects to /recruitment via fallbackRoute).

-- =========================================================================
-- 1. New top-level menus: Main Dashboard, Training & Ret.
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order) VALUES
  (gen_random_uuid(), 'Main Dashboard', 'Dashboard',      '/dashboard',          NULL, true, 0),
  (gen_random_uuid(), 'Training & Ret.', 'Training & Ret.', '/training-retention', NULL, true, 11)
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 2. Crew Pool submenu: Terminated
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Terminated', 'Terminated', '/crew-pool/terminated', 7)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Crew Pool' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 3. Training & Ret. submenus: Training, Retention
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
-- 4. Reports category submenus
--    Mirrors the category groupings in client/src/pages/ReportsPage.tsx.
--    Routes are synthetic (Reports is a single page that filters by category);
--    they exist only to satisfy the unique route constraint and let Access
--    Control list the categories.
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Reports Recruitment',    'Recruitment',     '/reports/recruitment',    1),
  ('Reports Vessel',         'Vessel',          '/reports/vessel',         2),
  ('Reports Crew Pool',      'Crew Pool',       '/reports/crew-pool',      3),
  ('Reports Rotation',       'Rotation',        '/reports/rotation',       4),
  ('Reports Promotion',      'Promotion',       '/reports/promotion',      5),
  ('Reports Appraisals',     'Appraisals',      '/reports/appraisals',     6),
  ('Reports Drug Alcohol',   'Drug & Alcohol',  '/reports/drug-alcohol',   7),
  ('Reports Rest Hours',     'Rest Hours',      '/reports/rest-hours',     8),
  ('Reports Training',       'Training',        '/reports/training',       9)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Reports' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;
