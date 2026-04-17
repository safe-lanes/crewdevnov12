-- Migration 0109: Admin user management (Task #223)
-- Adds firstName/lastName/department/preferredAuthMethod columns to users,
-- backfills from fullName, normalizes legacy userType values, and adds the
-- user_vessel_assignments join table.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_auth_method TEXT DEFAULT 'NA';

-- Backfill first_name / last_name from full_name when both are NULL.
UPDATE users
   SET first_name = TRIM(SPLIT_PART(full_name, ' ', 1)),
       last_name  = NULLIF(TRIM(SUBSTR(full_name, POSITION(' ' IN full_name) + 1)), '')
 WHERE first_name IS NULL
   AND last_name IS NULL
   AND full_name IS NOT NULL
   AND full_name <> '';

-- Normalize legacy userType values to the Office/Ship convention used by the
-- rest of the codebase (VesselModule_v2, RestHours, DrugsAlcohol, etc.).
UPDATE users SET user_type = 'Office' WHERE user_type IN ('user', 'admin');

-- Default for new rows shifts from 'user' to 'Office' to match the new
-- listing/form. Existing rows already updated above.
ALTER TABLE users ALTER COLUMN user_type SET DEFAULT 'Office';

CREATE TABLE IF NOT EXISTS user_vessel_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vessel_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS user_vessel_assignments_user_vessel_uq
  ON user_vessel_assignments(user_id, vessel_id);
CREATE INDEX IF NOT EXISTS user_vessel_assignments_user_idx
  ON user_vessel_assignments(user_id);
