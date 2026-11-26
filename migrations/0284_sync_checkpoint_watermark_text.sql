-- SYN-07: keep a table's checkpoint as the exact text of a row's updated_at.
--
-- last_synced_at is a timestamptz. Reading it into JavaScript gives a Date, which
-- keeps only milliseconds. Postgres keeps microseconds, so a checkpoint rounded
-- down is EARLIER than the row it just delivered, and `updated_at > checkpoint`
-- returns that row again on every cycle, for ever (Technical hit exactly this).
-- It also turns a timestamp-without-zone value into an instant using whatever zone
-- the session has.
--
-- last_watermark holds `updated_at::text` of the last delivered row, untouched.
-- The gather query compares against it in the column's own type. last_synced_at
-- stays for rows already written by Phase 1 code and is no longer used to gather.
--
-- Safe to re-run.

ALTER TABLE sync_table_checkpoints ADD COLUMN IF NOT EXISTS last_watermark text;
