-- Mobile/BFF-only integrity controls. Existing ERP business tables are unchanged.
ALTER TABLE app_crew_pending_changes ADD COLUMN IF NOT EXISTS operation_uuid text;
UPDATE app_crew_pending_changes
SET operation_uuid = pending_uuid
WHERE operation_uuid IS NULL;
ALTER TABLE app_crew_pending_changes ALTER COLUMN operation_uuid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_crew_pending_tenant_crew_operation_uq
  ON app_crew_pending_changes(domain, crew_uuid, operation_uuid);

CREATE TABLE IF NOT EXISTS app_crew_pending_reviews (
  id serial PRIMARY KEY,
  review_uuid text NOT NULL UNIQUE,
  pending_uuid text NOT NULL UNIQUE,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reviewer_uuid text NOT NULL,
  reviewer_name text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_crew_pending_reviews_pending_fk
    FOREIGN KEY (pending_uuid) REFERENCES app_crew_pending_changes(pending_uuid)
);

CREATE TABLE IF NOT EXISTS app_crew_erp_commands (
  id serial PRIMARY KEY,
  command_uuid text NOT NULL UNIQUE,
  pending_uuid text NOT NULL UNIQUE,
  operation_uuid text NOT NULL,
  domain varchar(255) NOT NULL,
  crew_uuid text NOT NULL,
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved','applying','applied','reconciliation_required','dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0,
  lease_owner text,
  lease_expires_at timestamptz,
  result_json text,
  error_code text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_crew_erp_commands_pending_fk
    FOREIGN KEY (pending_uuid) REFERENCES app_crew_pending_changes(pending_uuid)
);

CREATE INDEX IF NOT EXISTS app_crew_erp_commands_claim_idx
  ON app_crew_erp_commands(status, created_at);
