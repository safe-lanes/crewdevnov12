-- Isolated auth system for the crew-facing mobile app (Phase 1).
-- All statements are deliberately idempotent for tenant migration replays.
CREATE TABLE IF NOT EXISTS app_crew_credentials (
  id SERIAL PRIMARY KEY,
  credential_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  domain VARCHAR(255) NOT NULL,
  emp_no TEXT,
  mobile TEXT,
  email TEXT,
  password_hash TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'Crew',
  is_active BOOLEAN DEFAULT true,
  must_reset_password BOOLEAN DEFAULT true,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_crew_credentials_crew_uuid_domain ON app_crew_credentials(crew_uuid, domain);
CREATE INDEX IF NOT EXISTS idx_app_crew_credentials_emp_no_domain ON app_crew_credentials(emp_no, domain);
CREATE INDEX IF NOT EXISTS idx_app_crew_credentials_mobile_domain ON app_crew_credentials(mobile, domain);
CREATE INDEX IF NOT EXISTS idx_app_crew_credentials_email_domain ON app_crew_credentials(email, domain);

CREATE TABLE IF NOT EXISTS app_crew_refresh_tokens (
  id SERIAL PRIMARY KEY,
  refresh_token_uuid TEXT NOT NULL UNIQUE,
  crew_credential_id INTEGER NOT NULL REFERENCES app_crew_credentials(id) ON UPDATE CASCADE ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT,
  device_label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_crew_refresh_tokens_crew_credential_id ON app_crew_refresh_tokens(crew_credential_id);
CREATE INDEX IF NOT EXISTS idx_app_crew_refresh_tokens_expires_at ON app_crew_refresh_tokens(expires_at);
