-- Freeze new menu-grant labels. Existing audit rows and search rows are untouched.
-- Dropping the column after capture starts would destroy historical evidence.
ALTER TABLE adm_access_control_audit
  ADD COLUMN IF NOT EXISTS menu_display_label text;
COMMENT ON COLUMN adm_access_control_audit.menu_display_label IS
  'Menu display label frozen from the server menu master at grant capture; NULL for legacy entries.';

-- Derive it in the database, even if an older application process wrote the
-- event or the insert supplied its own label. Missing/unsafe labels freeze the
-- same plain placeholder used by the history screen, not a future lookup.
CREATE OR REPLACE FUNCTION adm_audit_capture_menu_label() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event='grant_change' AND left(NEW.resource,5)='menu:' THEN
    NEW.menu_display_label := coalesce(
      (SELECT adm_audit_safe_label(coalesce(nullif(m.display_name,''),m.name))
       FROM adm_menumaster_ac m WHERE m.muid=substring(NEW.resource from 6)),
      'an unavailable screen');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION adm_audit_has_frozen_sentence(a adm_access_control_audit)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE RETURN
  nullif(adm_audit_trim(a.actor_display_name), '') IS NOT NULL
  AND nullif(adm_audit_trim(a.permission_display_label), '') IS NOT NULL
  AND (nullif(a.role_id, '') IS NULL OR nullif(adm_audit_trim(a.affected_role_name), '') IS NOT NULL)
  AND (left(a.resource,5) <> 'menu:' OR adm_audit_safe_label(a.menu_display_label) IS NOT NULL);

CREATE OR REPLACE FUNCTION adm_audit_frozen_sentence(a adm_access_control_audit)
RETURNS text LANGUAGE sql STABLE PARALLEL SAFE RETURN
  adm_audit_fold(adm_audit_sentence(a.event, a.actor, a.role_id, a.resource,
    a.before_value, a.after_value, a.details, a.recorded_at,
    adm_audit_trim(a.actor_display_name), adm_audit_safe_label(a.affected_role_name),
    adm_audit_trim(a.permission_display_label), adm_audit_safe_label(a.menu_display_label)));

DROP TRIGGER IF EXISTS adm_audit_capture_menu_label ON adm_access_control_audit;
CREATE TRIGGER adm_audit_capture_menu_label BEFORE INSERT ON adm_access_control_audit
FOR EACH ROW EXECUTE FUNCTION adm_audit_capture_menu_label();
