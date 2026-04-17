-- Migration 0111: Cleanup legacy `users` table on affected tenants.
--
-- Background: a few tenants (e.g. `crew_man***`) had a pre-existing
-- `users` table from a prior system. When migration 0000 first ran on
-- those DBs the migration runner soft-skipped its `CREATE TABLE`
-- because the table already existed, so the table never got the
-- Drizzle-shape columns. Migration 0108 (after the defensive
-- `username` / `password` patch) then succeeded but left the table in
-- a corrupt hybrid state: legacy columns like `usertype` coexisted
-- with their Drizzle counterparts (`user_type`, etc.), and the `id`
-- sequence is not a normal SERIAL.
--
-- This migration only acts when it detects the legacy fingerprint
-- (presence of column `usertype` — never present in any Drizzle
-- schema). When detected, it drops the hybrid `users` table and
-- recreates it cleanly to match `shared/schema.ts`, then re-attaches
-- the FK constraints from the four tables that reference users(id).
-- On healthy Drizzle-managed tenants this is a complete no-op.

DO $$
DECLARE
  has_legacy boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'usertype'
  ) INTO has_legacy;

  IF NOT has_legacy THEN
    RETURN;
  END IF;

  RAISE NOTICE '[0111] Legacy users table detected — dropping and recreating.';

  -- 1. Drop the hybrid table (also drops dependent FK constraints on
  --    refresh_tokens / password_reset_tokens / login_audit_log /
  --    user_vessel_assignments; the dependent tables themselves stay).
  DROP TABLE users CASCADE;

  -- 2. Recreate `users` with the canonical Drizzle shape.
  CREATE TABLE users (
    id                       SERIAL PRIMARY KEY,
    username                 TEXT    NOT NULL,
    password                 TEXT    NOT NULL,
    uuid                     TEXT    UNIQUE,
    email                    TEXT,
    full_name                TEXT,
    first_name               TEXT,
    last_name                TEXT,
    designation              TEXT,
    department               TEXT,
    preferred_auth_method    TEXT             DEFAULT 'NA',
    user_type                TEXT    NOT NULL DEFAULT 'Office',
    role_id                  TEXT,
    domain                   TEXT,
    tenant_id                TEXT,
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked                BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts    INTEGER NOT NULL DEFAULT 0,
    lockout_until            TIMESTAMP,
    last_login_at            TIMESTAMP,
    last_login_ip            TEXT,
    password_changed_at      TIMESTAMP,
    created_at               TIMESTAMP        DEFAULT now(),
    updated_at               TIMESTAMP        DEFAULT now()
  );

  -- 3. Recreate the indexes originally added by migration 0108.
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_domain_idx
    ON users (LOWER(username), COALESCE(domain, ''));
  CREATE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email));
  CREATE INDEX IF NOT EXISTS users_uuid_idx  ON users (uuid);

  -- 4. Re-attach FK constraints from dependent tables. Each guarded
  --    by an existence check on the dependent table itself (it may
  --    legitimately not exist on very old tenants) and on the
  --    constraint (so this is safe to re-run).

  -- refresh_tokens.user_id -> users(id) ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'refresh_tokens'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema   = 'public'
      AND table_name     = 'refresh_tokens'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'refresh_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE refresh_tokens
      ADD CONSTRAINT refresh_tokens_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- password_reset_tokens.user_id -> users(id) ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema   = 'public'
      AND table_name     = 'password_reset_tokens'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'password_reset_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- login_audit_log.user_id -> users(id) ON DELETE SET NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'login_audit_log'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema   = 'public'
      AND table_name     = 'login_audit_log'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'login_audit_log_user_id_fkey'
  ) THEN
    ALTER TABLE login_audit_log
      ADD CONSTRAINT login_audit_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- user_vessel_assignments.user_id -> users(id) ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_vessel_assignments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema   = 'public'
      AND table_name     = 'user_vessel_assignments'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'user_vessel_assignments_user_id_fkey'
  ) THEN
    ALTER TABLE user_vessel_assignments
      ADD CONSTRAINT user_vessel_assignments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

END $$;
