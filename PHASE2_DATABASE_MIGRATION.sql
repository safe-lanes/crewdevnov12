-- ============================================
-- PHASE 2 DATABASE MIGRATION SCRIPT
-- ============================================
-- Date: 2025-11-17
-- Purpose: Apply all Phase 2 database changes to local environment
-- Tables Created: 2 (company_processing, promotion_forms)
-- Data Inserted: 8 rank_groups records
-- Indexes Created: 6
-- Foreign Keys: 2

-- ============================================
-- STEP 1: CREATE NEW TABLES
-- ============================================

-- Table: company_processing
-- Purpose: Track company processing for recruitment candidates and crew members
CREATE TABLE IF NOT EXISTS company_processing (
  id SERIAL PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  process_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  b7_data TEXT,
  comments TEXT,
  approvals TEXT,
  attachments TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for company_processing
CREATE INDEX IF NOT EXISTS idx_company_processing_candidate_id ON company_processing(candidate_id);
CREATE INDEX IF NOT EXISTS idx_company_processing_process_type ON company_processing(process_type);
CREATE INDEX IF NOT EXISTS idx_company_processing_status ON company_processing(status);

-- Table: promotion_forms
-- Purpose: Track crew member promotion requests and approvals
CREATE TABLE IF NOT EXISTS promotion_forms (
  id SERIAL PRIMARY KEY,
  crew_member_id TEXT NOT NULL,
  current_rank TEXT NOT NULL,
  proposed_rank TEXT NOT NULL,
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMP,
  submitted_by TEXT,
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  reviewer_comments TEXT,
  effective_date TEXT,
  appraisal_result_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT promotion_forms_crew_member_id_crew_members_id_fk 
    FOREIGN KEY (crew_member_id) REFERENCES crew_members(id),
  CONSTRAINT promotion_forms_appraisal_result_id_appraisal_results_id_fk
    FOREIGN KEY (appraisal_result_id) REFERENCES appraisal_results(id)
);

-- Indexes for promotion_forms
CREATE INDEX IF NOT EXISTS idx_promotion_forms_crew_member_id ON promotion_forms(crew_member_id);
CREATE INDEX IF NOT EXISTS idx_promotion_forms_status ON promotion_forms(status);
CREATE INDEX IF NOT EXISTS idx_promotion_forms_appraisal_result_id ON promotion_forms(appraisal_result_id);

-- ============================================
-- STEP 2: ALTER EXISTING TABLES
-- ============================================

-- No existing tables were modified in Phase 2

-- ============================================
-- STEP 3: INSERT DATA - RANK GROUPS FOR APPRAISAL FORMS
-- ============================================

-- Insert rank groups for all 19 maritime ranks
-- Assumes form_id = 1 exists (Crew Appraisal Form)

INSERT INTO rank_groups (form_id, name, ranks) VALUES
  (1, 'Test Senior Officers Group', '["Master", "Chief Officer", "Chief Engineer"]'),
  (1, 'Junior Deck Officers', '["Second Officer", "Third Officer"]'),
  (1, 'Junior Engine Officers', '["Second Engineer", "Third Engineer"]'),
  (1, 'Deck Ratings', '["Bosun", "Able Seaman", "Ordinary Seaman"]'),
  (1, 'Engine Ratings', '["Motorman", "Oiler", "Wiper", "Fitter"]'),
  (1, 'Catering Department', '["Chief Cook", "Cook", "Messman"]'),
  (1, 'Electrical Department', '["Electro-Technical Officer"]'),
  (1, 'Senior Officers - Promotion', '["Master", "Chief Officer", "Chief Engineer", "Second Officer", "Third Officer", "Second Engineer", "Third Engineer"]')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================

-- Verify tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('company_processing', 'promotion_forms')
ORDER BY table_name;

-- Verify table structures
\d company_processing
\d promotion_forms

-- Verify indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('company_processing', 'promotion_forms')
ORDER BY tablename, indexname;

-- Verify foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('promotion_forms')
ORDER BY tc.table_name;

-- Verify rank_groups data inserted
SELECT id, form_id, name, ranks 
FROM rank_groups 
WHERE form_id = 1 
ORDER BY id;

-- Count records in new tables
SELECT 'company_processing' AS table_name, COUNT(*) AS record_count FROM company_processing
UNION ALL
SELECT 'promotion_forms', COUNT(*) FROM promotion_forms
UNION ALL
SELECT 'rank_groups (form_id=1)', COUNT(*) FROM rank_groups WHERE form_id = 1;

