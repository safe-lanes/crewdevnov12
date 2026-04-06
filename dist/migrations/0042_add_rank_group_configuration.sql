-- Add configuration column to rank_groups table
-- This stores rank-group-specific configuration for appraisal forms:
-- - Part C: Competence Assessment Criteria
-- - Part D: Behavioural Assessment Criteria  
-- - Part F: Recommendations configuration
-- - Hide Field/Hide Section visibility toggles

ALTER TABLE rank_groups ADD COLUMN IF NOT EXISTS configuration TEXT;

-- The configuration JSON structure:
-- {
--   "competenceAssessmentCriteria": [...], -- Part C criteria
--   "behaviouralAssessmentCriteria": [...], -- Part D criteria
--   "recommendations": [...], -- Part F recommendations
--   "hiddenFields": [...], -- Hidden field IDs
--   "hiddenSections": [...] -- Hidden section IDs
-- }
