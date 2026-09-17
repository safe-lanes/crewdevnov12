-- Phase 2 of the crew mobile app: admin-authored static content, notices,
-- and per-crew notifications (published notices + document/visa expiry).
-- All statements are deliberately idempotent for tenant migration replays.
CREATE TABLE IF NOT EXISTS app_crew_content_pages (
  id SERIAL PRIMARY KEY,
  content_uuid TEXT NOT NULL UNIQUE,
  domain VARCHAR(255) NOT NULL,
  page_key TEXT NOT NULL,
  title TEXT,
  body_html TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_crew_content_pages_domain_page_key ON app_crew_content_pages(domain, page_key);

CREATE TABLE IF NOT EXISTS app_crew_notices (
  id SERIAL PRIMARY KEY,
  notice_uuid TEXT NOT NULL UNIQUE,
  domain VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_app_crew_notices_domain_published ON app_crew_notices(domain, is_published, published_at);

CREATE TABLE IF NOT EXISTS app_crew_notifications (
  id SERIAL PRIMARY KEY,
  notification_uuid TEXT NOT NULL UNIQUE,
  domain VARCHAR(255) NOT NULL,
  crew_uuid TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  source_ref_uuid TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_app_crew_notifications_crew_domain_read ON app_crew_notifications(crew_uuid, domain, is_read);
