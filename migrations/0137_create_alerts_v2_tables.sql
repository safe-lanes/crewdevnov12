-- Migration 0137: Create V2 Alerts Tables
-- Purpose: Adds notification tables for crewing (alert_policies_v2, alert_events_v2, alert_deliveries_v2).
-- Rollback: DROP TABLE IF EXISTS alert_deliveries_v2; DROP TABLE IF EXISTS alert_events_v2; DROP TABLE IF EXISTS alert_policies_v2;

CREATE TABLE IF NOT EXISTS alert_policies_v2 (
  id SERIAL PRIMARY KEY,
  apuuid TEXT NOT NULL UNIQUE,
  alert_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority TEXT NOT NULL DEFAULT 'medium',
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  thresholds TEXT NOT NULL DEFAULT '{}',
  scope_filters TEXT NOT NULL DEFAULT '{}',
  recipients TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS alert_events_v2 (
  id SERIAL PRIMARY KEY,
  aeuuid TEXT NOT NULL UNIQUE,
  policy_uuid TEXT NOT NULL REFERENCES alert_policies_v2(apuuid),
  alert_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  state TEXT,
  payload TEXT NOT NULL,
  ack_by TEXT,
  ack_at TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS alert_deliveries_v2 (
  id SERIAL PRIMARY KEY,
  event_uuid TEXT NOT NULL REFERENCES alert_events_v2(aeuuid),
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_policies_v2_apuuid ON alert_policies_v2(apuuid);
CREATE INDEX IF NOT EXISTS idx_alert_events_v2_aeuuid ON alert_events_v2(aeuuid);
CREATE INDEX IF NOT EXISTS idx_alert_events_v2_dedupe_key ON alert_events_v2(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_v2_event_uuid ON alert_deliveries_v2(event_uuid);

-- Seed default alert policies
INSERT INTO alert_policies_v2 (apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled, thresholds, scope_filters, recipients, created_by_uuid)
VALUES 
  ('policy-visa-exp', 'visa_expiration', TRUE, 'high', FALSE, TRUE, '{"daysBefore": 30}', '{}', '{"roles": ["admin", "manager"]}', 'system')
ON CONFLICT (apuuid) DO NOTHING;

INSERT INTO alert_policies_v2 (apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled, thresholds, scope_filters, recipients, created_by_uuid)
VALUES 
  ('policy-doc-exp', 'document_expiration', TRUE, 'medium', FALSE, TRUE, '{"daysBefore": 30}', '{}', '{"roles": ["admin", "manager"]}', 'system')
ON CONFLICT (apuuid) DO NOTHING;

INSERT INTO alert_policies_v2 (apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled, thresholds, scope_filters, recipients, created_by_uuid)
VALUES 
  ('policy-relief-due', 'relief_due', TRUE, 'medium', FALSE, TRUE, '{"daysBefore": 14}', '{}', '{"roles": ["admin", "manager"]}', 'system')
ON CONFLICT (apuuid) DO NOTHING;

INSERT INTO alert_policies_v2 (apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled, thresholds, scope_filters, recipients, created_by_uuid)
VALUES 
  ('policy-appraisal-due', 'appraisal_due', TRUE, 'low', FALSE, TRUE, '{"daysBefore": 7}', '{}', '{"roles": ["admin", "manager"]}', 'system')
ON CONFLICT (apuuid) DO NOTHING;
