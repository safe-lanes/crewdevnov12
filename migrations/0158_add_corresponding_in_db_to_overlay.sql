-- Migration 0158: Add corresponding_in_db to training_needs_source_overlay_v2
-- Date: 2026-07-06
-- Description:
--   Extends the training-needs overlay table so the "Training (in DB)"
--   mapping can be persisted for Recruitment-sourced rows, whose source
--   table (screening_b7_training_items) has no such column. Appraisal and
--   Promotion already have a corresponding_in_db column on their own source
--   tables and do not need the overlay for this field. Idempotent.

ALTER TABLE training_needs_source_overlay_v2
  ADD COLUMN IF NOT EXISTS corresponding_in_db TEXT;
