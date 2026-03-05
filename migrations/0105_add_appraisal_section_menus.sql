-- Migration 0105: Add Appraisal form section menus for per-section visibility control
-- Sections: A (Seafarer's Info), B (Start Info), C (Competence), D (Behavioural),
--           E (Training Needs), F (Summary), G (Office Review)
-- Only canView is meaningful for these menus (view-only gating).

INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('AP Seafarer Info', 'Seafarer''s Information', '/appraisals/seafarer-info', 2),
  ('AP Start Info', 'Information at Start of Appraisal', '/appraisals/start-info', 3),
  ('AP Competence', 'Competence Assessment', '/appraisals/competence', 4),
  ('AP Behavioural', 'Behavioural Assessment', '/appraisals/behavioural', 5),
  ('AP Training Needs', 'Training Needs & Development', '/appraisals/training-needs', 6),
  ('AP Summary', 'Summary & Recommendations', '/appraisals/summary', 7),
  ('AP Office Review', 'Office Review & Followup', '/appraisals/office-review', 8)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Appraisals' AND parent_menu IS NULL LIMIT 1) p
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
WHERE m.name IN ('AP Seafarer Info', 'AP Start Info', 'AP Competence', 'AP Behavioural', 'AP Training Needs', 'AP Summary', 'AP Office Review')
  AND NOT EXISTS (
    SELECT 1 FROM adm_roleaccess_ac ra WHERE ra.role_id = r.ruid AND ra.menu_id = m.muid
  );
