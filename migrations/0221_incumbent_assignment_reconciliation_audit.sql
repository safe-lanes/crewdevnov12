-- Keep an append-only record of the administrator's explicit legacy link
-- decision. No assignment is selected by this migration.
CREATE TABLE IF NOT EXISTS vessel_planning_assignment_reconciliations (
  id BIGSERIAL PRIMARY KEY,
  plan_uuid TEXT NOT NULL,
  assign_uuid TEXT NOT NULL,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT NOT NULL,
  reviewed_by TEXT NOT NULL,
  evidence_note TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vessel_planning_assignment_reconciliations_plan
  ON vessel_planning_assignment_reconciliations(plan_uuid);