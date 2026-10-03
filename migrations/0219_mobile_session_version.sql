-- Mobile-only immediate session revocation. ERP user authentication is unchanged.
ALTER TABLE app_crew_credentials
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
