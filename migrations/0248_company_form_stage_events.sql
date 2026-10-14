-- Tenant-local: each tenant database upgrades and activates independently.
CREATE TABLE IF NOT EXISTS frm_stage_rollout (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 capture_from timestamptz, completed_at timestamptz,
 enforcement_enabled boolean NOT NULL DEFAULT false,
 CHECK(NOT enforcement_enabled OR completed_at IS NOT NULL)
);
INSERT INTO frm_stage_rollout(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS frm_stage_cycles (
 subject_ref text NOT NULL, stage_key text NOT NULL, cycle_uuid text NOT NULL,
 deferred boolean NOT NULL DEFAULT false, PRIMARY KEY(subject_ref,stage_key)
);
CREATE TABLE IF NOT EXISTS frm_stage_events (
 event_uuid text PRIMARY KEY, subject_ref text NOT NULL, stage_key text NOT NULL,
 cycle_uuid text NOT NULL, source text NOT NULL, source_key text NOT NULL,
 occurred_at timestamptz NOT NULL, business_date date,
 actor_uuid text NOT NULL, snapshot jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(subject_ref,stage_key,cycle_uuid,source_key)
);
CREATE TABLE IF NOT EXISTS frm_stage_attempts (
 attempt_uuid text PRIMARY KEY, event_uuid text NOT NULL REFERENCES frm_stage_events(event_uuid),
 recorded_at timestamptz NOT NULL DEFAULT now(), actor_uuid text NOT NULL,
 outcome text NOT NULL CHECK(outcome IN('PENDING','COMPLETED','FAILED','DEFERRED')),
 reason text, run_uuid text REFERENCES frm_resolution_runs(run_uuid)
);
CREATE TABLE IF NOT EXISTS frm_stage_audit (
 audit_uuid text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 recorded_at timestamptz NOT NULL DEFAULT now(), actor_uuid text NOT NULL,
 subject_ref text, stage_key text, event text NOT NULL, evidence jsonb NOT NULL
);
CREATE TRIGGER trg_frm_stage_event_immutable BEFORE UPDATE OR DELETE ON frm_stage_events
 FOR EACH ROW EXECUTE FUNCTION frm_ledger_immutable();
CREATE TRIGGER trg_frm_stage_attempt_immutable BEFORE UPDATE OR DELETE ON frm_stage_attempts
 FOR EACH ROW EXECUTE FUNCTION frm_ledger_immutable();
CREATE TRIGGER trg_frm_stage_audit_immutable BEFORE UPDATE OR DELETE ON frm_stage_audit
 FOR EACH ROW EXECUTE FUNCTION frm_ledger_immutable();
ALTER TABLE frm_resolution_runs ADD COLUMN IF NOT EXISTS effective_date date;
