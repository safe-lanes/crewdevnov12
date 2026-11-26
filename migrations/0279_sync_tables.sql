-- SYN-01: tables for ship-office sync change capture.
-- sync_field_log: one row per changed field, written by the change sink in the
-- same transaction as the business write.
-- sync_table_config: which tables are logged and how (editable at run time).
-- sync_settings: key/value settings such as this instance's id.
--
-- Some databases already have these three tables (created outside this repo's
-- migrations, with the same shape as below). Everything here is
-- IF NOT EXISTS / ON CONFLICT DO NOTHING, so existing rows and tables are kept.
-- No CHECK constraints or enums on synced text columns (the CHECKs below are
-- on the bookkeeping columns only).

CREATE TABLE IF NOT EXISTS sync_field_log (
  id                 bigserial PRIMARY KEY,
  log_uuid           text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  instance_id        text NOT NULL,
  table_name         text NOT NULL,
  row_uuid           text NOT NULL,
  field_name         text NOT NULL,
  op                 char(1) NOT NULL CHECK (op IN ('I', 'U', 'D')),
  old_value          text,
  new_value          text,
  vessel_id          text,
  changed_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by_user_id text,
  txid               bigint NOT NULL DEFAULT txid_current(),
  is_synced          boolean NOT NULL DEFAULT false,
  sync_batch_id      text,
  sync_attempts      integer NOT NULL DEFAULT 0,
  last_attempt_at    timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sfl_pending
  ON sync_field_log (id) WHERE is_synced = false;
CREATE INDEX IF NOT EXISTS idx_sfl_row
  ON sync_field_log (table_name, row_uuid, field_name, id DESC);
CREATE INDEX IF NOT EXISTS idx_sfl_vessel_synced
  ON sync_field_log (vessel_id, is_synced);

CREATE TABLE IF NOT EXISTS sync_table_config (
  table_name      text PRIMARY KEY,
  category        text NOT NULL CHECK (category IN
                    ('BOTH_EDITABLE', 'ONE_WAY_SHORE_TO_SHIP', 'SHIP_ONLY', 'NO_SYNC')),
  identity_column text NOT NULL,
  -- own: the row carries its vessel in vessel_column. parent / crew: scoped by
  -- a join at gather time. none: global.
  scope_mode      text NOT NULL DEFAULT 'none' CHECK (scope_mode IN ('own', 'parent', 'crew', 'none')),
  vessel_column   text,
  skip_columns    text[] NOT NULL DEFAULT ARRAY['id', 'created_at', 'updated_at', 'is_sync', 'file_data'],
  notes           text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (scope_mode <> 'own' OR vessel_column IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS sync_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed: only the Rest Hours and Vessel sub-module tables are registered here
-- (other modules are added when their classification is signed off).
-- Directions follow the owner's answers of 26 Nov 2026:
--   ONE_WAY_SHORE_TO_SHIP: only the office writes it.
--   SHIP_ONLY: only the ship writes it; it goes ship to office.
--   BOTH_EDITABLE: both sides write it; on the same field the office wins.
-- Rest Hours rows are scoped by their own vessel_id (it holds the vessel uuid).
INSERT INTO sync_table_config (table_name, category, identity_column, scope_mode, vessel_column, notes) VALUES
  ('rh_vessel_records_v2',            'BOTH_EDITABLE',         'rh_vessel_uuid',      'own', 'vessel_id', 'Ship owns totals and vessel review; office owns office review status, date and lock.'),
  ('rh_crew_records_v2',              'SHIP_ONLY',             'rh_crew_record_uuid', 'own', 'vessel_id', 'Rest hours are entered on the ship; the office cannot edit them.'),
  ('rh_daily_records_v2',             'SHIP_ONLY',             'rh_daily_uuid',       'own', 'vessel_id', 'Rest hours are entered on the ship; the office cannot edit them.'),
  ('rh_vessel_violation_comments_v2', 'SHIP_ONLY',             'vessel_comment_uuid', 'own', 'vessel_id', 'Separate comment, owned by the ship.'),
  ('rh_office_violation_comments_v2', 'ONE_WAY_SHORE_TO_SHIP', 'office_comment_uuid', 'own', 'vessel_id', 'Separate comment, owned by the office.'),
  ('rh_nc_reports_v2',                'BOTH_EDITABLE',         'nc_report_uuid',      'own', 'vessel_id', 'Ship writes and submits; office reviews, may edit root cause / immediate / preventive action fields, and closes (locked). Office wins per field.'),
  ('rh_fixed_tasks_v2',               'SHIP_ONLY',             'fixed_task_uuid',     'own', 'vessel_id', NULL),
  ('rh_variable_tasks_v2',            'SHIP_ONLY',             'variable_task_uuid',  'own', 'vessel_id', NULL),
  ('rh_dateline_adjustments_v2',      'SHIP_ONLY',             'adjustment_uuid',     'own', 'vessel_id', NULL),
  ('vessel_planning_v2',              'ONE_WAY_SHORE_TO_SHIP', 'plan_uuid',           'own', 'vessel_uuid', 'Office owns all planning fields; the ship is read-only.')
ON CONFLICT (table_name) DO UPDATE SET
  category = EXCLUDED.category, identity_column = EXCLUDED.identity_column,
  scope_mode = EXCLUDED.scope_mode, vessel_column = EXCLUDED.vessel_column,
  notes = EXCLUDED.notes, updated_at = now();

INSERT INTO sync_table_config (table_name, category, identity_column, scope_mode, notes) VALUES
  ('vessel_planning_attachments_v2',  'ONE_WAY_SHORE_TO_SHIP', 'att_uuid',           'parent', 'Only the office adds plan attachments.')
ON CONFLICT (table_name) DO UPDATE SET
  category = EXCLUDED.category, identity_column = EXCLUDED.identity_column,
  scope_mode = EXCLUDED.scope_mode, notes = EXCLUDED.notes, updated_at = now();

-- rh_vessel_records_v2: the counters are recomputed on each side (see
-- server/v2/rest-hours/utils/derivedTables.ts), so only the real data fields
-- are logged: review status, dates and lock.
UPDATE sync_table_config SET skip_columns = ARRAY['id','created_at','updated_at','is_sync','file_data','total_crew','recording_status_percent','activity_conflicting','crew_with_activity_conflicts','crew_with_activity_conflicts_details','total_violations','crew_with_violations','crew_with_violations_details','crew_with_ncs_details','crew_with_predicted_violations_details','crew_with_predicted_ncs_details','total_ncs','crew_with_ncs','predicted_violations','crew_with_predicted_violations','predicted_ncs','crew_with_predicted_ncs'], updated_at = now()
WHERE table_name = 'rh_vessel_records_v2';
