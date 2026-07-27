-- Migration 0181: Add email_sent_at to appr_office_reviews_v2
-- Tracks whether a manually-added G1 reviewer has already been notified,
-- so repeated Save Draft calls only send the email once per reviewer.
ALTER TABLE appr_office_reviews_v2
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;
