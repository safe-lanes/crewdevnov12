-- Tenant-local, default deny. Never upgrade existing checklist authority.
INSERT INTO adm_permission_actions(resource,action,label,sort_order)
VALUES('training_compliance','override','Override training compliance',1)
ON CONFLICT(resource,action) DO NOTHING;

CREATE TABLE IF NOT EXISTS adm_training_compliance_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 block_expiring_during_contract boolean NOT NULL DEFAULT false
);
INSERT INTO adm_training_compliance_settings(singleton) VALUES(true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS training_checklist_snapshots (
 snapshot_uuid text PRIMARY KEY,
 plan_uuid text NOT NULL REFERENCES vessel_planning_v2(plan_uuid) ON DELETE RESTRICT,
 assignment_uuid text NOT NULL REFERENCES crew_assignments(assign_uuid) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor jsonb NOT NULL,
 evidence jsonb NOT NULL,
 evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS training_checklist_assignment ON training_checklist_snapshots(assignment_uuid,recorded_at DESC);
CREATE OR REPLACE FUNCTION training_checklist_evidence_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Accepted checklist evidence is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER training_checklist_snapshots_immutable BEFORE UPDATE OR DELETE
 ON training_checklist_snapshots FOR EACH ROW EXECUTE FUNCTION training_checklist_evidence_immutable();
CREATE INDEX IF NOT EXISTS training_compliance_audit ON adm_access_control_audit(id)
 WHERE resource='training_compliance';
