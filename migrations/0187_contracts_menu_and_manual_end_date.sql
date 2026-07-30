-- Migration 0181: Contract (Engagement) Detail screen support.
--
--   1. acc_engagements_v2.end_date_manual — marker set when a user edits the
--      sign-off (end) date by hand. Sync from Crewing must NOT overwrite a
--      manually set end date; it reports the difference in its attention
--      list instead.
--   2. Register the new 'Account Contracts' menu (Contracts list + contract
--      detail screens) under the top-level 'Account' menu. Role grants are
--      seeded by copying each role's grant on the top-level 'Account' menu
--      (same pattern as 0155/0158/0160/0162/0164/0166), excluding Ship
--      roletypes: contracts are an office-only screen.
--
-- Idempotent and safe to re-run.

-- =========================================================================
-- 1. Manual sign-off marker.
-- =========================================================================
ALTER TABLE acc_engagements_v2
  ADD COLUMN IF NOT EXISTS end_date_manual boolean NOT NULL DEFAULT false;

-- =========================================================================
-- 2. Register the Contracts menu (sort order continues after 0166's 14).
-- =========================================================================
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), 'Account Contracts', 'Contracts', '/accounts/payroll/contracts', p.muid, true, 15
FROM (
  SELECT muid FROM adm_menumaster_ac WHERE name = 'Account' AND parent_menu IS NULL LIMIT 1
) p
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- 3. Seed office-role permissions by copying each role's grant pattern
--    from the top-level 'Account' menu. Ship roles get no row.
-- =========================================================================
INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete)
SELECT gen_random_uuid(), src.role_id, m.muid, src.canview, src.cancreate, src.canedit, src.candelete
FROM adm_roleaccess_ac src
JOIN adm_menumaster_ac am ON am.muid = src.menu_id AND am.name = 'Account' AND am.parent_menu IS NULL
JOIN adm_rolemaster_ac r ON r.ruid = src.role_id AND COALESCE(r.roletype, 'Office') <> 'Ship'
CROSS JOIN adm_menumaster_ac m
WHERE m.name = 'Account Contracts'
AND NOT EXISTS (
  SELECT 1 FROM adm_roleaccess_ac ra
  WHERE ra.role_id = src.role_id AND ra.menu_id = m.muid
);
