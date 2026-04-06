-- Migration: Create Promotions V2 tables
-- 9 normalized tables replacing V1 JSON-heavy promotion_reviews table

-- 1. Criteria Master reference table
CREATE TABLE IF NOT EXISTS promo_criteria_master_v2 (
  id SERIAL PRIMARY KEY,
  criteria_uuid TEXT NOT NULL UNIQUE,
  criteria_code TEXT NOT NULL,
  criteria_label TEXT NOT NULL,
  section TEXT,
  is_parent BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 2. Core promotion reviews table (flat fields only, no JSON)
CREATE TABLE IF NOT EXISTS promotion_reviews_v2 (
  id SERIAL PRIMARY KEY,
  review_uuid TEXT NOT NULL UNIQUE,
  crew_member_id TEXT NOT NULL,
  promotion_to_rank TEXT NOT NULL,
  selected_vessel_type_for_a2_3b TEXT,
  promotion_confirmed TEXT,
  vessel_assigned TEXT,
  promotion_date TEXT,
  promotion_timing TEXT,
  part_a_notes TEXT,
  part_b_notes TEXT,
  part_c_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 3. Criteria status (replaces criteria_verified_status + criteria_meets_status JSON)
CREATE TABLE IF NOT EXISTS promo_criteria_status_v2 (
  id SERIAL PRIMARY KEY,
  cs_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  criteria_code TEXT NOT NULL,
  verified_status TEXT,
  meets_status TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 4. CES tests (replaces ces_tests_data JSON)
CREATE TABLE IF NOT EXISTS promo_ces_tests_v2 (
  id SERIAL PRIMARY KEY,
  ct_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  test_id TEXT,
  description TEXT,
  date TEXT,
  min_score TEXT,
  score TEXT,
  result TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 5. Criteria comments (replaces criteria portion of criteria_comments JSON)
CREATE TABLE IF NOT EXISTS promo_criteria_comments_v2 (
  id SERIAL PRIMARY KEY,
  cc_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  criteria_code TEXT NOT NULL,
  comment_id TEXT,
  comment_user TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 6. Training comments (replaces a3 portion of criteria_comments JSON)
CREATE TABLE IF NOT EXISTS promo_training_comments_v2 (
  id SERIAL PRIMARY KEY,
  tc_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  training_row_id TEXT NOT NULL,
  comment_id TEXT,
  comment_user TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 7. Training needs (replaces training_needs JSON)
CREATE TABLE IF NOT EXISTS promo_training_needs_v2 (
  id SERIAL PRIMARY KEY,
  tn_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  training_row_id TEXT,
  training TEXT,
  corresponding_in_db TEXT,
  category TEXT,
  status TEXT,
  completion_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 8. Approvals (replaces approval_data + selected_approvers_for_submission JSON)
CREATE TABLE IF NOT EXISTS promo_approvals_v2 (
  id SERIAL PRIMARY KEY,
  ap_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  approver_id TEXT,
  date TEXT,
  approver TEXT,
  status TEXT,
  approval TEXT,
  comments TEXT,
  is_from_part_a BOOLEAN DEFAULT false,
  is_selected_for_submission BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 9. Checklist progress (replaces checklist_progress_data JSON)
CREATE TABLE IF NOT EXISTS promo_checklist_progress_v2 (
  id SERIAL PRIMARY KEY,
  cp_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  section_id TEXT NOT NULL,
  assessment_point_id TEXT NOT NULL,
  verifier_name TEXT,
  date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- Indexes for batch queries
CREATE INDEX IF NOT EXISTS idx_promo_reviews_v2_crew ON promotion_reviews_v2(crew_member_id);
CREATE INDEX IF NOT EXISTS idx_promo_reviews_v2_status ON promotion_reviews_v2(status);
CREATE INDEX IF NOT EXISTS idx_promo_criteria_status_v2_review ON promo_criteria_status_v2(review_uuid);
CREATE INDEX IF NOT EXISTS idx_promo_ces_tests_v2_review ON promo_ces_tests_v2(review_uuid);
CREATE INDEX IF NOT EXISTS idx_promo_criteria_comments_v2_review ON promo_criteria_comments_v2(review_uuid);
CREATE INDEX IF NOT EXISTS idx_promo_training_comments_v2_review ON promo_training_comments_v2(review_uuid);
CREATE INDEX IF NOT EXISTS idx_promo_training_needs_v2_review ON promo_training_needs_v2(review_uuid);
CREATE INDEX IF NOT EXISTS idx_promo_approvals_v2_review ON promo_approvals_v2(review_uuid);
CREATE INDEX IF NOT EXISTS idx_promo_checklist_progress_v2_review ON promo_checklist_progress_v2(review_uuid);

-- Unique constraint: one review per crew+rank combo
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_reviews_v2_crew_rank ON promotion_reviews_v2(crew_member_id, promotion_to_rank) WHERE is_deleted = false;

-- Seed criteria master data
INSERT INTO promo_criteria_master_v2 (criteria_uuid, criteria_code, criteria_label, section, is_parent, sort_order)
VALUES
  (gen_random_uuid()::text, 'a2.1', 'Higher License Criteria', 'a2', false, 1),
  (gen_random_uuid()::text, 'a2.2', 'Age Criteria', 'a2', false, 2),
  (gen_random_uuid()::text, 'a2.3', 'Experience & Sea Service Criteria', 'a2', true, 3),
  (gen_random_uuid()::text, 'a2.3a', 'Minimum Rank Experience (Vessel)', 'a2.3', false, 4),
  (gen_random_uuid()::text, 'a2.3b', 'Minimum Rank Experience (Vessel Type)', 'a2.3', false, 5),
  (gen_random_uuid()::text, 'a2.3c', 'Company Service', 'a2.3', false, 6),
  (gen_random_uuid()::text, 'a2.3d', 'Minimum Tanker Experience', 'a2.3', false, 7),
  (gen_random_uuid()::text, 'a2.4', 'Recommendations Criteria', 'a2', false, 8),
  (gen_random_uuid()::text, 'a2.5a', 'Promotion Checklist Completed', 'a2.5', false, 9),
  (gen_random_uuid()::text, 'a2.6', 'Other Criteria', 'a2', true, 10),
  (gen_random_uuid()::text, 'a2.7', 'CES / Language Tests Criteria', 'a2', true, 11),
  (gen_random_uuid()::text, 'a2.8', 'Training & Other Documents Verification', 'a2', false, 12)
ON CONFLICT (criteria_uuid) DO NOTHING;
