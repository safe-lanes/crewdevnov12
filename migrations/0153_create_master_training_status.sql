-- 0153: Training Status master (per-module training-item status values)
-- Only training-section statuses are managed here; record/workflow statuses
-- (draft/submitted/approved, rotation Planned, etc.) are NOT affected.

CREATE TABLE IF NOT EXISTS master_training_status (
  id SERIAL PRIMARY KEY,
  mts_uuid TEXT NOT NULL UNIQUE,
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
  CONSTRAINT uq_master_training_status_module_label UNIQUE (module, label)
);

-- Seed: Promotion and Appraisal get today's exact hardcoded values;
-- Training & Retention gets the full union of statuses.
INSERT INTO master_training_status (mts_uuid, label, module, is_active, sort_order)
VALUES
  (gen_random_uuid()::text, 'Proposed',    'Promotion', TRUE, 1),
  (gen_random_uuid()::text, 'Approved',    'Promotion', TRUE, 2),
  (gen_random_uuid()::text, 'Planned',     'Promotion', TRUE, 3),
  (gen_random_uuid()::text, 'Declined',    'Promotion', TRUE, 4),
  (gen_random_uuid()::text, 'Completed',   'Promotion', TRUE, 5),
  (gen_random_uuid()::text, 'Proposed',    'Appraisal', TRUE, 1),
  (gen_random_uuid()::text, 'Approved',    'Appraisal', TRUE, 2),
  (gen_random_uuid()::text, 'Planned',     'Appraisal', TRUE, 3),
  (gen_random_uuid()::text, 'Declined',    'Appraisal', TRUE, 4),
  (gen_random_uuid()::text, 'Completed',   'Appraisal', TRUE, 5),
  (gen_random_uuid()::text, 'Pending',     'Training & Retention', TRUE, 1),
  (gen_random_uuid()::text, 'Scheduled',   'Training & Retention', TRUE, 2),
  (gen_random_uuid()::text, 'In Progress', 'Training & Retention', TRUE, 3),
  (gen_random_uuid()::text, 'Completed',   'Training & Retention', TRUE, 4),
  (gen_random_uuid()::text, 'Cancelled',   'Training & Retention', TRUE, 5),
  (gen_random_uuid()::text, 'Proposed',    'Training & Retention', TRUE, 6),
  (gen_random_uuid()::text, 'Approved',    'Training & Retention', TRUE, 7),
  (gen_random_uuid()::text, 'Planned',     'Training & Retention', TRUE, 8),
  (gen_random_uuid()::text, 'Declined',    'Training & Retention', TRUE, 9)
ON CONFLICT (module, label) DO NOTHING;
