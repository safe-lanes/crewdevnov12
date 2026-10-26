-- Undated certificates must not silently imply permanent validity.
ALTER TABLE adm_training_master_v2
  ADD COLUMN IF NOT EXISTS certificate_expires boolean NOT NULL DEFAULT true;
ALTER TABLE adm_training_compliance_settings
  ADD COLUMN IF NOT EXISTS block_missing_expiry boolean NOT NULL DEFAULT false;
