-- 0183: CTM carry-forward provenance
-- Adds opening_carried_from_period to acc_ctm_v2 so the service can record
-- which prior period's closing balance was used as the opening balance.
-- NULL means no prior record was found (opened at 0.00, editable).

ALTER TABLE acc_ctm_v2
  ADD COLUMN IF NOT EXISTS opening_carried_from_period text;
