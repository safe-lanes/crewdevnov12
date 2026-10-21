-- Defense in depth: legacy inserts/direct Yes writers cannot skip either gate.
CREATE OR REPLACE FUNCTION frm_checklist_verified_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deployment_checklist_completed IS TRUE AND (
    coalesce(current_setting('sail.checklist_verified_plan',true),'') <> NEW.plan_uuid OR
    coalesce(current_setting('sail.training_verified_plan',true),'') <> NEW.plan_uuid)
 THEN
   RAISE EXCEPTION 'The linked forms and training checklist checks must complete before setting Yes'
    USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
