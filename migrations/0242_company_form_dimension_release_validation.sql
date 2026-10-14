ALTER TABLE frm_applicability_conditions ADD COLUMN IF NOT EXISTS value_labels jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION frm_applicability_fingerprint(v text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(jsonb_build_object(
    'subject',(SELECT f.subject_type FROM adm_forms_v2 f JOIN adm_form_versions_v2 x ON x.form_id=f.id WHERE x.fv_uuid=v),
    'policy',(SELECT to_jsonb(p)-'effective_from' FROM frm_version_applicability p WHERE p.version_uuid=v),
    'sets',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.set_uuid,'conditions',
      (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.condition_uuid),'[]') FROM frm_applicability_conditions c WHERE c.set_uuid=s.set_uuid)
    ) ORDER BY s.set_uuid),'[]') FROM frm_applicability_sets s WHERE s.version_uuid=v)
  )::text)
$$;

CREATE TABLE IF NOT EXISTS frm_applicability_release_proof (
  version_uuid text PRIMARY KEY REFERENCES adm_form_versions_v2(fv_uuid) ON DELETE CASCADE,
  subject_type text NOT NULL,
  policy_digest text NOT NULL,
  validation_txid bigint NOT NULL,
  validated_at timestamp NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL
);
CREATE OR REPLACE FUNCTION frm_guard_release_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  v := CASE WHEN TG_OP='DELETE' THEN OLD.version_uuid ELSE NEW.version_uuid END;
  IF EXISTS(SELECT 1 FROM adm_form_versions_v2 WHERE fv_uuid=v AND status='released') THEN
    RAISE EXCEPTION 'Released validation evidence is immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND NEW.version_uuid<>OLD.version_uuid THEN
    RAISE EXCEPTION 'Validation evidence ownership is immutable' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_guard_release_proof ON frm_applicability_release_proof;
CREATE TRIGGER trg_guard_release_proof BEFORE INSERT OR UPDATE OR DELETE ON frm_applicability_release_proof
FOR EACH ROW EXECUTE FUNCTION frm_guard_release_proof();

CREATE OR REPLACE FUNCTION frm_release_applicability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p frm_version_applicability%ROWTYPE; release_day date; subject text;
BEGIN
  IF OLD.status='released' AND
     (NEW.status<>'released' OR NEW.released_at IS DISTINCT FROM OLD.released_at)
     AND EXISTS(SELECT 1 FROM frm_version_applicability WHERE version_uuid=OLD.fv_uuid) THEN
    RAISE EXCEPTION 'Released Company Form status and release time are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status='released' AND OLD.status<>'released' AND EXISTS(
    SELECT 1 FROM adm_forms_v2 WHERE id=NEW.form_id AND category='dynamic'
  ) THEN
    SELECT * INTO STRICT p FROM frm_version_applicability WHERE version_uuid=NEW.fv_uuid;
    SELECT subject_type INTO subject FROM adm_forms_v2 WHERE id=NEW.form_id;
    IF p.mode='conditional' AND NOT EXISTS(
      SELECT 1 FROM frm_applicability_release_proof proof
      WHERE proof.version_uuid=NEW.fv_uuid AND proof.subject_type=subject
        AND proof.validation_txid=txid_current()
        AND proof.policy_digest=frm_applicability_fingerprint(NEW.fv_uuid)
    ) THEN
      RAISE EXCEPTION 'Conditional release requires current same-transaction server dimension validation' USING ERRCODE='23514';
    END IF;
    NEW.released_at := clock_timestamp() AT TIME ZONE 'UTC';
    release_day := NEW.released_at::date;
    IF p.effective_kind='specific_date' AND p.specific_date<release_day THEN
      RAISE EXCEPTION 'Effective-from date % is earlier than release date %; rules cannot apply before release or resolve retrospectively',
        p.specific_date,release_day USING ERRCODE='23514';
    END IF;
    IF p.mode<>'manual_only' THEN
      UPDATE frm_version_applicability SET effective_from=
        CASE WHEN p.effective_kind='on_release' THEN release_day ELSE p.specific_date END
      WHERE version_uuid=NEW.fv_uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;
