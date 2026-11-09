ALTER TABLE acc_engagement_pay_elements_v2
ADD COLUMN IF NOT EXISTS eligibility_rules_version
INTEGER NOT NULL DEFAULT 0;
