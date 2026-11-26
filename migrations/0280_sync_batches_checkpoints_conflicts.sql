-- SYN-03: sync bookkeeping that 0279 did not create, plus two config additions.
--
-- sync_batches:            one row per sync cycle (ship) / per initiate call (shore).
-- sync_table_checkpoints:  how far this instance has got, per table. Forward only.
--                          last_synced_at: updated_at watermark for tables synced as
--                          whole rows (ONE_WAY_SHORE_TO_SHIP pull, SHIP_ONLY push).
--                          last_log_id: highest shore sync_field_log id pulled, for
--                          BOTH_EDITABLE tables.
-- sync_conflict_log:       a received change that was not applied (the receiver had a
--                          newer change of its own, or the row hit a unique key).
--
-- sync_table_config gets:
--   row_filter:   SQL predicate (on the table itself) a row must meet to be sent as a
--                 whole row. Set by migrations only; it is pasted into the gather query.
--   parent_*:     how a scope_mode='parent' table finds its vessel (join path).
--
-- Everything is IF NOT EXISTS / ON CONFLICT DO NOTHING, so it is safe to re-run.
-- No CHECK constraints or enums on synced text columns (the CHECKs are on bookkeeping
-- columns only).

CREATE TABLE IF NOT EXISTS sync_batches (
  batch_id        text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  instance_id     text NOT NULL,
  vessel_id       text,
  status          text NOT NULL DEFAULT 'started'
                    CHECK (status IN ('started', 'completed', 'partial', 'failed')),
  records_pushed  integer NOT NULL DEFAULT 0,
  records_pulled  integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  error_message   text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_batches_instance
  ON sync_batches (instance_id, started_at DESC);

CREATE TABLE IF NOT EXISTS sync_table_checkpoints (
  id             bigserial PRIMARY KEY,
  instance_id    text NOT NULL,
  table_name     text NOT NULL,
  last_synced_at timestamptz,
  last_log_id    bigint,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, table_name)
);

CREATE TABLE IF NOT EXISTS sync_conflict_log (
  id                    bigserial PRIMARY KEY,
  conflict_uuid         text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  receiver_instance_id  text NOT NULL,
  sender_instance_id    text,
  batch_id              text,
  table_name            text NOT NULL,
  row_uuid              text NOT NULL,
  field_name            text,
  local_value           text,
  incoming_value        text,
  local_changed_at      timestamptz,
  incoming_changed_at   timestamptz,
  -- local_kept: receiver's newer change won (stale-skip).
  -- unique_key: the row collided with a unique index under another uuid.
  resolution            text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scl_row
  ON sync_conflict_log (table_name, row_uuid, created_at DESC);

ALTER TABLE sync_table_config ADD COLUMN IF NOT EXISTS row_filter text;
ALTER TABLE sync_table_config ADD COLUMN IF NOT EXISTS parent_table text;
ALTER TABLE sync_table_config ADD COLUMN IF NOT EXISTS parent_fk_column text;
ALTER TABLE sync_table_config ADD COLUMN IF NOT EXISTS parent_identity_column text;

-- Settings the engine reads. instance_id is not seeded: it is set per install.
-- An empty shore_url / sync_api_key means "not configured"; the engine and the
-- machine auth must treat empty as unset, never as a valid key.
INSERT INTO sync_settings (key, value) VALUES
  ('shore_url', ''),
  ('sync_api_key', ''),
  ('auto_sync_enabled', 'false'),
  ('sync_interval_minutes', '360'),
  ('chunk_size', '200'),
  ('sync_request_timeout_ms', '60000')
ON CONFLICT (key) DO NOTHING;

-- Draft variable tasks do not sync (decision D5). A task becomes sendable when it
-- is published: that update changes updated_at, so the row enters the next gather.
UPDATE sync_table_config
   SET row_filter = 'is_draft = false', updated_at = now()
 WHERE table_name = 'rh_variable_tasks_v2';

-- Plan attachments are scoped through their plan.
UPDATE sync_table_config
   SET parent_table = 'vessel_planning_v2',
       parent_fk_column = 'plan_uuid',
       parent_identity_column = 'plan_uuid',
       updated_at = now()
 WHERE table_name = 'vessel_planning_attachments_v2';
