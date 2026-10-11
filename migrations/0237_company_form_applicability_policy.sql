-- Company-only foundation. No runtime resolution, requirement or declaration writes.
CREATE TABLE IF NOT EXISTS frm_version_applicability (
  version_uuid text PRIMARY KEY REFERENCES adm_form_versions_v2(fv_uuid) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'manual_only'
    CHECK (mode IN ('manual_only', 'all', 'conditional')),
  obligation text CHECK (obligation IN ('mandatory', 'optional')),
  effective_kind text CHECK (effective_kind IN ('on_release', 'specific_date')),
  specific_date date,
  effective_from date,
  copied_from_version_uuid text,
  CHECK (
    (mode = 'manual_only' AND obligation IS NULL AND effective_kind IS NULL
      AND specific_date IS NULL AND effective_from IS NULL)
    OR (mode <> 'manual_only' AND obligation IS NOT NULL AND effective_kind IS NOT NULL
      AND ((effective_kind = 'specific_date' AND specific_date IS NOT NULL)
        OR (effective_kind = 'on_release' AND specific_date IS NULL)))
  )
);

CREATE TABLE IF NOT EXISTS frm_applicability_sets (
  set_uuid text PRIMARY KEY,
  version_uuid text NOT NULL REFERENCES frm_version_applicability(version_uuid) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_applicability_sets_version ON frm_applicability_sets(version_uuid);
CREATE TABLE IF NOT EXISTS frm_applicability_conditions (
  condition_uuid text PRIMARY KEY,
  set_uuid text NOT NULL REFERENCES frm_applicability_sets(set_uuid) ON DELETE CASCADE,
  dimension_key text NOT NULL CHECK (length(trim(dimension_key)) > 0),
  operator text NOT NULL CHECK (operator IN ('in', 'not_in', 'contains_any', 'contains_all', 'is')),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) IN ('array', 'boolean'))
);
CREATE INDEX IF NOT EXISTS idx_applicability_conditions_set ON frm_applicability_conditions(set_uuid);

-- All versions, including deleted/archived history; reruns never reset edited policies.
INSERT INTO frm_version_applicability(version_uuid)
SELECT v.fv_uuid FROM adm_form_versions_v2 v
JOIN adm_forms_v2 f ON f.id = v.form_id WHERE f.category = 'dynamic'
ON CONFLICT (version_uuid) DO NOTHING;

CREATE OR REPLACE FUNCTION frm_initialize_applicability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM adm_forms_v2 WHERE id = NEW.form_id AND category = 'dynamic') THEN
    INSERT INTO frm_version_applicability(version_uuid) VALUES (NEW.fv_uuid);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_initialize_applicability ON adm_form_versions_v2;
CREATE TRIGGER trg_initialize_applicability AFTER INSERT ON adm_form_versions_v2
FOR EACH ROW EXECUTE FUNCTION frm_initialize_applicability();

-- All policy mutation paths acquire the same parent-form -> version locks.
CREATE OR REPLACE FUNCTION frm_lock_policy_draft(v_uuid text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE f_id integer; f_category text; v_status text; f_archived timestamp;
BEGIN
  SELECT form_id INTO f_id FROM adm_form_versions_v2 WHERE fv_uuid = v_uuid;
  SELECT category, archived_at INTO f_category, f_archived FROM adm_forms_v2 WHERE id = f_id FOR UPDATE;
  SELECT status INTO v_status FROM adm_form_versions_v2 WHERE fv_uuid = v_uuid FOR UPDATE;
  IF f_category IS DISTINCT FROM 'dynamic' THEN
    RAISE EXCEPTION 'Applicability belongs only to Company Form versions' USING ERRCODE = '23514';
  END IF;
  IF v_status IS DISTINCT FROM 'draft' OR f_archived IS NOT NULL THEN
    RAISE EXCEPTION 'Released or archived applicability policy is immutable' USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION frm_guard_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM adm_form_versions_v2 WHERE fv_uuid = OLD.version_uuid) THEN
      RETURN OLD; -- Only parent deletion can remove the one-to-one policy.
    END IF;
    RAISE EXCEPTION 'Every Company Form version must retain exactly one applicability policy' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.version_uuid IS DISTINCT FROM OLD.version_uuid THEN
    RAISE EXCEPTION 'Applicability version ownership is immutable' USING ERRCODE = '23514';
  END IF;
  -- Default policy construction is part of inserting a version, including legacy imports.
  IF NOT (TG_OP = 'INSERT' AND pg_trigger_depth() > 1 AND NEW.mode = 'manual_only'
    AND NEW.obligation IS NULL AND NEW.effective_kind IS NULL AND NEW.specific_date IS NULL
    AND NEW.effective_from IS NULL AND NEW.copied_from_version_uuid IS NULL) THEN
    PERFORM frm_lock_policy_draft(NEW.version_uuid);
  END IF;
  IF NEW.effective_from IS NOT NULL AND
     (TG_OP = 'INSERT' OR NEW.effective_from IS DISTINCT FROM OLD.effective_from)
     AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Resolved effective date is set only at release' USING ERRCODE = '23514';
  END IF;
  IF NEW.mode <> 'conditional' AND EXISTS (
    SELECT 1 FROM frm_applicability_sets WHERE version_uuid = NEW.version_uuid
  ) THEN
    RAISE EXCEPTION 'Only conditional policies may contain condition sets' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_policy ON frm_version_applicability;
CREATE TRIGGER trg_guard_policy BEFORE INSERT OR UPDATE OR DELETE ON frm_version_applicability
FOR EACH ROW EXECUTE FUNCTION frm_guard_policy();

CREATE OR REPLACE FUNCTION frm_guard_policy_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_uuid text; parent_ref text;
BEGIN
  IF TG_TABLE_NAME = 'frm_applicability_sets' THEN
    v_uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_uuid ELSE NEW.version_uuid END;
    IF TG_OP = 'UPDATE' AND NEW.version_uuid IS DISTINCT FROM OLD.version_uuid THEN
      RAISE EXCEPTION 'Condition set ownership is immutable' USING ERRCODE = '23514';
    END IF;
  ELSE
    parent_ref := CASE WHEN TG_OP = 'DELETE' THEN OLD.set_uuid ELSE NEW.set_uuid END;
    SELECT version_uuid INTO v_uuid FROM frm_applicability_sets WHERE set_uuid = parent_ref;
    IF TG_OP = 'UPDATE' AND NEW.set_uuid IS DISTINCT FROM OLD.set_uuid THEN
      RAISE EXCEPTION 'Condition ownership is immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP <> 'DELETE' AND (
      (NEW.operator = 'is' AND jsonb_typeof(NEW.value) <> 'boolean') OR
      (NEW.operator <> 'is' AND (jsonb_typeof(NEW.value) <> 'array' OR NEW.value = '[]'::jsonb))
    ) THEN
      RAISE EXCEPTION 'Condition operator and value shape do not agree' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM adm_form_versions_v2 WHERE fv_uuid = v_uuid
  ) THEN RETURN OLD; END IF;
  PERFORM frm_lock_policy_draft(v_uuid);
  IF TG_OP <> 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM frm_version_applicability WHERE version_uuid = v_uuid AND mode = 'conditional'
  ) THEN
    RAISE EXCEPTION 'Only conditional policies may contain conditions' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_policy_set ON frm_applicability_sets;
CREATE TRIGGER trg_guard_policy_set BEFORE INSERT OR UPDATE OR DELETE ON frm_applicability_sets
FOR EACH ROW EXECUTE FUNCTION frm_guard_policy_child();
DROP TRIGGER IF EXISTS trg_guard_policy_condition ON frm_applicability_conditions;
CREATE TRIGGER trg_guard_policy_condition BEFORE INSERT OR UPDATE OR DELETE ON frm_applicability_conditions
FOR EACH ROW EXECUTE FUNCTION frm_guard_policy_child();

-- Fail closed until subject dimension validation is delivered. No browser readiness flag.
CREATE OR REPLACE FUNCTION frm_release_applicability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p frm_version_applicability%ROWTYPE; release_day date;
BEGIN
  IF OLD.status = 'released' AND NEW.status <> 'released' AND EXISTS (
    SELECT 1 FROM frm_version_applicability WHERE version_uuid = OLD.fv_uuid
  ) THEN
    RAISE EXCEPTION 'Released Company Form status is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'released' AND OLD.status <> 'released' AND EXISTS (
    SELECT 1 FROM adm_forms_v2 WHERE id = NEW.form_id AND category = 'dynamic'
  ) THEN
    SELECT * INTO STRICT p FROM frm_version_applicability WHERE version_uuid = NEW.fv_uuid;
    IF p.mode = 'conditional' THEN
      RAISE EXCEPTION 'Conditional applicability cannot be released until server-side dimension validation is available' USING ERRCODE = '23514';
    END IF;
    NEW.released_at := transaction_timestamp() AT TIME ZONE 'UTC';
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
CREATE TRIGGER trg_release_applicability BEFORE UPDATE OF status ON adm_form_versions_v2
FOR EACH ROW EXECUTE FUNCTION frm_release_applicability();
