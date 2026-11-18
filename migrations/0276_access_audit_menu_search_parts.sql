-- Menu labels remain live-first. Materialize only the portions of a menu
-- grant sentence that are independent of that live lookup.
ALTER TABLE adm_access_control_audit_search
  ALTER COLUMN sentence_folded DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS menu_id text,
  ADD COLUMN IF NOT EXISTS menu_left text,
  ADD COLUMN IF NOT EXISTS menu_right text,
  ADD COLUMN IF NOT EXISTS menu_fallback text;

CREATE OR REPLACE FUNCTION adm_audit_menu_parts(a adm_access_control_audit)
RETURNS text LANGUAGE sql STABLE PARALLEL SAFE RETURN
  CASE WHEN a.event='grant_change' AND left(a.resource,5)='menu:'
    AND nullif(adm_audit_trim(a.actor_display_name),'') IS NOT NULL
    AND nullif(adm_audit_trim(a.permission_display_label),'') IS NOT NULL
    AND nullif(adm_audit_trim(a.affected_role_name),'') IS NOT NULL
    AND strpos(concat(a.actor_display_name,a.permission_display_label,a.affected_role_name),chr(31))=0
  THEN adm_audit_fold(adm_audit_sentence(a.event,a.actor,a.role_id,a.resource,
    a.before_value,a.after_value,a.details,a.recorded_at,adm_audit_trim(a.actor_display_name),
    adm_audit_safe_label(a.affected_role_name),adm_audit_trim(a.permission_display_label),chr(31))) END;

CREATE OR REPLACE FUNCTION adm_audit_index_capture() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE parts text;
BEGIN
  IF adm_audit_has_frozen_sentence(NEW) THEN
    INSERT INTO adm_access_control_audit_search (audit_id, sentence_folded)
      VALUES (NEW.id, adm_audit_frozen_sentence(NEW));
  ELSE
    parts := adm_audit_menu_parts(NEW);
    IF parts IS NOT NULL THEN
      INSERT INTO adm_access_control_audit_search (audit_id, menu_id, menu_left, menu_right, menu_fallback)
      VALUES (NEW.id, substring(NEW.resource from 6), split_part(parts,chr(31),1), split_part(parts,chr(31),2),
        CASE WHEN jsonb_typeof(NEW.details->'menuName')='string'
          THEN adm_audit_fold(adm_audit_safe_label(NEW.details->>'menuName')) END);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

LOCK TABLE adm_access_control_audit IN SHARE ROW EXCLUSIVE MODE;
WITH candidates AS MATERIALIZED (
  SELECT a.id, substring(a.resource from 6) AS menu_id, adm_audit_menu_parts(a) AS parts,
    CASE WHEN jsonb_typeof(a.details->'menuName')='string'
      THEN adm_audit_fold(adm_audit_safe_label(a.details->>'menuName')) END AS fallback
  FROM adm_access_control_audit a WHERE a.event='grant_change' AND left(a.resource,5)='menu:'
)
INSERT INTO adm_access_control_audit_search (audit_id,menu_id,menu_left,menu_right,menu_fallback)
SELECT id,menu_id,split_part(parts,chr(31),1),split_part(parts,chr(31),2),fallback
FROM candidates WHERE parts IS NOT NULL
ON CONFLICT (audit_id) DO NOTHING;
