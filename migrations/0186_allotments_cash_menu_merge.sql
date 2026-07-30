-- Migration 0180: Merge the Allotments and Cash & Bond menus into one
-- combined "Allotments & Cash" screen.
--
-- The Accounts sidebar restructure combines the Allotments page and the
-- Cash & Bond page (Advances + Bond tabs) into a single screen with three
-- tabs (Allotments / Advances / Bond) at /accounts/crew-finance/allotments-cash.
--
--   1. The 'Account Allotments' menu row is kept as the combined screen's
--      row: display name -> 'Allotments & Cash', route -> the combined path.
--   2. Role grants are merged: any role holding a grant on either old row
--      receives the equivalent grant on the combined row, taking the MORE
--      permissive of the two per permission flag (boolean OR).
--   3. The 'Account Cash & Bond' menu row is deactivated (is_active = false).
--      Its grant rows are left in place but the menu no longer surfaces.
--
-- Idempotent and safe to re-run.

-- 1. Repoint the kept row to the combined screen.
UPDATE adm_menumaster_ac
SET display_name = 'Allotments & Cash',
    route = '/accounts/crew-finance/allotments-cash'
WHERE name = 'Account Allotments';

-- 2a. Roles with a Cash & Bond grant but no Allotments grant: copy the row.
INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete)
SELECT gen_random_uuid(), cb.role_id, a.muid, cb.canview, cb.cancreate, cb.canedit, cb.candelete
FROM adm_roleaccess_ac cb
JOIN adm_menumaster_ac cbm ON cbm.muid = cb.menu_id AND cbm.name = 'Account Cash & Bond'
CROSS JOIN (
  SELECT muid FROM adm_menumaster_ac WHERE name = 'Account Allotments' LIMIT 1
) a
WHERE NOT EXISTS (
  SELECT 1 FROM adm_roleaccess_ac ra
  WHERE ra.role_id = cb.role_id AND ra.menu_id = a.muid
);

-- 2b. Roles with grants on both rows: take the more permissive per flag.
UPDATE adm_roleaccess_ac al
SET canview   = al.canview   OR cb.canview,
    cancreate = al.cancreate OR cb.cancreate,
    canedit   = al.canedit   OR cb.canedit,
    candelete = al.candelete OR cb.candelete,
    updated_at = now()
FROM adm_roleaccess_ac cb
JOIN adm_menumaster_ac cbm ON cbm.muid = cb.menu_id AND cbm.name = 'Account Cash & Bond'
JOIN adm_menumaster_ac am ON am.name = 'Account Allotments'
WHERE al.menu_id = am.muid
  AND al.role_id = cb.role_id
  AND (cb.canview OR cb.cancreate OR cb.canedit OR cb.candelete);

-- 3. Retire the Cash & Bond menu row.
UPDATE adm_menumaster_ac
SET is_active = false
WHERE name = 'Account Cash & Bond';
