-- Migration: Add separate contract fields for relievers
-- Purpose: Contract duration is person-specific. On-board crew and relievers 
-- should have independent contract terms that don't interfere with each other.
-- When a reliever signs on as primary, their contract data transfers to the primary fields.

ALTER TABLE vessel_planning 
ADD COLUMN IF NOT EXISTS reliever_contract_period_months INTEGER;

ALTER TABLE vessel_planning 
ADD COLUMN IF NOT EXISTS reliever_contract_end_range_start_months INTEGER;

ALTER TABLE vessel_planning 
ADD COLUMN IF NOT EXISTS reliever_contract_end_range_end_months INTEGER;

-- Add comments for clarity
COMMENT ON COLUMN vessel_planning.contract_period_months IS 'Primary on-board crew contract period in months';
COMMENT ON COLUMN vessel_planning.contract_end_range_start_months IS 'Primary on-board crew contract end range start in months';
COMMENT ON COLUMN vessel_planning.contract_end_range_end_months IS 'Primary on-board crew contract end range end in months';
COMMENT ON COLUMN vessel_planning.reliever_contract_period_months IS 'Reliever contract period in months (person-specific)';
COMMENT ON COLUMN vessel_planning.reliever_contract_end_range_start_months IS 'Reliever contract end range start in months (person-specific)';
COMMENT ON COLUMN vessel_planning.reliever_contract_end_range_end_months IS 'Reliever contract end range end in months (person-specific)';
