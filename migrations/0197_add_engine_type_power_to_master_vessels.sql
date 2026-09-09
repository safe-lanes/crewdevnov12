-- Add Engine Type/Power to master_vessels, mirroring the vessel particulars
-- added in migration 0195 (year_built, dead_weight, vessel_owner). Lets
-- Company sea service auto-fill Engine Type/Power the same way it already
-- can for Deadweight and Owner/Operator, once the external master data sync
-- starts sending this field.

ALTER TABLE master_vessels
  ADD COLUMN IF NOT EXISTS engine_type_power TEXT;
