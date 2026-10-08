-- Independent actions coexist with the legacy menu CRUD grants.
CREATE TABLE IF NOT EXISTS adm_permission_actions (
  resource text NOT NULL,
  action text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (resource, action)
);
CREATE TABLE IF NOT EXISTS adm_resource_action_grants (
  role_id text NOT NULL REFERENCES adm_rolemaster_ac(ruid) ON DELETE RESTRICT,
  resource text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  updated_by_uuid text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, resource, action),
  FOREIGN KEY (resource, action) REFERENCES adm_permission_actions(resource, action) ON DELETE RESTRICT
);
INSERT INTO adm_permission_actions(resource, action, label, sort_order) VALUES
 ('company_forms','view','View',1),
 ('company_forms','fill_in','Fill in',2),
 ('company_forms','witness','Witness',3),
 ('company_forms','sign_representative','Sign as Company Representative',4),
 ('company_forms','void','Void',5),
 ('company_forms','void_completed','Void completed',6)
ON CONFLICT (resource,action) DO NOTHING;
-- No grants: catalogue installation alone must never authorize operations.
