-- Per-tenant crew-app toggles. Absence of a row for a domain means the
-- default (office verification required) applies — see
-- server/v2/crew-app/crew-information/pendingChangesService.ts.
-- All statements are deliberately idempotent for tenant migration replays.
CREATE TABLE IF NOT EXISTS app_crew_app_settings (
  id SERIAL PRIMARY KEY,
  setting_uuid TEXT NOT NULL UNIQUE,
  domain VARCHAR(255) NOT NULL UNIQUE,
  require_office_verification BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
