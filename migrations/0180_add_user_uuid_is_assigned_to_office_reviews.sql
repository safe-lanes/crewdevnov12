-- Add user_uuid and is_assigned columns to appr_office_reviews_v2
-- user_uuid: links a G1 row to the system user who performed the review (enables future email notifications)
-- is_assigned: true for rows seeded from Stage-2 assigned reviewers (persists lock state through save/reload)

ALTER TABLE appr_office_reviews_v2
  ADD COLUMN IF NOT EXISTS user_uuid TEXT,
  ADD COLUMN IF NOT EXISTS is_assigned BOOLEAN NOT NULL DEFAULT FALSE;
