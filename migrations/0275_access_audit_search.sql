-- A derived index, not an audit fact. Do not update or delete audit history.
-- Rows with live presentation dependencies are deliberately not materialized.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE OR REPLACE FUNCTION adm_audit_trim(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN
  btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');

CREATE OR REPLACE FUNCTION adm_audit_safe_label(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN
  CASE WHEN value !~* '[0-9a-f]{8}-[0-9a-f-]{27,}|[{}]'
       THEN nullif(adm_audit_trim(value), '') END;

CREATE OR REPLACE FUNCTION adm_audit_fold(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN
  lower(value COLLATE pg_catalog."und-x-icu");

-- Keep this search renderer in parity with presentAccessAudit. The runtime
-- still uses the TypeScript presenter for visible sentences, Details and CSV.
CREATE OR REPLACE FUNCTION adm_audit_sentence(
  event text, actor jsonb, role_id text, resource text,
  before_value jsonb, after_value jsonb, details jsonb, recorded_at timestamptz,
  actor_label text, role_label text, permission_label text, menu_label text
) RETURNS text LANGUAGE sql STABLE PARALLEL SAFE RETURN
  to_char(recorded_at AT TIME ZONE 'UTC', 'DD Mon YYYY, HH24:MI')
    || ' UTC — '
    || coalesce(actor_label, adm_audit_safe_label(actor->>'roleName'),
         CASE WHEN left(actor->>'source', 19) = 'trusted_parent_sync'
              THEN 'The parent application' ELSE 'A user whose name was not recorded' END)
    || ' ' ||
  CASE event
    WHEN 'kpi_target_changed' THEN
      'changed the ' || CASE WHEN details ? 'year' THEN coalesce(details->>'year','null') ELSE 'undefined' END ||
      ' ' || coalesce(adm_audit_safe_label(details->>'kpiLabel'), 'a KPI') ||
      coalesce(' — ' || nullif(adm_audit_safe_label(details->>'componentLabel'), 'Overall'), '') ||
      ' target from ' ||
      CASE WHEN before_value IS NULL OR before_value = 'null' THEN 'not set'
           ELSE (before_value #>> '{}') || CASE WHEN details->>'unit' = 'percentage' THEN '%' ELSE '' END END ||
      ' to ' ||
      CASE WHEN after_value IS NULL OR after_value = 'null' THEN 'not set'
           ELSE (after_value #>> '{}') || CASE WHEN details->>'unit' = 'percentage' THEN '%' ELSE '' END END ||
      ' (' || CASE details->>'direction' WHEN 'minimum' THEN 'minimum'
              WHEN 'maximum' THEN 'maximum' ELSE 'direction not recorded' END || ')'
    WHEN 'training_setting_changed' THEN
      CASE WHEN after_value = 'true' THEN
        CASE WHEN before_value = 'true' THEN 'kept “' || permission_label || '” turned on'
             ELSE 'turned on “' || permission_label || '”' END
      WHEN after_value = 'false' THEN
        CASE WHEN before_value = 'false' THEN 'kept “' || permission_label || '” turned off'
             ELSE 'turned off “' || permission_label || '”' END
      ELSE 'updated “' || permission_label || '”' END
    WHEN 'grant_change' THEN (
      SELECT CASE
        WHEN after_value = 'true' AND before_value = 'true' THEN 'kept “' || permission || '” permission granted to ' || role_words
        WHEN after_value = 'true' THEN 'granted “' || permission || '” permission to ' || role_words
        WHEN after_value = 'false' AND (before_value IS NULL OR before_value IN ('false','null'))
          THEN 'left “' || permission || '” permission not granted to ' || role_words
        WHEN after_value = 'false' THEN 'removed “' || permission || '” permission from ' || role_words
        ELSE 'updated “' || permission || '” permission for ' || role_words END
      FROM (SELECT permission_label || CASE WHEN left(resource,5) = 'menu:'
                THEN ' — ' || coalesce(menu_label, 'an unavailable screen') ELSE '' END AS permission,
             coalesce('the ' || role_label || ' role', 'a role no longer available') AS role_words) p
    )
    WHEN 'training_override' THEN 'overrode a training-related deployment block for a deployment checklist'
    WHEN 'checklist_override' THEN 'overrode unresolved Company Form checks for a deployment checklist'
    WHEN 'role_eligibility_change' THEN 'changed the availability of ' || coalesce('the ' || role_label || ' role', 'a role no longer available')
    WHEN 'company_document_branding' THEN 'updated the company document logo'
    WHEN 'parent_sync_management_eligibility' THEN 'updated whether ' ||
      coalesce('the ' || role_label || ' role', 'a role no longer available') || ' is eligible to manage Access Control'
    WHEN 'parent_sync_category_readiness' THEN CASE WHEN after_value = 'true'
      THEN 'made the parent support category available' ELSE 'marked the parent support category unavailable' END
    WHEN 'parent_sync_rejected' THEN 'submitted a parent role update that was refused; existing access was preserved'
    ELSE 'updated access' || CASE WHEN coalesce(role_id, '') <> ''
      THEN ' for ' || coalesce('the ' || role_label || ' role', 'a role no longer available') ELSE '' END ||
      '; export the history for the recorded information'
  END || '.';

CREATE TABLE IF NOT EXISTS adm_access_control_audit_search (
  audit_id bigint PRIMARY KEY REFERENCES adm_access_control_audit(id),
  sentence_folded text NOT NULL
);
CREATE INDEX IF NOT EXISTS adm_audit_sentence_trgm ON adm_access_control_audit_search
  USING gin (sentence_folded public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS adm_audit_date ON adm_access_control_audit (recorded_at, id DESC);
CREATE INDEX IF NOT EXISTS adm_audit_action ON adm_access_control_audit (resource, action, id DESC);
CREATE INDEX IF NOT EXISTS adm_audit_event ON adm_access_control_audit (event text_pattern_ops, id DESC);

CREATE OR REPLACE FUNCTION adm_audit_has_frozen_sentence(a adm_access_control_audit)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE RETURN
  nullif(adm_audit_trim(a.actor_display_name), '') IS NOT NULL
  AND nullif(adm_audit_trim(a.permission_display_label), '') IS NOT NULL
  AND (nullif(a.role_id, '') IS NULL OR nullif(adm_audit_trim(a.affected_role_name), '') IS NOT NULL)
  AND left(a.resource,5) <> 'menu:';

CREATE OR REPLACE FUNCTION adm_audit_frozen_sentence(a adm_access_control_audit)
RETURNS text LANGUAGE sql STABLE PARALLEL SAFE RETURN
  adm_audit_fold(adm_audit_sentence(a.event, a.actor, a.role_id, a.resource,
    a.before_value, a.after_value, a.details, a.recorded_at,
    adm_audit_trim(a.actor_display_name), adm_audit_safe_label(a.affected_role_name),
    adm_audit_trim(a.permission_display_label), NULL));

CREATE OR REPLACE FUNCTION adm_audit_index_capture() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF adm_audit_has_frozen_sentence(NEW) THEN
    INSERT INTO adm_access_control_audit_search (audit_id, sentence_folded)
      VALUES (NEW.id, adm_audit_frozen_sentence(NEW));
  END IF;
  RETURN NEW;
END;
$$;

-- Block new inserts between backfill and trigger installation. The migration
-- runner holds this lock only for this transaction; the original rows and
-- append-only trigger are untouched.
LOCK TABLE adm_access_control_audit IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO adm_access_control_audit_search (audit_id, sentence_folded)
SELECT a.id, adm_audit_frozen_sentence(a) FROM adm_access_control_audit a
WHERE adm_audit_has_frozen_sentence(a)
ON CONFLICT (audit_id) DO NOTHING;
DROP TRIGGER IF EXISTS adm_audit_index_capture ON adm_access_control_audit;
CREATE TRIGGER adm_audit_index_capture AFTER INSERT ON adm_access_control_audit
FOR EACH ROW EXECUTE FUNCTION adm_audit_index_capture();
