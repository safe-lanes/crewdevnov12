CREATE TABLE IF NOT EXISTS app_crew_privacy_requests (
  id serial PRIMARY KEY,
  request_uuid text NOT NULL UNIQUE,
  domain varchar(255) NOT NULL,
  crew_uuid text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access','export','correction','deletion')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','verifying','under_review','approved','rejected','in_progress','partially_completed','completed','legal_hold')),
  reason text,
  legal_hold boolean NOT NULL DEFAULT false,
  resolution_notes text,
  evidence_reference text,
  correlation_id text,
  identity_verified_at timestamptz,
  reviewed_at timestamptz,
  reviewer_id text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_crew_privacy_requests_owner_idx ON app_crew_privacy_requests(domain, crew_uuid, created_at DESC);
