-- Parent role refresh uses TRUNCATE CASCADE. A FK to that replaceable mirror
-- would erase decisions even when the parent UUID survives the refresh.
-- Preserve UUID-keyed decisions; runtime reads join an active trusted role and
-- fail closed while the role is absent. The action-catalogue FK stays enforced.
ALTER TABLE adm_resource_action_grants
  DROP CONSTRAINT IF EXISTS adm_resource_action_grants_role_id_fkey;
