-- Migration 0096: Seed menu data for Access Control
-- Inserts all application menus and submenus into adm_menumaster_ac

-- Top-level menus (11 main navigation items)
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order) VALUES
  (gen_random_uuid(), 'Crewing', 'crewing', '/', NULL, true, 1),
  (gen_random_uuid(), 'Recruitment', 'Recruitment', '/recruitment', NULL, true, 2),
  (gen_random_uuid(), 'Crew Pool', 'Crew Pool', '/crew-pool', NULL, true, 3),
  (gen_random_uuid(), 'Vessel', 'Vessel', '/vessel', NULL, true, 4),
  (gen_random_uuid(), 'Rotation', 'Rotation', '/rotation', NULL, true, 5),
  (gen_random_uuid(), 'Promotions', 'Promotions', '/promotions', NULL, true, 6),
  (gen_random_uuid(), 'Appraisals', 'Appraisals', '/appraisals', NULL, true, 7),
  (gen_random_uuid(), 'Drugs Alcohol', 'Drugs Alcohol', '/drugs-alcohol', NULL, true, 8),
  (gen_random_uuid(), 'Rest Hours', 'Rest Hours', '/rest-hours', NULL, true, 9),
  (gen_random_uuid(), 'Reports', 'Reports', '/reports', NULL, true, 10),
  (gen_random_uuid(), 'Admin', 'Admin', '/admin', NULL, true, 11)
ON CONFLICT (name) DO NOTHING;

-- Recruitment submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('In Progress', 'In Progress', '/recruitment/in-progress', 1),
  ('Recruited', 'Recruited', '/recruitment/recruited', 2),
  ('Waitlist', 'Waitlist', '/recruitment/waitlist', 3),
  ('Rejected', 'Rejected', '/recruitment/rejected', 4)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Recruitment' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Crew Pool submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Crew Database', 'Crew Database', '/crew-pool/crew-database', 1)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Crew Pool' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Vessel submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Vessel Database', 'Vessel Database', '/vessel/vessel-database', 1),
  ('Crew List', 'Crew List', '/vessel/crew-list', 2),
  ('Training Matrix', 'Training Matrix', '/vessel/training-matrix', 3),
  ('Officer Matrix', 'Officer Matrix', '/vessel/officer-matrix', 4),
  ('Planning', 'Planning', '/vessel/planning', 5)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Vessel' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Rotation submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Due', 'Due', '/rotation/due', 1),
  ('Plan', 'Plan', '/rotation/plan', 2),
  ('Approval', 'Approval', '/rotation/approval', 3)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Rotation' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Promotions submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Promotions All', 'All', '/promotions/all', 1)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Promotions' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Appraisals submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Appraisals All', 'All', '/appraisals/all', 1)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Appraisals' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Drugs Alcohol submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Annual', 'Annual', '/drugs-alcohol/annual', 1),
  ('Periodic', 'Periodic', '/drugs-alcohol/periodic', 2),
  ('Monthly', 'Monthly', '/drugs-alcohol/monthly', 3),
  ('Post Incident', 'Post Incident', '/drugs-alcohol/post-incident', 4),
  ('Others', 'Others', '/drugs-alcohol/others', 5),
  ('Summary', 'Summary', '/drugs-alcohol/summary', 6)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Drugs Alcohol' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Rest Hours submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Dashboard', 'Dashboard', '/rest-hours/dashboard', 1),
  ('Record', 'Record', '/rest-hours/record', 2),
  ('Rest Hours Plan', 'Plan', '/rest-hours/plan', 3)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Rest Hours' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Admin submenus
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Forms', 'Forms', '/admin/forms', 1),
  ('Rank Admin', 'Rank Admin', '/admin/rank-admin', 2),
  ('Masters', 'Masters', '/admin/masters', 3),
  ('Admin Training Matrix', 'Training Matrix', '/admin/training-matrix', 4),
  ('Access Control', 'Access Control', '/admin/access-control', 5)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Admin' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;
