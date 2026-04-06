-- Performance Optimization: Add indexes on frequently queried columns
-- This migration improves query performance for the most commonly used API endpoints
-- NOTE: Core indexes for vessel_planning, vessel_revisions, vessel_drafts, 
-- available_ranks, master_data_entries, crew_members, appraisal_results, 
-- and recruitment_candidates were applied directly to the database.

-- Index for forms table (frequently filtered by category)
CREATE INDEX IF NOT EXISTS idx_forms_category ON forms(category);
