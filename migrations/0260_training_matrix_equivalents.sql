-- Additive: legacy matrices have no accepted equivalents. No history is rewritten.
CREATE UNIQUE INDEX IF NOT EXISTS tm_draft_uuid_vessel_identity
  ON adm_training_matrix_vessel_drafts_v2(tmvd_uuid,vessel_id);
CREATE UNIQUE INDEX IF NOT EXISTS tm_revision_uuid_vessel_identity
  ON adm_training_matrix_vessel_revisions_v2(tmvr_uuid,vessel_id);

CREATE TABLE IF NOT EXISTS adm_training_matrix_equivalents_v2 (
  link_uuid text PRIMARY KEY,
  -- Parent matrix composite keys enforce vessel ownership. The parent-supplied
  -- master_vessels.vessel_uuid is not a unique key in existing tenants.
  vessel_uuid text NOT NULL,
  draft_uuid text,
  revision_uuid text,
  required_course_uuid text NOT NULL REFERENCES adm_training_master_v2(tm_uuid),
  accepted_course_uuid text NOT NULL REFERENCES adm_training_master_v2(tm_uuid),
  required_course_label text NOT NULL,
  accepted_course_label text NOT NULL,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((draft_uuid IS NULL) <> (revision_uuid IS NULL)),
  CHECK (required_course_uuid <> accepted_course_uuid),
  FOREIGN KEY (draft_uuid,vessel_uuid)
    REFERENCES adm_training_matrix_vessel_drafts_v2(tmvd_uuid,vessel_id) ON DELETE CASCADE,
  FOREIGN KEY (revision_uuid,vessel_uuid)
    REFERENCES adm_training_matrix_vessel_revisions_v2(tmvr_uuid,vessel_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS tm_draft_equivalent_pair
  ON adm_training_matrix_equivalents_v2(draft_uuid,required_course_uuid,accepted_course_uuid)
  WHERE draft_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tm_revision_equivalent_pair
  ON adm_training_matrix_equivalents_v2(revision_uuid,required_course_uuid,accepted_course_uuid)
  WHERE revision_uuid IS NOT NULL;

CREATE TABLE IF NOT EXISTS adm_training_matrix_equivalent_events_v2 (
  event_uuid text PRIMARY KEY,
  vessel_uuid text NOT NULL,
  draft_uuid text,
  revision_uuid text,
  event text NOT NULL CHECK (event IN ('draft_saved','revision_frozen')),
  actor_id text NOT NULL,
  before_value jsonb NOT NULL,
  after_value jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION guard_training_matrix_equivalent_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='adm_training_matrix_equivalent_events_v2' THEN
    RAISE EXCEPTION 'Saved training matrix policy history cannot be changed' USING ERRCODE='23514';
  END IF;
  IF OLD.revision_uuid IS NOT NULL THEN
    RAISE EXCEPTION 'Saved training matrix policy history cannot be changed' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tm_equivalent_history_guard ON adm_training_matrix_equivalents_v2;
CREATE TRIGGER tm_equivalent_history_guard BEFORE UPDATE OR DELETE ON adm_training_matrix_equivalents_v2
  FOR EACH ROW EXECUTE FUNCTION guard_training_matrix_equivalent_history();
DROP TRIGGER IF EXISTS tm_equivalent_event_guard ON adm_training_matrix_equivalent_events_v2;
CREATE TRIGGER tm_equivalent_event_guard BEFORE UPDATE OR DELETE ON adm_training_matrix_equivalent_events_v2
  FOR EACH ROW EXECUTE FUNCTION guard_training_matrix_equivalent_history();
