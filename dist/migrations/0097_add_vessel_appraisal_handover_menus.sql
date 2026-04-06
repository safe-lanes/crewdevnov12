-- Migration 0097: Add Appraisal and Handover sub-menus under Vessel
-- These allow admin access control to show/hide the Appraisal and Handover columns in the Vessel Crew List

INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('Appraisal', 'Appraisal', '/vessel/crew-list/appraisal', 6),
  ('Handover', 'Handover', '/vessel/crew-list/handover', 7)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Vessel' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;
