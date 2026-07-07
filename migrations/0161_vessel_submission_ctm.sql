-- Migration 0161: Vessel submission package & CTM cash account (Prompt 06).
--
-- 1. acc_monthly_transactions_v2:
--    - review_comment: office comment on reject/return, shown to the vessel.
--    - ctm_line_uuid: link when a vessel on-board cash advance auto-creates
--      a CTM line (single entry, two records).
-- 2. acc_ctm_v2:
--    - submitted_by_uuid / submitted_date: vessel submission audit.
--    - portage_uuid: link to the vessel-month portage bill.
--
-- Idempotent: uses IF NOT EXISTS throughout.

ALTER TABLE acc_monthly_transactions_v2
  ADD COLUMN IF NOT EXISTS review_comment TEXT;

ALTER TABLE acc_monthly_transactions_v2
  ADD COLUMN IF NOT EXISTS ctm_line_uuid TEXT;

ALTER TABLE acc_ctm_v2
  ADD COLUMN IF NOT EXISTS submitted_by_uuid TEXT;

ALTER TABLE acc_ctm_v2
  ADD COLUMN IF NOT EXISTS submitted_date DATE;

ALTER TABLE acc_ctm_v2
  ADD COLUMN IF NOT EXISTS portage_uuid TEXT;
