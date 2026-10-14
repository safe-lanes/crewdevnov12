-- Subject-owned contract context; no requirement/declaration is created.
CREATE TABLE IF NOT EXISTS crew_assignment_rule_context (
  assign_uuid text PRIMARY KEY REFERENCES crew_assignments(assign_uuid) ON DELETE RESTRICT,
  contract_rank_uuid text,
  contract_rank_label text,
  rank_source jsonb NOT NULL,
  rank_reason text,
  joining_history jsonb,
  captured_at timestamp NOT NULL DEFAULT now()
);

WITH evidence AS (
  SELECT a.assign_uuid,
    count(DISTINCT p.plan_uuid) AS links,
    count(DISTINCT r.ar_uuid) AS ranks,
    count(*) FILTER (WHERE p.plan_uuid IS NOT NULL AND r.ar_uuid IS NULL) AS unmapped,
    min(r.ar_uuid) AS rank_uuid, min(r.name) AS rank_label,
    jsonb_build_object('method','recorded_planning_link_upgrade',
      'planningUuids',coalesce(jsonb_agg(DISTINCT p.plan_uuid) FILTER (WHERE p.plan_uuid IS NOT NULL),'[]'),
      'rankReferences',coalesce(jsonb_agg(DISTINCT p.rank_id) FILTER (WHERE p.rank_id IS NOT NULL),'[]')) AS provenance
  FROM crew_assignments a
  LEFT JOIN vessel_planning_v2 p ON p.reliever_assign_uuid=a.assign_uuid OR p.crew_assign_uuid=a.assign_uuid
  LEFT JOIN adm_available_ranks_v2 r ON NOT r.is_deleted AND (r.ar_uuid=p.rank_id OR r.rank_id=p.rank_id)
  WHERE NOT a.is_deleted
  GROUP BY a.assign_uuid
)
INSERT INTO crew_assignment_rule_context(assign_uuid,contract_rank_uuid,contract_rank_label,rank_source,rank_reason)
SELECT assign_uuid,
  CASE WHEN links>0 AND ranks=1 AND unmapped=0 THEN rank_uuid END,
  CASE WHEN links>0 AND ranks=1 AND unmapped=0 THEN rank_label END,
  provenance,
  CASE WHEN links=0 THEN 'No recorded planning link'
    WHEN unmapped>0 THEN 'Recorded planning rank has no unique authoritative master mapping'
    WHEN ranks<>1 THEN 'Recorded planning links yield conflicting rank masters' END
FROM evidence ON CONFLICT(assign_uuid) DO NOTHING;

CREATE OR REPLACE FUNCTION crew_rule_context_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.contract_rank_uuid IS NOT NULL AND
    (NEW.contract_rank_uuid IS DISTINCT FROM OLD.contract_rank_uuid
      OR NEW.contract_rank_label IS DISTINCT FROM OLD.contract_rank_label
      OR NEW.rank_source IS DISTINCT FROM OLD.rank_source) THEN
    RAISE EXCEPTION 'Captured contract rank is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.joining_history IS NOT NULL AND NEW.joining_history IS DISTINCT FROM OLD.joining_history THEN
    RAISE EXCEPTION 'Captured joining history is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crew_rule_context_frozen ON crew_assignment_rule_context;
CREATE TRIGGER trg_crew_rule_context_frozen BEFORE UPDATE ON crew_assignment_rule_context
FOR EACH ROW EXECUTE FUNCTION crew_rule_context_frozen();
