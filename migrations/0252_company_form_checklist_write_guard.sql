-- Every Yes writer must go through the server gate in the same transaction.
-- The server locks the subject before Planning; this backstop does not invert locks.
CREATE OR REPLACE FUNCTION frm_checklist_verified_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deployment_checklist_completed IS TRUE AND
    coalesce(current_setting('sail.checklist_verified_plan',true),'') <> NEW.plan_uuid
 THEN
   RAISE EXCEPTION 'The linked Company Forms checklist check must complete before setting Yes'
    USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_frm_checklist_verified_write ON vessel_planning_v2;
CREATE TRIGGER trg_frm_checklist_verified_write
 BEFORE INSERT OR UPDATE OF deployment_checklist_completed ON vessel_planning_v2
 FOR EACH ROW EXECUTE FUNCTION frm_checklist_verified_write();
