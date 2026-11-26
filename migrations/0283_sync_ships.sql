-- SYN-06: the ships the office accepts sync from.
--
-- The guide checks one shared API key. That cannot keep ship A out of ship B's
-- data: the vessel in a request is chosen by the caller. So the office keeps one
-- row per ship, binding its instance id to exactly one vessel and its own API
-- key. Every protocol call is scoped to that vessel; the request cannot choose
-- another one.
--
-- The key is stored as a SHA-256 hash; the clear key is shown once, when the ship
-- is registered or its key is rotated. api_key_hash is never returned by the API.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS sync_ships (
  instance_id   text PRIMARY KEY,
  vessel_uuid   text NOT NULL,
  api_key_hash  text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (upper(instance_id) LIKE 'SHIP-%')
);

-- One ship per vessel at a time (an inactive row keeps its vessel until removed).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_ships_vessel ON sync_ships (vessel_uuid);
