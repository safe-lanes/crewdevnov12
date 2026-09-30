CREATE TABLE IF NOT EXISTS vessel_planning_reliever_clear_audit (
  id BIGSERIAL PRIMARY KEY,
  plan_uuid TEXT NOT NULL,
  reliever_crew_uuid TEXT NOT NULL,
  cleared_by TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vessel_planning_reliever_clear_audit_plan
  ON vessel_planning_reliever_clear_audit(plan_uuid);