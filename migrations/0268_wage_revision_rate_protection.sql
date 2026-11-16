CREATE TABLE IF NOT EXISTS acc_wage_revision_rate_protection_v2 (
  txn_uuid text PRIMARY KEY,
  revision_scale_uuid text NOT NULL,
  engagement_uuid text NOT NULL,
  vessel_uuid text,
  period text NOT NULL,
  pay_element_uuid text NOT NULL,
  currency text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  created_by_uuid text
);

CREATE INDEX IF NOT EXISTS idx_acc_wage_revision_rate_protection_revision
  ON acc_wage_revision_rate_protection_v2 (revision_scale_uuid);
