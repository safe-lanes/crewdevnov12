CREATE OR REPLACE FUNCTION frm_requirement_binding_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r frm_requirements; s frm_company_submissions;
BEGIN
 SELECT * INTO r FROM frm_requirements WHERE requirement_uuid=NEW.requirement_uuid;
 IF r.current_submission_uuid IS NULL THEN
  IF EXISTS(SELECT 1 FROM frm_company_submissions WHERE requirement_uuid=r.requirement_uuid
    AND status<>'voided' AND NOT is_deleted) THEN
   RAISE EXCEPTION 'A live required form must remain bound to its requirement' USING ERRCODE='23514';
  END IF;
 ELSE
  SELECT * INTO s FROM frm_company_submissions WHERE submission_uuid=r.current_submission_uuid;
  IF s.requirement_uuid IS DISTINCT FROM r.requirement_uuid OR s.status='voided' OR s.is_deleted
    OR (r.status='COMPLETED' AND s.status<>'completed')
    OR (r.status='STARTED' AND s.status<>'in_progress') THEN
   RAISE EXCEPTION 'Requirement cannot be satisfied by a missing, mismatched or voided form' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
