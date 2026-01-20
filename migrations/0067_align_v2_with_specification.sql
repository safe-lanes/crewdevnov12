-- Migration 0067: Align V2 schema with ERD specification
-- Fixes column names and adds missing columns to match specification exactly

-- ============================================================================
-- 1. cand_approvals: rename approved_date -> approval_date, add approval_result
-- ============================================================================
ALTER TABLE cand_approvals 
  RENAME COLUMN approved_date TO approval_date;

ALTER TABLE cand_approvals 
  ADD COLUMN IF NOT EXISTS approval_result TEXT;

-- ============================================================================
-- 2. cand_assigned_groups: rename ag_uuid -> cag_uuid, 
--    rename rec_can_uuid -> decision_uuid, add sort_order
-- ============================================================================
ALTER TABLE cand_assigned_groups 
  RENAME COLUMN ag_uuid TO cag_uuid;

ALTER TABLE cand_assigned_groups 
  RENAME COLUMN rec_can_uuid TO decision_uuid;

ALTER TABLE cand_assigned_groups 
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- ============================================================================
-- 3. cand_recruitment_decision: rename decision -> recruitment_status,
--    rename decided_by_uuid -> submitted_by_uuid, 
--    rename decision_date -> submitted_date
-- ============================================================================
ALTER TABLE cand_recruitment_decision 
  RENAME COLUMN decision TO recruitment_status;

ALTER TABLE cand_recruitment_decision 
  RENAME COLUMN decided_by_uuid TO submitted_by_uuid;

ALTER TABLE cand_recruitment_decision 
  RENAME COLUMN decision_date TO submitted_date;

-- ============================================================================
-- 4. screening_b8_shortlisting: add shortlisted column
-- ============================================================================
ALTER TABLE screening_b8_shortlisting 
  ADD COLUMN IF NOT EXISTS shortlisted TEXT;
