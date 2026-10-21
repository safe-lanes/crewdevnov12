-- A single durable slot per assignment and required master identity.
CREATE TABLE IF NOT EXISTS training_compliance_suggestions (
  suggestion_uuid text PRIMARY KEY,
  assign_uuid text NOT NULL REFERENCES crew_assignments(assign_uuid),
  plan_uuid text NOT NULL REFERENCES vessel_planning_v2(plan_uuid),
  crew_uuid text NOT NULL REFERENCES crew_members_v2(crew_uuid),
  -- Parent vessel UUIDs have no unique constraint; scope is verified through
  -- the exact assignment and planning links before insertion.
  vessel_uuid text NOT NULL,
  course_uuid text NOT NULL REFERENCES adm_training_master_v2(tm_uuid),
  source text NOT NULL DEFAULT 'Pre-joining compliance' CHECK (source='Pre-joining compliance'),
  status text NOT NULL CHECK (status IN ('SUGGESTED','CONFIRMED','DISMISSED','CLOSED','WITHDRAWN')),
  gap jsonb NOT NULL,
  target_date date,
  confirmed_at timestamptz,
  confirmed_by text,
  closed_certificate_uuid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assign_uuid,course_uuid)
);
CREATE TABLE IF NOT EXISTS training_compliance_suggestion_history (
  id bigserial PRIMARY KEY,
  suggestion_uuid text NOT NULL REFERENCES training_compliance_suggestions(suggestion_uuid),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  event text NOT NULL,
  before_value jsonb,
  after_value jsonb NOT NULL,
  reason text NOT NULL,
  certificate_uuid text
);
CREATE OR REPLACE FUNCTION protect_training_suggestion_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Training suggestion history is append-only' USING ERRCODE='23514';
END;
$$;
DROP TRIGGER IF EXISTS training_suggestion_history_immutable ON training_compliance_suggestion_history;
CREATE TRIGGER training_suggestion_history_immutable
BEFORE UPDATE OR DELETE ON training_compliance_suggestion_history
FOR EACH ROW EXECUTE FUNCTION protect_training_suggestion_history();
CREATE INDEX IF NOT EXISTS training_suggestion_crew ON training_compliance_suggestions(crew_uuid,status);
