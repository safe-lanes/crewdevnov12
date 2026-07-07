-- Task #544: Persist Part E "Add Training from Database" course link.
-- Mirrors the pattern from migration 0124 (which added `source` to
-- appr_training_needs_v2 for the same Part E lock/dedupe behaviour) and the
-- existing `corresponding_in_db` column on the sibling table
-- appr_training_followups_v2 (Part G).
--
-- Without this column the client-side `correspondingInDB` value (the database
-- course id selected in the popup) is dropped on every save, so after a
-- save+reload the "Add Training from Database" popup can no longer grey out
-- already-added trainings and allows accidental duplicates.
--
-- Additive and idempotent. Existing rows default to NULL (no DB link), which
-- matches their current behaviour.

ALTER TABLE appr_training_needs_v2
  ADD COLUMN IF NOT EXISTS corresponding_in_db TEXT;
