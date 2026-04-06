-- Migration 0103: Add Crew Pool form section menus for per-section access control
-- Sections: A (Dashboard), C (Travel & ID Documents), D (Training & Certificates), E (Sea Service), F (Medical)
-- Section B (Seafarers' Particulars) is always visible (mandatory fields) and not gated.

INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), s.name, s.display_name, s.route, p.muid, true, s.sort_order
FROM (VALUES
  ('CP Dashboard', 'Dashboard', '/crew-pool/dashboard', 2),
  ('CP Travel ID Documents', 'Travel & ID Documents', '/crew-pool/travel-id-documents', 3),
  ('CP Training Certificates', 'Training & Certificates', '/crew-pool/training-certificates', 4),
  ('CP Sea Service', 'Sea Service', '/crew-pool/sea-service', 5),
  ('CP Medical', 'Medical', '/crew-pool/medical', 6)
) AS s(name, display_name, route, sort_order)
CROSS JOIN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Crew Pool' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;

-- Grant all permissions to all existing roles for the new menus
INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete)
SELECT
  gen_random_uuid(),
  r.ruid,
  m.muid,
  true,
  true,
  true,
  true
FROM adm_rolemaster_ac r
CROSS JOIN adm_menumaster_ac m
WHERE m.name IN ('CP Dashboard', 'CP Travel ID Documents', 'CP Training Certificates', 'CP Sea Service', 'CP Medical')
  AND NOT EXISTS (
    SELECT 1 FROM adm_roleaccess_ac ra WHERE ra.role_id = r.ruid AND ra.menu_id = m.muid
  );
