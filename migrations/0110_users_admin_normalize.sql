-- Migration 0110: Follow-up data normalization for Task #223.
-- Fixes two issues introduced by 0109:
--   1) Single-word full_name values were duplicated into both first_name and
--      last_name (because POSITION returned 0 → SUBSTR copied the whole name).
--      We restore last_name to NULL whenever first_name == last_name == full_name
--      and the original full_name had no whitespace.
--   2) Legacy user_type='Vessel' rows are normalized to 'Ship', matching the
--      Office/Ship convention used elsewhere in the codebase.

UPDATE users
   SET last_name = NULL
 WHERE first_name IS NOT NULL
   AND last_name IS NOT NULL
   AND first_name = last_name
   AND full_name IS NOT NULL
   AND POSITION(' ' IN full_name) = 0;

-- Also clear last_name if it was set to the original (single-token) full_name.
UPDATE users
   SET last_name = NULL
 WHERE last_name IS NOT NULL
   AND full_name IS NOT NULL
   AND last_name = full_name
   AND POSITION(' ' IN full_name) = 0;

UPDATE users SET user_type = 'Ship' WHERE user_type = 'Vessel';
