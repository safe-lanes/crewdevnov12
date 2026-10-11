CREATE TABLE IF NOT EXISTS frm_version_release_changes (
  version_uuid text PRIMARY KEY REFERENCES adm_form_versions_v2(fv_uuid) ON DELETE CASCADE,
  previous_version_uuid text,
  content_changed boolean NOT NULL,
  applicability_changed boolean NOT NULL,
  details jsonb NOT NULL,
  content_snapshot jsonb NOT NULL,
  policy_snapshot jsonb NOT NULL,
  released_by text,
  recorded_at timestamp NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC')
);
CREATE OR REPLACE FUNCTION frm_guard_release_changes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_uuid text;
BEGIN
  v_uuid := CASE WHEN TG_OP='DELETE' THEN OLD.version_uuid ELSE NEW.version_uuid END;
  IF TG_OP='DELETE' AND NOT EXISTS (SELECT 1 FROM adm_form_versions_v2 WHERE fv_uuid=v_uuid) THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' AND NEW.version_uuid IS DISTINCT FROM OLD.version_uuid THEN
    RAISE EXCEPTION 'Release comparison ownership is immutable' USING ERRCODE='23514';
  END IF;
  PERFORM frm_lock_policy_draft(v_uuid);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_release_changes ON frm_version_release_changes;
CREATE TRIGGER trg_guard_release_changes BEFORE INSERT OR UPDATE OR DELETE ON frm_version_release_changes
FOR EACH ROW EXECUTE FUNCTION frm_guard_release_changes();
