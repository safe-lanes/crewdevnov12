-- Add lock/unlock support to D&A test records
ALTER TABLE da_test_records_v2 ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE da_test_records_v2 ADD COLUMN IF NOT EXISTS locked_once boolean NOT NULL DEFAULT false;

-- Seed the Admin Access Control menu item "DA Lock / Unlock"
-- Parent (Drugs & Alcohol section) is looked up dynamically via the existing "Summary" child,
-- so this works on every tenant without hardcoding the parent muid.
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order, is_deleted, is_sync)
SELECT
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'DA Lock / Unlock',
  'DA Lock / Unlock',
  '/drugs-alcohol/lock-unlock',
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
