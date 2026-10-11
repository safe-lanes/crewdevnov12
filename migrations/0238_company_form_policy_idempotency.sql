-- The watcher can apply 0237 before an explicit rerun. Permit duplicate
-- INSERT ... ON CONFLICT DO NOTHING without permitting an UPDATE of a release.
CREATE OR REPLACE FUNCTION frm_guard_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM adm_form_versions_v2 WHERE fv_uuid = OLD.version_uuid) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Every Company Form version must retain exactly one applicability policy' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM frm_version_applicability WHERE version_uuid = NEW.version_uuid
  ) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.version_uuid IS DISTINCT FROM OLD.version_uuid THEN
    RAISE EXCEPTION 'Applicability version ownership is immutable' USING ERRCODE = '23514';
  END IF;
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
