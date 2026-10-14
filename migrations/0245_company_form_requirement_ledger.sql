CREATE TABLE IF NOT EXISTS frm_resolution_runs (
 run_uuid text PRIMARY KEY, subject_type text NOT NULL, subject_ref text NOT NULL,
 stage_key text, cycle_uuid text NOT NULL, event_key text NOT NULL,
 trigger_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 outcome text NOT NULL CHECK(outcome IN('COMPLETED','FAILED')),
 actor_uuid text NOT NULL, source text NOT NULL, evidence jsonb NOT NULL,
 failure_reason text,
 CHECK((outcome='FAILED' AND nullif(btrim(failure_reason),'') IS NOT NULL) OR outcome='COMPLETED')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_frm_run_event ON frm_resolution_runs
 (subject_type,subject_ref,coalesce(stage_key,''),cycle_uuid,event_key);
CREATE TABLE IF NOT EXISTS frm_requirements (
 requirement_uuid text PRIMARY KEY,
 run_uuid text NOT NULL REFERENCES frm_resolution_runs(run_uuid) ON DELETE RESTRICT,
 subject_type text NOT NULL,subject_ref text NOT NULL,stage_key text,cycle_uuid text NOT NULL,
 form_uuid text NOT NULL REFERENCES adm_forms_v2(form_uuid) ON DELETE RESTRICT,
 form_version_uuid text NOT NULL REFERENCES adm_form_versions_v2(fv_uuid) ON DELETE RESTRICT,
 mandatory boolean NOT NULL,
 status text NOT NULL CHECK(status IN('OUTSTANDING','STARTED','COMPLETED','UNRESOLVED','WITHDRAWN')),
 deciding_evidence jsonb NOT NULL, unresolved_reason text,
 current_submission_uuid text REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status IN('STARTED','COMPLETED') AND current_submission_uuid IS NOT NULL)
    OR (status IN('OUTSTANDING','UNRESOLVED','WITHDRAWN') AND current_submission_uuid IS NULL)),
 CHECK(status<>'UNRESOLVED' OR nullif(btrim(unresolved_reason),'') IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_frm_requirement_cycle ON frm_requirements
 (subject_type,subject_ref,coalesce(stage_key,''),cycle_uuid,form_uuid);
CREATE TABLE IF NOT EXISTS frm_requirement_history (
 history_uuid text PRIMARY KEY, requirement_uuid text NOT NULL REFERENCES frm_requirements(requirement_uuid) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now(), actor_uuid text NOT NULL,
 event text NOT NULL, before_value jsonb, after_value jsonb NOT NULL,
 reason text, run_uuid text REFERENCES frm_resolution_runs(run_uuid) ON DELETE RESTRICT
);
ALTER TABLE frm_company_submissions ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'MANUAL';
ALTER TABLE frm_company_submissions ADD COLUMN IF NOT EXISTS requirement_uuid text REFERENCES frm_requirements(requirement_uuid) ON DELETE RESTRICT;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ck_frm_submission_origin') THEN
 ALTER TABLE frm_company_submissions ADD CONSTRAINT ck_frm_submission_origin
 CHECK((origin='MANUAL' AND requirement_uuid IS NULL) OR(origin='REQUIRED' AND requirement_uuid IS NOT NULL));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION frm_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Resolution evidence and history are append-only' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS trg_frm_run_immutable ON frm_resolution_runs;
CREATE TRIGGER trg_frm_run_immutable BEFORE UPDATE OR DELETE ON frm_resolution_runs FOR EACH ROW EXECUTE FUNCTION frm_ledger_immutable();
DROP TRIGGER IF EXISTS trg_frm_history_immutable ON frm_requirement_history;
CREATE TRIGGER trg_frm_history_immutable BEFORE UPDATE OR DELETE ON frm_requirement_history FOR EACH ROW EXECUTE FUNCTION frm_ledger_immutable();
CREATE OR REPLACE FUNCTION frm_requirement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r frm_resolution_runs; v adm_form_versions_v2; f adm_forms_v2;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Requirement history must be retained' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','current_submission_uuid','updated_at','unresolved_reason'])
   IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','current_submission_uuid','updated_at','unresolved_reason'])
 THEN RAISE EXCEPTION 'Requirement pin and deciding evidence are immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO r FROM frm_resolution_runs WHERE run_uuid=NEW.run_uuid;
 SELECT * INTO v FROM adm_form_versions_v2 WHERE fv_uuid=NEW.form_version_uuid;
 SELECT * INTO f FROM adm_forms_v2 WHERE form_uuid=NEW.form_uuid;
 IF r.outcome<>'COMPLETED' OR r.subject_type<>NEW.subject_type OR r.subject_ref<>NEW.subject_ref
 OR r.stage_key IS DISTINCT FROM NEW.stage_key OR r.cycle_uuid<>NEW.cycle_uuid
 OR v.form_id<>f.id OR v.stage_key IS DISTINCT FROM NEW.stage_key OR f.subject_type IS DISTINCT FROM NEW.subject_type
 OR v.status<>'released' THEN
 RAISE EXCEPTION 'Requirement run, subject, stage and released version must agree' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_frm_requirement_guard ON frm_requirements;
CREATE TRIGGER trg_frm_requirement_guard BEFORE INSERT OR UPDATE OR DELETE ON frm_requirements
FOR EACH ROW EXECUTE FUNCTION frm_requirement_guard();
CREATE OR REPLACE FUNCTION frm_requirement_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text;
BEGIN
 actor:=coalesce(nullif(current_setting('sail.forms_actor',true),''),(SELECT actor_uuid FROM frm_resolution_runs WHERE run_uuid=NEW.run_uuid));
 INSERT INTO frm_requirement_history(history_uuid,requirement_uuid,actor_uuid,event,before_value,after_value,reason,run_uuid)
 VALUES(gen_random_uuid()::text,NEW.requirement_uuid,actor,
 CASE WHEN TG_OP='INSERT' THEN 'RESOLVED' ELSE NEW.status END,
 CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),
 nullif(current_setting('sail.forms_reason',true),''),NEW.run_uuid);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_frm_requirement_audit ON frm_requirements;
CREATE TRIGGER trg_frm_requirement_audit AFTER INSERT OR UPDATE ON frm_requirements
FOR EACH ROW EXECUTE FUNCTION frm_requirement_audit();
CREATE OR REPLACE FUNCTION frm_submission_requirement_sync() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r frm_requirements;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.origin IS DISTINCT FROM OLD.origin OR NEW.requirement_uuid IS DISTINCT FROM OLD.requirement_uuid)
 THEN RAISE EXCEPTION 'Form origin and requirement link are immutable' USING ERRCODE='23514'; END IF;
 IF NEW.requirement_uuid IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO r FROM frm_requirements WHERE requirement_uuid=NEW.requirement_uuid FOR UPDATE;
 IF r.requirement_uuid IS NULL OR r.subject_type<>NEW.subject_type OR r.subject_ref<>NEW.subject_ref
 OR r.form_uuid<>NEW.form_uuid OR r.form_version_uuid<>NEW.form_version_uuid
 OR r.stage_key IS DISTINCT FROM NEW.stage_key OR NEW.is_deleted
 THEN RAISE EXCEPTION 'Required form must use the exact requirement pin' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' AND (r.status<>'OUTSTANDING' OR r.current_submission_uuid IS NOT NULL) THEN
 RAISE EXCEPTION 'Requirement is not outstanding' USING ERRCODE='23514'; END IF;
 PERFORM set_config('sail.forms_actor',coalesce(NEW.updated_by_uuid,NEW.created_by_uuid,
   (SELECT actor_uuid FROM frm_resolution_runs WHERE run_uuid=r.run_uuid)),true);
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  PERFORM set_config('sail.forms_reason',coalesce(NEW.void_reason,''),true);
  UPDATE frm_requirements SET status=CASE NEW.status WHEN 'voided' THEN 'OUTSTANDING'
    WHEN 'completed' THEN 'COMPLETED' ELSE 'STARTED' END,
   current_submission_uuid=CASE WHEN NEW.status='voided' THEN NULL ELSE NEW.submission_uuid END,
   updated_at=now() WHERE requirement_uuid=NEW.requirement_uuid;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_frm_submission_requirement ON frm_company_submissions;
CREATE TRIGGER trg_frm_submission_requirement AFTER INSERT OR UPDATE ON frm_company_submissions
FOR EACH ROW EXECUTE FUNCTION frm_submission_requirement_sync();
CREATE OR REPLACE FUNCTION frm_requirement_binding_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r frm_requirements; s frm_company_submissions;
BEGIN
 SELECT * INTO r FROM frm_requirements WHERE requirement_uuid=NEW.requirement_uuid;
 IF r.current_submission_uuid IS NOT NULL THEN
 SELECT * INTO s FROM frm_company_submissions WHERE submission_uuid=r.current_submission_uuid;
 IF s.requirement_uuid IS DISTINCT FROM r.requirement_uuid OR s.status='voided' OR s.is_deleted
 OR (r.status='COMPLETED' AND s.status<>'completed')
 OR (r.status='STARTED' AND s.status<>'in_progress')
 THEN RAISE EXCEPTION 'Requirement cannot be satisfied by a missing, mismatched or voided form' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_frm_requirement_binding ON frm_requirements;
CREATE CONSTRAINT TRIGGER trg_frm_requirement_binding AFTER INSERT OR UPDATE ON frm_requirements
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION frm_requirement_binding_check();
