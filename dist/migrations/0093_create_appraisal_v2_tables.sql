-- Migration 0093: Create Appraisal V2 tables
-- Normalizes V1 single-table (appraisal_results) with JSON blobs
-- into 11 tables: 1 parent + 10 child tables

-- 1. Parent table: appraisal_results_v2
CREATE TABLE IF NOT EXISTS appraisal_results_v2 (
  id SERIAL PRIMARY KEY,
  appraisal_uuid TEXT NOT NULL UNIQUE,
  crew_member_id TEXT NOT NULL,
  form_uuid TEXT,
  form_id_legacy INTEGER,
  appraisal_type TEXT NOT NULL,
  appraisal_date TEXT NOT NULL,
  -- Part A fields (extracted from V1 appraisal_data JSON)
  seafarers_name TEXT,
  seafarers_rank TEXT,
  nationality TEXT,
  vessel TEXT,
  sign_on TEXT,
  appraisal_period_from TEXT,
  appraisal_period_to TEXT,
  personality_index_category TEXT,
  primary_appraiser TEXT,
  -- Computed ratings
  competence_rating TEXT,
  behavioral_rating TEXT,
  overall_rating TEXT,
  -- Submission info
  submitted_at TIMESTAMP DEFAULT NOW(),
  submitted_by TEXT NOT NULL,
  -- Overall status (draft|preliminary|submitted|reviewed)
  status TEXT NOT NULL DEFAULT 'draft',
  -- Stage statuses (flattened from V1 stage_statuses JSON)
  stage1_status TEXT,
  stage1_submitted_at TEXT,
  stage1_submitted_by TEXT,
  stage2_status TEXT,
  stage2_submitted_at TEXT,
  stage2_submitted_by TEXT,
  stage3_status TEXT,
  stage3_submitted_at TEXT,
  stage3_submitted_by TEXT,
  -- Standard V2 columns
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 2. Part B: trainings array
CREATE TABLE IF NOT EXISTS appr_trainings_v2 (
  id SERIAL PRIMARY KEY,
  training_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  training TEXT,
  evaluation TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 3. Part B: targets array
CREATE TABLE IF NOT EXISTS appr_targets_v2 (
  id SERIAL PRIMARY KEY,
  target_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  target_setting TEXT,
  evaluation TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 4. Part C: competence assessments array
CREATE TABLE IF NOT EXISTS appr_competence_assessments_v2 (
  id SERIAL PRIMARY KEY,
  competence_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  assessment_criteria TEXT,
  weight INTEGER,
  effectiveness TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 5. Part D: behavioural assessments array
CREATE TABLE IF NOT EXISTS appr_behavioural_assessments_v2 (
  id SERIAL PRIMARY KEY,
  behavioural_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  assessment_criteria TEXT,
  weight INTEGER,
  effectiveness TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 6. Part E: training needs array
CREATE TABLE IF NOT EXISTS appr_training_needs_v2 (
  id SERIAL PRIMARY KEY,
  training_need_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  training TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 7. Part F: recommendations array
CREATE TABLE IF NOT EXISTS appr_recommendations_v2 (
  id SERIAL PRIMARY KEY,
  recommendation_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  question TEXT,
  answer TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 8. Part F: appraiser comments array
CREATE TABLE IF NOT EXISTS appr_appraiser_comments_v2 (
  id SERIAL PRIMARY KEY,
  appraiser_comment_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  name TEXT,
  rank TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 9. Part F: seafarer comments array
CREATE TABLE IF NOT EXISTS appr_seafarer_comments_v2 (
  id SERIAL PRIMARY KEY,
  seafarer_comment_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  name TEXT,
  rank TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 10. Part G: office reviews array
CREATE TABLE IF NOT EXISTS appr_office_reviews_v2 (
  id SERIAL PRIMARY KEY,
  office_review_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  name TEXT,
  position TEXT,
  feedback TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- 11. Part G: training followups array
CREATE TABLE IF NOT EXISTS appr_training_followups_v2 (
  id SERIAL PRIMARY KEY,
  training_followup_uuid TEXT NOT NULL UNIQUE,
  appraisal_uuid TEXT NOT NULL,
  training TEXT,
  corresponding_in_db TEXT,
  category TEXT,
  status TEXT,
  target_date TEXT,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);
