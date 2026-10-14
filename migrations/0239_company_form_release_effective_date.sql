CREATE OR REPLACE FUNCTION frm_release_applicability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p frm_version_applicability%ROWTYPE; release_day date;
BEGIN
  IF OLD.status = 'released' AND
     (NEW.status <> 'released' OR NEW.released_at IS DISTINCT FROM OLD.released_at) AND EXISTS (
    SELECT 1 FROM frm_version_applicability WHERE version_uuid = OLD.fv_uuid
  ) THEN
    RAISE EXCEPTION 'Released Company Form status and release time are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'released' AND OLD.status <> 'released' AND EXISTS (
    SELECT 1 FROM adm_forms_v2 WHERE id = NEW.form_id AND category = 'dynamic'
  ) THEN
    SELECT * INTO STRICT p FROM frm_version_applicability WHERE version_uuid = NEW.fv_uuid;
    IF p.mode = 'conditional' THEN
      RAISE EXCEPTION 'Conditional applicability cannot be released until server-side dimension validation is available' USING ERRCODE = '23514';
    END IF;
    NEW.released_at := clock_timestamp() AT TIME ZONE 'UTC';
    release_day := NEW.released_at::date;
    IF p.effective_kind = 'specific_date' AND p.specific_date < release_day THEN
      RAISE EXCEPTION 'Effective-from date % is earlier than release date %; a rule cannot claim applicability before it existed and requirements are never resolved retrospectively',
        p.specific_date, release_day USING ERRCODE = '23514';
    END IF;
    IF p.mode <> 'manual_only' THEN
      UPDATE frm_version_applicability SET effective_from =
        CASE WHEN p.effective_kind = 'on_release' THEN release_day ELSE p.specific_date END
      WHERE version_uuid = NEW.fv_uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_release_applicability ON adm_form_versions_v2;
CREATE TRIGGER trg_release_applicability BEFORE UPDATE OF status, released_at ON adm_form_versions_v2
FOR EACH ROW EXECUTE FUNCTION frm_release_applicability();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_applicability_condition_values') THEN
    ALTER TABLE frm_applicability_conditions ADD CONSTRAINT ck_applicability_condition_values CHECK (
      (operator='is' AND jsonb_typeof(value)='boolean') OR
      (operator<>'is' AND jsonb_typeof(value)='array' AND jsonb_array_length(value)>0
        AND NOT jsonb_path_exists(value, '$[*] ? (@.type() != "string" || @ == "")'))
    );
  END IF;
END $$;
