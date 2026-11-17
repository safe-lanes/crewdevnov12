-- Additive Part H. Preflight passed before promotion from .local/pending-migrations/.
-- No historical data changes. Never cascade-delete confidential records/history.
-- Rollback must refuse if any Part H records exist; never discard recorded content.
DO $$
DECLARE resource text; entries text; events text;
BEGIN
  FOREACH resource IN ARRAY ARRAY['comments','actions'] LOOP
    entries := 'crew_internal_' || resource;
    events := entries || '_events';
    EXECUTE format('CREATE TABLE %I (
      entry_uuid text PRIMARY KEY,
      crew_uuid text NOT NULL REFERENCES crew_members_v2(crew_uuid) ON DELETE RESTRICT,
      body text NOT NULL CHECK (btrim(body) <> ''''),
      author jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
      edited boolean NOT NULL DEFAULT false,
      assignee jsonb,
      due_date date,
      status text NOT NULL DEFAULT ''Open'' CHECK (status IN (''Open'',''Completed'')),
      completed_by jsonb,
      completed_at timestamptz,
      closing_note text,
      removed_by jsonb,
      removed_at timestamptz,
      removal_reason text,
      UNIQUE(entry_uuid,crew_uuid),
      CHECK ((removed_at IS NULL AND removed_by IS NULL AND removal_reason IS NULL)
        OR (removed_at IS NOT NULL AND removed_by IS NOT NULL AND removal_reason IS NOT NULL AND btrim(removal_reason) <> '''')),
      CHECK ((status=''Open'' AND completed_at IS NULL AND completed_by IS NULL)
        OR (status=''Completed'' AND completed_at IS NOT NULL AND completed_by IS NOT NULL))
    )', entries);
    IF resource='actions' THEN
      EXECUTE format('ALTER TABLE %I ADD CHECK (assignee IS NOT NULL AND due_date IS NOT NULL)',entries);
    END IF;
    EXECUTE format('CREATE INDEX ON %I (crew_uuid,created_at)',entries);
    EXECUTE format('CREATE TABLE %I (
      event_uuid text PRIMARY KEY,
      entry_uuid text NOT NULL,
      crew_uuid text NOT NULL,
      revision integer NOT NULL,
      event text NOT NULL CHECK(event IN (''created'',''edited'',''reassigned'',''completed'',''reopened'',''removed'')),
      actor jsonb NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      snapshot jsonb NOT NULL,
      FOREIGN KEY(entry_uuid,crew_uuid) REFERENCES %I(entry_uuid,crew_uuid) ON DELETE RESTRICT,
      UNIQUE(entry_uuid,revision)
    )',events,entries);
  END LOOP;
END $$;

CREATE FUNCTION guard_crew_internal_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Internal records must be retained'; END IF;
  IF OLD.removed_at IS NOT NULL THEN RAISE EXCEPTION 'Removed records are immutable'; END IF;
  IF NEW.author IS DISTINCT FROM OLD.author OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.entry_uuid IS DISTINCT FROM OLD.entry_uuid OR NEW.crew_uuid IS DISTINCT FROM OLD.crew_uuid THEN
    RAISE EXCEPTION 'Recorded identity cannot change';
  END IF;
  IF NEW.revision <> OLD.revision+1 THEN RAISE EXCEPTION 'Revision must advance once'; END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION guard_crew_internal_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Internal history is append-only'; END $$;

CREATE TRIGGER crew_internal_comments_guard BEFORE UPDATE OR DELETE ON crew_internal_comments
  FOR EACH ROW EXECUTE FUNCTION guard_crew_internal_record();
CREATE TRIGGER crew_internal_actions_guard BEFORE UPDATE OR DELETE ON crew_internal_actions
  FOR EACH ROW EXECUTE FUNCTION guard_crew_internal_record();
CREATE TRIGGER crew_internal_comments_history_guard BEFORE UPDATE OR DELETE ON crew_internal_comments_events
  FOR EACH ROW EXECUTE FUNCTION guard_crew_internal_history();
CREATE TRIGGER crew_internal_actions_history_guard BEFORE UPDATE OR DELETE ON crew_internal_actions_events
  FOR EACH ROW EXECUTE FUNCTION guard_crew_internal_history();
