-- Crew Pool: Briefing & De-briefing tables
-- These four tables are defined in shared/v2/crew-pool/schema.ts (section
-- "G. BRIEFING & DE-BRIEFING") but had no migration; they only existed in dev
-- via `drizzle-kit push`. This migration creates them idempotently so fresh,
-- production, and per-tenant databases all get them.
--
-- NOTE: audit timestamp columns use TIMESTAMP (without time zone) to match the
-- Drizzle schema's timestamp(...).defaultNow() and the existing pushed dev DB.

-- Table 1: Crew Briefings
CREATE TABLE IF NOT EXISTS crew_briefings (
  id SERIAL PRIMARY KEY,
  briefing_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT,
  vessel_name TEXT,
  joining_rank TEXT,
  date_sign_on TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Table 2: Crew Briefing Attachments
CREATE TABLE IF NOT EXISTS crew_briefing_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  briefing_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Table 3: Crew De-briefings
CREATE TABLE IF NOT EXISTS crew_debriefings (
  id SERIAL PRIMARY KEY,
  debriefing_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT,
  vessel_name TEXT,
  rank_served TEXT,
  date_sign_on TEXT,
  date_signed_off TEXT,
  reason_for_sign_off TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Table 4: Crew De-briefing Attachments
CREATE TABLE IF NOT EXISTS crew_debriefing_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  debriefing_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crew_briefings_crew_uuid ON crew_briefings(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_briefings_is_deleted ON crew_briefings(is_deleted);

CREATE INDEX IF NOT EXISTS idx_crew_briefing_attachments_briefing_uuid ON crew_briefing_attachments(briefing_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_briefing_attachments_is_deleted ON crew_briefing_attachments(is_deleted);

CREATE INDEX IF NOT EXISTS idx_crew_debriefings_crew_uuid ON crew_debriefings(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_debriefings_is_deleted ON crew_debriefings(is_deleted);

CREATE INDEX IF NOT EXISTS idx_crew_debriefing_attachments_debriefing_uuid ON crew_debriefing_attachments(debriefing_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_debriefing_attachments_is_deleted ON crew_debriefing_attachments(is_deleted);
