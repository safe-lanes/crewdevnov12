-- Separate catalogue migration: 0270 is already applied and immutable.
-- Read-only preflight and development fingerprints passed before promotion.
-- No role grants are created. Missing action decisions remain denied.
INSERT INTO adm_permission_actions(resource,action,label,sort_order)
VALUES ('kpi_targets','set','Set KPI targets',1)
ON CONFLICT(resource,action) DO NOTHING;
-- Rollback must refuse while grants reference this action; the existing
-- foreign key enforces that refusal. Do not cascade-delete grants or audits.
