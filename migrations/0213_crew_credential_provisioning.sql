-- Delivery state is deliberately separate from authentication state.
ALTER TABLE app_crew_credentials
  ADD COLUMN IF NOT EXISTS provisioning_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE app_crew_credentials
  ADD COLUMN IF NOT EXISTS temporary_password_consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioning_operation_uuid TEXT;