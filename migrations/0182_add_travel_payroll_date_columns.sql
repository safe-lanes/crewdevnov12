-- Task 559: Add travel/payroll date fields to vessel planning
-- Adds 3 columns to vessel_planning_v2:
--   planned_confirmed_date : auto-stamped with the Rotation approval date on deploy, manually editable
--   travel_start_date      : mandatory when Sign On Status is "In Transit"
--   travel_end_date        : fillable only after Sign Off
-- Idempotent: safe to run multiple times (IF NOT EXISTS).

ALTER TABLE vessel_planning_v2 ADD COLUMN IF NOT EXISTS planned_confirmed_date text;
ALTER TABLE vessel_planning_v2 ADD COLUMN IF NOT EXISTS travel_start_date text;
ALTER TABLE vessel_planning_v2 ADD COLUMN IF NOT EXISTS travel_end_date text;
