-- Task #517: Persist Part E "Add Training from Database" lock state.
-- Mirrors the pattern from migration 0123 (which added `source` to
-- appr_trainings_v2 for the same reason on a sibling table).
--
-- Without this column the client-side `addedFromDB` flag is dropped on every
-- save, so Part E rows added via "Add Training from Database" become editable
-- inputs after reload instead of staying as read-only text.
--
-- Additive and idempotent. Existing rows default to 'manual', matching their
-- current rendering as editable inputs.

ALTER TABLE appr_training_needs_v2
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
