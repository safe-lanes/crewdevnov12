-- Permit incomplete Company Form drafts without weakening released records.
-- ROLLBACK LIMITATION: once unfinished drafts exist, rollback MUST REFUSE until
-- those drafts are completed or removed through an authorised workflow.
-- Rollback never fills, edits or deletes drafts. See rollback/0266_*.sql.
-- No data updates/backfills. No NOT NULL, type, FK or unique changes.

ALTER TABLE frm_sections DROP CONSTRAINT chk_frm_sections_responsible_target;
ALTER TABLE frm_sections ADD CONSTRAINT chk_frm_sections_responsible_target CHECK (
  (responsible_mode='role' AND responsible_department IS NULL)
  OR (responsible_mode='department' AND responsible_role_uuid IS NULL
      AND (responsible_department IS NULL OR btrim(responsible_department)<>''))
  OR (responsible_mode IN ('not_applicable','seafarer')
      AND responsible_role_uuid IS NULL AND responsible_department IS NULL)
);
ALTER TABLE frm_questions DROP CONSTRAINT chk_frm_questions_system_field_key;
ALTER TABLE frm_questions ADD CONSTRAINT chk_frm_questions_system_field_key CHECK (
  (response_type='system_field' AND (system_field_key IS NULL OR btrim(system_field_key)<>''))
  OR (response_type<>'system_field' AND system_field_key IS NULL)
);
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='frm_version_applicability'::regclass
    AND contype='c' AND pg_get_constraintdef(oid) LIKE '%obligation%'
    AND pg_get_constraintdef(oid) LIKE '%effective_kind%' LOOP
    EXECUTE format('ALTER TABLE frm_version_applicability DROP CONSTRAINT %I',c.conname);
  END LOOP;
END $$;
ALTER TABLE frm_version_applicability ADD CONSTRAINT chk_frm_applicability_draft_shape CHECK (
  (mode='manual_only' AND obligation IS NULL AND effective_kind IS NULL
    AND specific_date IS NULL AND effective_from IS NULL)
  OR (mode<>'manual_only' AND effective_kind IS NOT NULL
    AND ((effective_kind='specific_date') OR (effective_kind='on_release' AND specific_date IS NULL)))
);

-- Cross-table status checks belong in locking triggers, not CHECK functions
-- whose result could become stale when the parent version changes.
CREATE FUNCTION frm_is_writable_company_draft(v text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE f integer; category text; archived timestamp; state text;
BEGIN
  SELECT form_id INTO f FROM adm_form_versions_v2 WHERE fv_uuid=v;
  SELECT a.category,a.archived_at INTO category,archived FROM adm_forms_v2 a WHERE id=f FOR UPDATE;
  SELECT status INTO state FROM adm_form_versions_v2 WHERE fv_uuid=v FOR UPDATE;
  IF category IS DISTINCT FROM 'dynamic' THEN RETURN false; END IF;
  RETURN state='draft' AND archived IS NULL;
END $$;

CREATE FUNCTION frm_guard_draft_completeness() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v text; old_v text; draft boolean;
BEGIN
  IF TG_TABLE_NAME='frm_sections' THEN
    IF TG_OP<>'INSERT' THEN PERFORM frm_is_writable_company_draft(OLD.form_version_uuid); END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    v := NEW.form_version_uuid;
    draft := frm_is_writable_company_draft(v);
    IF NOT draft AND ((NEW.responsible_mode='role' AND NEW.responsible_role_uuid IS NULL)
      OR (NEW.responsible_mode='department' AND nullif(btrim(NEW.responsible_department),'') IS NULL)) THEN
      RAISE EXCEPTION 'Invalid form structure' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='frm_questions' THEN
    IF TG_OP<>'INSERT' THEN
      SELECT form_version_uuid INTO old_v FROM frm_sections WHERE section_uuid=OLD.section_uuid;
      PERFORM frm_is_writable_company_draft(old_v);
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    SELECT form_version_uuid INTO v FROM frm_sections WHERE section_uuid=NEW.section_uuid;
    draft := frm_is_writable_company_draft(v);
    IF NOT draft AND NEW.response_type='system_field' AND NEW.system_field_key IS NULL THEN
      RAISE EXCEPTION 'System field key is required' USING ERRCODE='23514';
    END IF;
  ELSE
    -- Existing policy guards still enforce ownership, archive and immutability.
    draft := frm_is_writable_company_draft(NEW.version_uuid);
    IF NOT draft AND NEW.mode<>'manual_only' AND (NEW.obligation IS NULL
      OR (NEW.effective_kind='specific_date' AND NEW.specific_date IS NULL)) THEN
      RAISE EXCEPTION 'Automatic modes require mandatory or optional' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_draft_section_completeness BEFORE INSERT OR UPDATE OR DELETE ON frm_sections
  FOR EACH ROW EXECUTE FUNCTION frm_guard_draft_completeness();
CREATE TRIGGER trg_draft_question_completeness BEFORE INSERT OR UPDATE OR DELETE ON frm_questions
  FOR EACH ROW EXECUTE FUNCTION frm_guard_draft_completeness();
CREATE TRIGGER trg_draft_policy_completeness BEFORE INSERT OR UPDATE ON frm_version_applicability
  FOR EACH ROW EXECUTE FUNCTION frm_guard_draft_completeness();

CREATE FUNCTION frm_guard_release_completeness() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p frm_version_applicability%ROWTYPE;
BEGIN
  IF NEW.status<>'released' OR (TG_OP='UPDATE' AND OLD.status='released') OR NOT EXISTS(
    SELECT 1 FROM adm_forms_v2 WHERE id=NEW.form_id AND category='dynamic') THEN RETURN NEW; END IF;
  -- Same parent-first locking order as writes and the application release path.
  PERFORM id FROM adm_forms_v2 WHERE id=NEW.form_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    -- A new version cannot already own its policy/tree: create a draft first.
    RAISE EXCEPTION 'Only draft versions can be released.' USING ERRCODE='23514';
  END IF;
  SELECT * INTO p FROM frm_version_applicability WHERE version_uuid=NEW.fv_uuid;
  IF NOT FOUND OR (p.mode<>'manual_only' AND (p.obligation IS NULL OR p.effective_kind IS NULL
    OR (p.effective_kind='specific_date' AND p.specific_date IS NULL))) THEN
    RAISE EXCEPTION 'Automatic modes require mandatory or optional' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM frm_sections s WHERE s.form_version_uuid=NEW.fv_uuid AND
    ((s.responsible_mode='role' AND s.responsible_role_uuid IS NULL)
      OR (s.responsible_mode='department' AND nullif(btrim(s.responsible_department),'') IS NULL))) THEN
    RAISE EXCEPTION 'Invalid form structure' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM frm_questions q JOIN frm_sections s ON s.section_uuid=q.section_uuid
    WHERE s.form_version_uuid=NEW.fv_uuid AND q.response_type='system_field' AND q.system_field_key IS NULL) THEN
    RAISE EXCEPTION 'System field key is required' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
-- Alphabetical ordering runs completeness before the existing date/proof guard.
CREATE TRIGGER trg_company_release_completeness BEFORE INSERT OR UPDATE OF status ON adm_form_versions_v2
  FOR EACH ROW EXECUTE FUNCTION frm_guard_release_completeness();
