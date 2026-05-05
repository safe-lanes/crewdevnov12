-- Migration 0111: Extend training source tables for unified Training Needs editing
-- Date: 2026-05-05
-- Description:
--   - Add `status` column to screening_b7_training_items so Recruitment-sourced
--     training needs can carry a follow-up status from the unified screen.
--   - Add `comments` column to promo_training_needs_v2 so Promotion-sourced
--     training needs can carry comments from the unified screen.
--   Both are nullable text columns and idempotent via IF NOT EXISTS.

ALTER TABLE screening_b7_training_items
  ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE promo_training_needs_v2
  ADD COLUMN IF NOT EXISTS comments TEXT;
