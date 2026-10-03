CREATE TABLE IF NOT EXISTS app_crew_privacy_request_audits (
  id serial PRIMARY KEY,
  audit_uuid text NOT NULL UNIQUE,
  request_uuid text NOT NULL,
  actor_uuid text NOT NULL,
  previous_status text NOT NULL,
  new_status text NOT NULL,
  action text NOT NULL CHECK (action IN ('identity_verified','approved','rejected','legal_hold','execution_started','execution_completed','execution_partial')),
  reason text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_crew_privacy_request_audits_request_idx ON app_crew_privacy_request_audits(request_uuid, created_at);
COMMENT ON TABLE app_crew_privacy_request_audits IS 'Immutable office decisions and execution evidence for mobile privacy requests.';

INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), 'Privacy Request Operations', 'Privacy Request Operations', '/crew-pool/privacy-requests', p.muid, true, 4
FROM (SELECT muid FROM adm_menumaster_ac WHERE name = 'Crew Pool' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;
-- No role grants are created automatically. Privacy/legal administrators must grant this explicitly.
