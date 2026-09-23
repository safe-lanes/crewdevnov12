-- Seeds the alert policy that fires whenever a crew member submits an entry
-- via the crew-portal mobile app. Reuses the existing generic alert engine
-- (alert_policies_v2 / alert_events_v2) instead of a separate mechanism —
-- see server/v2/crew-app/crew-information/pendingChangesService.ts.
-- Each tenant can re-target recipients or disable this policy afterwards via
-- the same admin screen used for the other policies below; no code change
-- is required per client.
INSERT INTO alert_policies_v2 (apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled, thresholds, scope_filters, recipients, created_by_uuid)
VALUES
  ('policy-crew-portal-submission', 'crew_portal_submission', TRUE, 'medium', FALSE, TRUE, '{}', '{}', '{"roles": ["admin", "manager"]}', 'system')
ON CONFLICT (apuuid) DO NOTHING;
