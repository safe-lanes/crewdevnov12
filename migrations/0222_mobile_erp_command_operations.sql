-- Operational audit and dedicated RBAC surface. No authoritative ERP table changes.
CREATE TABLE IF NOT EXISTS app_crew_erp_command_audits (
  id serial PRIMARY KEY,
  audit_uuid text NOT NULL UNIQUE,
  command_uuid text NOT NULL,
  operator_uuid text NOT NULL,
  previous_status text NOT NULL,
  new_status text NOT NULL,
  decision text NOT NULL,
  reason text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_crew_erp_command_audits_command_fk FOREIGN KEY(command_uuid)
    REFERENCES app_crew_erp_commands(command_uuid)
);
CREATE INDEX IF NOT EXISTS app_crew_erp_command_audits_command_idx
  ON app_crew_erp_command_audits(command_uuid, created_at);

INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
SELECT gen_random_uuid(), 'ERP Command Operations', 'ERP Command Operations', '/crew-pool/erp-command-operations', p.muid, true, 3
FROM (SELECT muid FROM adm_menumaster_ac WHERE name = 'Crew Pool' AND parent_menu IS NULL LIMIT 1) p
ON CONFLICT (name) DO NOTHING;
-- Deliberately no adm_roleaccess_ac grants: security/operations administrators must grant this explicitly.
