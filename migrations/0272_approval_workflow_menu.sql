-- 0272: Access Control menu "Approval Workflow" (Admin → Approval Workflow).
-- The approval engine allows saving a chain or switching a flow on/off only with Access Control
-- EDIT on this menu (server/v2/approvals/mount.ts). The menu was never seeded (0096 seeds the
-- other Admin menus), so without it nobody could configure approvals.
-- Grants: Sail Admin and Super Admin get view + edit; every other role is granted in the
-- Access Control screen as usual.
-- Idempotent: name-based lookups, ON CONFLICT (name) / NOT EXISTS, no hardcoded ids.

INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), 'Approval Workflow', 'Approval Workflow', '/admin/approval-workflow', p.muid, true, 6
FROM (SELECT muid FROM adm_menumaster_ac WHERE name = 'Admin' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete)
SELECT gen_random_uuid(), r.ruid, m.muid, true, false, true, false
FROM adm_rolemaster_ac r
CROSS JOIN adm_menumaster_ac m
WHERE m.name = 'Approval Workflow'
  AND COALESCE(m.is_deleted, false) = false
  AND r.assigned_role IN ('Sail Admin', 'Super Admin')
  AND COALESCE(r.is_deleted, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM adm_roleaccess_ac ra
    WHERE ra.role_id = r.ruid AND ra.menu_id = m.muid AND COALESCE(ra.is_deleted, false) = false
  );
