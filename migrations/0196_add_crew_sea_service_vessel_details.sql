-- Persist external vessel particulars selected for Crew Pool sea service.

ALTER TABLE crew_sea_service
  ADD COLUMN IF NOT EXISTS imo_number TEXT,
  ADD COLUMN IF NOT EXISTS year_built TEXT;