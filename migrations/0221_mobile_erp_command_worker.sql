-- BFF-only durable command execution controls. Authoritative ERP tables are unchanged.
ALTER TABLE app_crew_erp_commands
  DROP CONSTRAINT IF EXISTS app_crew_erp_commands_status_check;

UPDATE app_crew_erp_commands SET status = 'queued' WHERE status = 'approved';

ALTER TABLE app_crew_erp_commands
  ALTER COLUMN status SET DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS command_type text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_summary text,
  ADD COLUMN IF NOT EXISTS authoritative_record_uuid text,
  ADD COLUMN IF NOT EXISTS authoritative_result_hash text,
  ADD COLUMN IF NOT EXISTS approved_payload_hash text,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

ALTER TABLE app_crew_erp_commands
  ADD CONSTRAINT app_crew_erp_commands_status_check CHECK (status IN (
    'queued','leased','applying','verifying','applied','retryable',
    'reconciliation_required','manual_reconciliation_required','dead_letter','blocked'
  ));

UPDATE app_crew_erp_commands c
SET command_type = CASE
  WHEN p.action = 'create' THEN 'CREATE_' || upper(replace(p.section, '-', '_'))
  WHEN p.action = 'delete' THEN 'DELETE_' || upper(replace(p.section, '-', '_'))
  WHEN p.section = 'vessel-types' THEN 'SYNC_VESSEL_TYPES'
  WHEN p.section = 'particulars' THEN 'UPDATE_CREW_PARTICULARS'
  WHEN p.section = 'personal' THEN 'UPSERT_PERSONAL_DETAILS'
  WHEN p.section = 'contact' THEN 'UPSERT_ADDRESS'
  WHEN p.section = 'family' THEN 'UPSERT_FAMILY_INFORMATION'
  WHEN p.section = 'next-of-kin' THEN 'UPSERT_NEXT_OF_KIN'
  ELSE 'UPDATE_' || upper(replace(p.section, '-', '_'))
END
FROM app_crew_pending_changes p
WHERE c.pending_uuid = p.pending_uuid AND c.command_type IS NULL;

ALTER TABLE app_crew_erp_commands ALTER COLUMN command_type SET NOT NULL;

DROP INDEX IF EXISTS app_crew_erp_commands_claim_idx;
CREATE INDEX app_crew_erp_commands_claim_idx
  ON app_crew_erp_commands(status, next_attempt_at, created_at);
CREATE INDEX app_crew_erp_commands_expired_lease_idx
  ON app_crew_erp_commands(lease_expires_at)
  WHERE status IN ('leased','applying','verifying');
