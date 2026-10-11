-- Follow-up to the immutable ledger migration: a later check can settle missing
-- facts while preserving the original requirement and version pin.
CREATE OR REPLACE FUNCTION frm_requirement_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text; history_run text;
BEGIN
 actor:=COALESCE(NULLIF(current_setting('sail.forms_actor',true),''),
   (SELECT actor_uuid FROM frm_resolution_runs WHERE run_uuid=NEW.run_uuid));
 history_run:=COALESCE(NULLIF(current_setting('sail.forms_run_uuid',true),''),NEW.run_uuid);
 INSERT INTO frm_requirement_history(history_uuid,requirement_uuid,actor_uuid,event,before_value,after_value,reason,run_uuid)
 VALUES(gen_random_uuid()::text,NEW.requirement_uuid,actor,
   CASE WHEN TG_OP='INSERT' THEN 'RESOLVED' ELSE NEW.status END,
   CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),
   NULLIF(current_setting('sail.forms_reason',true),''),history_run);
 RETURN NEW;
END $$;
