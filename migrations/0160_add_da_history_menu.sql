-- Seed the Admin Access Control menu item "History" under Drugs & Alcohol,
-- positioned after "Summary" and before "DA Lock / Unlock".

-- 1) Make room: push DA Lock / Unlock one slot down (only if it sits right after Summary)
UPDATE adm_menumaster_ac AS lock
SET sort_order = lock.sort_order + 1
FROM adm_menumaster_ac AS summary
WHERE lock.name = 'DA Lock / Unlock'
  AND summary.name = 'Summary'
  AND lock.parent_menu = summary.parent_menu
  AND lock.sort_order = summary.sort_order + 1
  AND lock.is_deleted = false
  AND summary.is_deleted = false;

-- 2) Insert History at Summary.sort_order + 1
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order, is_deleted, is_sync)
SELECT
  'd4e5f6a7-b8c9-0123-defa-234567890123',
  'History',
  'History',
  '/drugs-alcohol/history',
  parent.muid,
  true,
  summary.sort_order + 1,
  false,
  false
FROM adm_menumaster_ac summary
JOIN adm_menumaster_ac parent ON parent.muid = summary.parent_menu
WHERE summary.name = 'Summary'
  AND lower(parent.name) LIKE '%drug%'
  AND summary.is_deleted = false
LIMIT 1
ON CONFLICT (name) DO NOTHING;
