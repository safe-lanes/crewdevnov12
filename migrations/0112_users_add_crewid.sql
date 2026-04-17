-- Migration 0112: Add `crew_id` column to users (Task #235)
--
-- Adds an optional, per-tenant unique Crew ID so operators can sign in
-- with either their username OR their crew_id against the same domain.
-- The column is nullable; uniqueness is enforced only when set, scoped
-- per `domain` to mirror the existing `users_username_domain_idx`
-- behavior. Idempotent: safe to re-run, no-op on DBs that already have
-- the column and the index.

ALTER TABLE users ADD COLUMN IF NOT EXISTS crew_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_crewid_domain_idx
  ON users (LOWER(crew_id), COALESCE(domain, ''))
  WHERE crew_id IS NOT NULL;
