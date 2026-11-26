-- SYN-08: row aliases for rows that two sides created under different uuids.
--
-- A both-edit table with a natural key (rh_vessel_records_v2: vessel + month) can
-- meet itself: the ship and the office each hold a row for the same vessel and
-- month under different uuids (a legacy random uuid on one side). Replacing one
-- would drop the other side's fields, so the receiver MERGES: it keeps its own row,
-- takes the sender's value for the fields the sender owns, and records here that
-- the sender's uuid means its own row. Later logs for the sender's uuid are applied
-- to the kept row instead of colliding again on every sync.
--
-- alias_uuid     the uuid the OTHER side uses for the row
-- canonical_uuid the uuid of the row kept here
--
-- Each side keeps only the aliases it needs: the office records ship-uuid ->
-- office-uuid when it merges, and the ship records office-uuid -> ship-uuid when
-- the office tells it (the push response carries the pair).
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS sync_row_aliases (
  table_name     text NOT NULL,
  alias_uuid     text NOT NULL,
  canonical_uuid text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, alias_uuid),
  CHECK (alias_uuid <> canonical_uuid)
);

CREATE INDEX IF NOT EXISTS idx_sync_row_aliases_canonical
  ON sync_row_aliases (table_name, canonical_uuid);
