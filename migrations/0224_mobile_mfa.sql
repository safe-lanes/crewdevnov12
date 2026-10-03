ALTER TABLE app_crew_credentials
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS mfa_secret_nonce text,
  ADD COLUMN IF NOT EXISTS mfa_recovery_code_hashes text NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;

