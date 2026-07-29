-- Migration 0183: add seniority_anchor_confirmed flag to acc_engagements_v2
-- Auto-created engagements have this false (unconfirmed); a user saving the
-- seniority anchor via the contract detail form sets it to true.

ALTER TABLE acc_engagements_v2
  ADD COLUMN IF NOT EXISTS seniority_anchor_confirmed boolean NOT NULL DEFAULT false;
