-- Add vessel particulars supplied by the external master-data API.

ALTER TABLE master_vessels
  ADD COLUMN IF NOT EXISTS year_built TEXT,
  ADD COLUMN IF NOT EXISTS dead_weight TEXT,
  ADD COLUMN IF NOT EXISTS vessel_owner TEXT;