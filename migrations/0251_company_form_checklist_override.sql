-- Default deny: install catalogue before runtime enforcement changes.
INSERT INTO adm_permission_actions(resource,action,label,sort_order)
VALUES('company_forms','override_checklist','Override checklist',7)
ON CONFLICT(resource,action) DO NOTHING;
-- Checklist decisions reuse the existing append-only Access Control audit.
CREATE INDEX IF NOT EXISTS ix_adm_audit_checklist_override
 ON adm_access_control_audit(id)
 WHERE resource='company_forms' AND action='override_checklist';
