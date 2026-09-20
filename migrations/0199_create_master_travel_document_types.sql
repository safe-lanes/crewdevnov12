-- 0199: Travel Document Type master (used by Crew Pool C1 and Recruitment A2.1
-- "Add from database" pickers, replacing the previously hardcoded template list).

CREATE TABLE IF NOT EXISTS master_travel_document_types (
  id SERIAL PRIMARY KEY,
  mtdt_uuid TEXT NOT NULL UNIQUE,
  entry_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Seed with the same 3 entries previously hardcoded in
-- client/src/utils/data/travelDocumentTemplates.ts, so existing usage is preserved.
INSERT INTO master_travel_document_types (mtdt_uuid, entry_id, name, is_active, sort_order)
VALUES
  (gen_random_uuid()::text, 'DOC001', 'Passport', TRUE, 1),
  (gen_random_uuid()::text, 'DOC002', 'Seaman''s Book', TRUE, 2),
  (gen_random_uuid()::text, 'DOC003', 'Flag''s Seaman Book', TRUE, 3)
ON CONFLICT (entry_id) DO NOTHING;
