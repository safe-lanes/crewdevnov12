-- Crewing Test Case Manager — de-register the RBAC menu (follow-up to 0133).
-- The Test Case Manager is no longer a navigable module: it is removed from the
-- Access Control menu list and the top navigation. The /test-cases route stays
-- reachable via direct URL only (no permission gate).
-- Fully idempotent: safe to re-run and safe per-tenant.

-- Remove role-access grants tied to the Test Cases menu first (FK on menu_id).
DELETE FROM adm_roleaccess_ac
WHERE menu_id IN (SELECT muid FROM adm_menumaster_ac WHERE name = 'Test Cases');

-- Remove the menu registration itself.
DELETE FROM adm_menumaster_ac WHERE name = 'Test Cases';
