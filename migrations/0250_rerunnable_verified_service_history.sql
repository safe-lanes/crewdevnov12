-- Backfilled facts may be recalculated; actual sign-on captures remain frozen.
-- Requirement/run evidence is deliberately not updated.
CREATE TABLE IF NOT EXISTS crew_rule_history_backfill_history (
 id bigserial PRIMARY KEY,
 assign_uuid text NOT NULL REFERENCES crew_assignments(assign_uuid) ON DELETE RESTRICT,
 actor_id text,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 source text NOT NULL,
 before_value jsonb,
 after_value jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_crew_backfill_history_assignment
 ON crew_rule_history_backfill_history(assign_uuid,id);

CREATE OR REPLACE FUNCTION crew_verified_history_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.joining_history_backfill IS DISTINCT FROM OLD.joining_history_backfill THEN
   IF OLD.joining_history IS NOT NULL OR
     coalesce(current_setting('sail.verified_backfill_write',true),'') <> 'verified_current_contract_backfill'
   THEN RAISE EXCEPTION 'Only verified backfill may recalculate uncaptured service facts' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION crew_verified_history_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_value jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN previous_value := OLD.joining_history_backfill; END IF;
 IF NEW.joining_history_backfill IS NOT NULL
   AND NEW.joining_history_backfill IS DISTINCT FROM previous_value THEN
   INSERT INTO crew_rule_history_backfill_history(assign_uuid,actor_id,source,before_value,after_value)
   VALUES(NEW.assign_uuid,nullif(current_setting('sail.verified_backfill_actor',true),''),
     coalesce(nullif(current_setting('sail.verified_backfill_phase',true),''),'recorded_backfill'),
     previous_value,NEW.joining_history_backfill);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crew_verified_history_audit ON crew_assignment_rule_context;
CREATE TRIGGER trg_crew_verified_history_audit AFTER INSERT OR UPDATE ON crew_assignment_rule_context
 FOR EACH ROW EXECUTE FUNCTION crew_verified_history_audit();
CREATE OR REPLACE FUNCTION crew_backfill_history_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Verified backfill history is append-only' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS trg_crew_backfill_history_append_only ON crew_rule_history_backfill_history;
CREATE TRIGGER trg_crew_backfill_history_append_only BEFORE UPDATE OR DELETE ON crew_rule_history_backfill_history
 FOR EACH ROW EXECUTE FUNCTION crew_backfill_history_append_only();
