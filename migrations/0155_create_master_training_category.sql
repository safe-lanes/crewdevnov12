-- 0155: Training Category master (per-module training-item category values)
-- Centralizes category values used across Recruitment, Appraisal, Promotion,
-- and Training & Retention training-need dropdowns.

CREATE TABLE IF NOT EXISTS master_training_category (
  id SERIAL PRIMARY KEY,
  mtc_uuid TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  module TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT uq_master_training_category_module_label UNIQUE (module, label)
);

-- Seed: Recruitment keeps its current values; Appraisal and Promotion get
-- the number-stripped "Competence"/"Soft Skills" values; Training & Retention
-- keeps its current values (including "Other").
INSERT INTO master_training_category (mtc_uuid, label, module, is_active, sort_order)
VALUES
  (gen_random_uuid()::text, 'Mandatory',    'Recruitment', TRUE, 1),
  (gen_random_uuid()::text, 'Recommended',  'Recruitment', TRUE, 2),
  (gen_random_uuid()::text, 'Optional',     'Recruitment', TRUE, 3),
  (gen_random_uuid()::text, 'Competence',   'Appraisal', TRUE, 1),
  (gen_random_uuid()::text, 'Soft Skills',  'Appraisal', TRUE, 2),
  (gen_random_uuid()::text, 'Competence',   'Promotion', TRUE, 1),
  (gen_random_uuid()::text, 'Soft Skills',  'Promotion', TRUE, 2),
  (gen_random_uuid()::text, 'Mandatory',    'Training & Retention', TRUE, 1),
  (gen_random_uuid()::text, 'Recommended',  'Training & Retention', TRUE, 2),
  (gen_random_uuid()::text, 'Optional',     'Training & Retention', TRUE, 3),
  (gen_random_uuid()::text, 'Other',        'Training & Retention', TRUE, 4)
ON CONFLICT (module, label) DO NOTHING;
