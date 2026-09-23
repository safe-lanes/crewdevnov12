-- Registers the 'Crew Portal Submissions' menu (office review queue for
-- crew-app entries awaiting verification) under the top-level 'Crew Pool'
-- menu, and seeds office-role permissions by copying each role's grant
-- pattern from 'Crew Database' (same office-only screen shape). Ship roles
-- get no row. Idempotent and safe to re-run — same pattern as 0187.

INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), 'Crew Portal Submissions', 'Crew Portal Submissions', '/crew-pool/portal-submissions', p.muid, true, 2
FROM (
  SELECT muid FROM adm_menumaster_ac WHERE name = 'Crew Pool' AND parent_menu IS NULL LIMIT 1
) p
ON CONFLICT (name) DO NOTHING;

INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete)
SELECT gen_random_uuid(), src.role_id, m.muid, src.canview, src.cancreate, src.canedit, src.candelete
FROM adm_roleaccess_ac src
JOIN adm_menumaster_ac am ON am.muid = src.menu_id AND am.name = 'Crew Database'
JOIN adm_rolemaster_ac r ON r.ruid = src.role_id AND COALESCE(r.roletype, 'Office') <> 'Ship'
CROSS JOIN adm_menumaster_ac m
WHERE m.name = 'Crew Portal Submissions'
AND NOT EXISTS (
  SELECT 1 FROM adm_roleaccess_ac ra
  WHERE ra.role_id = src.role_id AND ra.menu_id = m.muid
);
