CREATE TABLE IF NOT EXISTS adm_permission_upgrade_report (
  migration_key text NOT NULL,
  role_id text NOT NULL,
  role_name text NOT NULL,
  category text NOT NULL,
  upgrade boolean NOT NULL,
  legacy_grants jsonb NOT NULL,
  before_access jsonb NOT NULL,
  after_access jsonb NOT NULL,
  notes text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (migration_key, role_id)
);

-- The runner explicitly marks upgrades using the ledger present BEFORE its
-- first migration. Missing context is deny-by-default (fresh provisioning).
INSERT INTO adm_permission_upgrade_report
 (migration_key, role_id, role_name, category, upgrade, legacy_grants, before_access, after_access, notes)
WITH crew_menu AS (
 SELECT min(muid) AS muid FROM adm_menumaster_ac
 WHERE name='Crew Database' AND is_active=true AND COALESCE(is_deleted,false)=false
 HAVING count(*)=1
), old_grants AS (
 SELECT g.role_id, bool_or(g.canview) AS v, bool_or(g.cancreate) AS c, bool_or(g.canedit) AS e
 FROM adm_roleaccess_ac g JOIN crew_menu m ON m.muid=g.menu_id
 WHERE COALESCE(g.is_deleted,false)=false GROUP BY g.role_id HAVING count(*)=1
), roles AS (
 SELECT r.*, COALESCE(g.v,false) AS v, COALESCE(g.c,false) AS c, COALESCE(g.e,false) AS e,
   r.is_active AND NOT COALESCE(r.is_deleted,false) AND
   (SELECT count(*) FROM adm_rolemaster_ac x WHERE x.is_active=true AND COALESCE(x.is_deleted,false)=false
     AND lower(btrim(x.assigned_role))=lower(btrim(r.assigned_role)))=1 AS eligible,
   COALESCE(current_setting('sail.permission_upgrade',true),'false')='true' AS upgrading
 FROM adm_rolemaster_ac r LEFT JOIN old_grants g ON g.role_id=r.ruid
)
SELECT 'company_forms_actions', ruid, assigned_role, roletype, upgrading,
 jsonb_build_object('view',v,'create',c,'edit',e,'create_without_edit',c AND NOT e),
 jsonb_build_object(
   'view',eligible AND ((lower(btrim(roletype))='office' AND v) OR lower(btrim(roletype))='ship'),
   'start',eligible AND ((lower(btrim(roletype))='office' AND c) OR lower(btrim(roletype))='ship'),
   'fill_in',eligible AND ((lower(btrim(roletype))='office' AND e) OR lower(btrim(roletype))='ship'),
   'witness',eligible AND ((lower(btrim(roletype))='office' AND e) OR lower(btrim(roletype))='ship'),
   'sign_representative',eligible AND lower(btrim(roletype))='office' AND e,
   'void',eligible AND lower(btrim(roletype))='office' AND e,
   'void_completed',eligible AND lower(btrim(roletype))='office' AND e),
 jsonb_build_object(
   'view',upgrading AND eligible AND ((lower(btrim(roletype))='office' AND v) OR lower(btrim(roletype))='ship'),
   'fill_in',upgrading AND eligible AND ((lower(btrim(roletype))='office' AND e) OR lower(btrim(roletype))='ship'),
   'witness',upgrading AND eligible AND ((lower(btrim(roletype))='office' AND e) OR lower(btrim(roletype))='ship'),
   'sign_representative',upgrading AND eligible AND lower(btrim(roletype))='office' AND e,
   'void',upgrading AND eligible AND lower(btrim(roletype))='office' AND e,
   'void_completed',false),
 CASE WHEN NOT upgrading THEN 'Fresh tenant: all operational grants off. '
   WHEN NOT eligible THEN 'Inactive, deleted or ambiguous role: no migrated operational authority. '
   WHEN lower(btrim(roletype))='ship' THEN 'Vessel access conditional on trusted own-vessel membership, stage and pinned permitted-role/section rules; no migrated void. '
   WHEN lower(btrim(roletype))='office' THEN 'Office scope: all tenant vessels, with pinned section/stage constraints. Completed-void authority intentionally removed. '
   ELSE 'Unknown/support category: no migrated operations; runtime category restrictions apply. ' END
 || CASE WHEN c AND NOT e THEN 'CREATE WITHOUT EDIT: Fill in not inferred from Create. ' ELSE '' END
 || CASE WHEN NOT c AND e AND lower(btrim(roletype))='office' THEN 'Fill in now includes start although legacy Create was off. ' ELSE '' END
FROM roles
ON CONFLICT (migration_key,role_id) DO NOTHING;

INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed,updated_by_uuid)
SELECT r.role_id, a.resource, a.action, (r.after_access->>a.action)::boolean, 'permission-upgrade'
FROM adm_permission_upgrade_report r CROSS JOIN adm_permission_actions a
WHERE r.migration_key='company_forms_actions' AND a.resource='company_forms'
ON CONFLICT (role_id,resource,action) DO NOTHING;
-- Re-running never overwrites subsequent administrator decisions.
