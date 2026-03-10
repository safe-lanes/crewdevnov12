-- Migration 0104: Add Promotion form section menus for per-section visibility control
-- Sections: A (Criteria Review), B (Approval), C (Execution)
-- Only canView is meaningful for these menus (view-only gating).

INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('PM Criteria Review', 'Criteria Review', '/promotions/criteria-review', 2),
  ('PM Approval', 'Approval', '/promotions/approval', 3),
  ('PM Execution', 'Execution', '/promotions/execution', 4)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Promotions' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Grant canview=true (and other perms false) to all existing roles for the new menus
INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete)
SELECT
  gen_random_uuid(),
  r.ruid,
  m.muid,
  true,
  false,
  false,
  false
FROM adm_rolemaster_ac r
CROSS JOIN adm_menumaster_ac m
WHERE m.name IN ('PM Criteria Review', 'PM Approval', 'PM Execution')
  AND NOT EXISTS (
    SELECT 1 FROM adm_roleaccess_ac ra WHERE ra.role_id = r.ruid AND ra.menu_id = m.muid
  );
