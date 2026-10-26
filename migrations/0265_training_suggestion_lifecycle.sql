-- Cover every assignment-cancellation and relief-deferral write path, not only
-- the new HTTP screen. Preserve both rows and append-only transition history.
CREATE OR REPLACE FUNCTION withdraw_training_suggestions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected record; old_value jsonb; why text;
BEGIN
  IF TG_TABLE_NAME='crew_assignments' THEN
    IF NOT (NEW.is_deleted OR NEW.assignment_type='Cancelled') THEN RETURN NEW; END IF;
    why := 'Assignment cancelled or removed';
  ELSE
    IF NOT (NEW.is_deleted OR NEW.is_archived OR NEW.relief_status='Deferred') THEN RETURN NEW; END IF;
    why := 'Relief deferred or planning withdrawn';
  END IF;
  FOR affected IN SELECT * FROM training_compliance_suggestions
    WHERE status IN ('SUGGESTED','CONFIRMED')
      AND ((TG_TABLE_NAME='crew_assignments' AND assign_uuid=(to_jsonb(NEW)->>'assign_uuid'))
        OR (TG_TABLE_NAME='vessel_planning_v2' AND plan_uuid=(to_jsonb(NEW)->>'plan_uuid')))
    ORDER BY suggestion_uuid FOR UPDATE
  LOOP
    old_value := to_jsonb(affected);
    UPDATE training_compliance_suggestions SET status='WITHDRAWN',updated_at=now()
      WHERE suggestion_uuid=affected.suggestion_uuid RETURNING * INTO affected;
    INSERT INTO training_compliance_suggestion_history
      (suggestion_uuid,actor,event,before_value,after_value,reason)
      VALUES(affected.suggestion_uuid,'system:pre-joining-compliance','withdrawn',
        old_value,to_jsonb(affected),why);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS training_suggestion_assignment_withdraw ON crew_assignments;
CREATE TRIGGER training_suggestion_assignment_withdraw AFTER UPDATE OF assignment_type,is_deleted ON crew_assignments
FOR EACH ROW EXECUTE FUNCTION withdraw_training_suggestions();
DROP TRIGGER IF EXISTS training_suggestion_plan_withdraw ON vessel_planning_v2;
CREATE TRIGGER training_suggestion_plan_withdraw AFTER UPDATE OF relief_status,is_deleted,is_archived ON vessel_planning_v2
FOR EACH ROW EXECUTE FUNCTION withdraw_training_suggestions();
