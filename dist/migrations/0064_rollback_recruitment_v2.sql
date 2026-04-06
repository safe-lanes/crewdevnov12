-- Migration: 0064_rollback_recruitment_v2.sql
-- Description: Rollback recruitment v2 tables and revert changes to recruitment_candidates
-- Date: 2026-01-20

-- ============================================================================
-- DROP ALL V2 TABLES (from migrations 0057-0060)
-- ============================================================================

-- Phase 4 tables (approvals)
DROP TABLE IF EXISTS approval_workflows CASCADE;
DROP TABLE IF EXISTS decision_audit_trail CASCADE;
DROP TABLE IF EXISTS onboarding_tasks CASCADE;
DROP TABLE IF EXISTS employment_contracts CASCADE;
DROP TABLE IF EXISTS offer_letters CASCADE;
DROP TABLE IF EXISTS hiring_decisions CASCADE;

-- Phase 3 tables (screening)
DROP TABLE IF EXISTS screening_evaluation_approvals CASCADE;
DROP TABLE IF EXISTS screening_final_evaluation CASCADE;
DROP TABLE IF EXISTS screening_peme_results CASCADE;
DROP TABLE IF EXISTS screening_peme CASCADE;
DROP TABLE IF EXISTS screening_drug_alcohol_tests CASCADE;
DROP TABLE IF EXISTS screening_psychometric_dimensions CASCADE;
DROP TABLE IF EXISTS screening_psychometric_tests CASCADE;
DROP TABLE IF EXISTS screening_behavioral_assessments CASCADE;
DROP TABLE IF EXISTS screening_interview_questions CASCADE;
DROP TABLE IF EXISTS screening_interview_notes CASCADE;
DROP TABLE IF EXISTS screening_interview_panelists CASCADE;
DROP TABLE IF EXISTS screening_interviews CASCADE;
DROP TABLE IF EXISTS screening_practical_tests CASCADE;
DROP TABLE IF EXISTS screening_competency_ratings CASCADE;
DROP TABLE IF EXISTS screening_technical_skills CASCADE;
DROP TABLE IF EXISTS screening_equipment_experience CASCADE;
DROP TABLE IF EXISTS screening_language_proficiency CASCADE;
DROP TABLE IF EXISTS screening_criminal_records CASCADE;
DROP TABLE IF EXISTS screening_background_checks CASCADE;
DROP TABLE IF EXISTS screening_employment_verification CASCADE;
DROP TABLE IF EXISTS screening_education_verification CASCADE;
DROP TABLE IF EXISTS screening_salary_history CASCADE;
DROP TABLE IF EXISTS screening_reference_responses CASCADE;
DROP TABLE IF EXISTS screening_personal_references CASCADE;
DROP TABLE IF EXISTS screening_employer_references CASCADE;
DROP TABLE IF EXISTS screening_sea_service_verification CASCADE;
DROP TABLE IF EXISTS screening_availability CASCADE;
DROP TABLE IF EXISTS screening_documents_checklist CASCADE;
DROP TABLE IF EXISTS screening_general_info CASCADE;

-- Phase 2 tables (documents)
DROP TABLE IF EXISTS cand_document_attachments CASCADE;
DROP TABLE IF EXISTS cand_vaccinations CASCADE;
DROP TABLE IF EXISTS cand_sea_service_external CASCADE;
DROP TABLE IF EXISTS cand_sea_service_internal CASCADE;
DROP TABLE IF EXISTS cand_education CASCADE;
DROP TABLE IF EXISTS cand_training_certificates CASCADE;
DROP TABLE IF EXISTS cand_medical_certificates CASCADE;
DROP TABLE IF EXISTS cand_licenses CASCADE;
DROP TABLE IF EXISTS cand_flag_endorsements CASCADE;
DROP TABLE IF EXISTS cand_stcw_certificates CASCADE;
DROP TABLE IF EXISTS cand_cop CASCADE;
DROP TABLE IF EXISTS cand_coc CASCADE;
DROP TABLE IF EXISTS cand_visas CASCADE;
DROP TABLE IF EXISTS cand_travel_documents CASCADE;

-- Phase 1 tables (core profile)
DROP TABLE IF EXISTS cand_vessel_types_applied CASCADE;
DROP TABLE IF EXISTS cand_next_of_kin CASCADE;
DROP TABLE IF EXISTS cand_children CASCADE;
DROP TABLE IF EXISTS cand_family_info CASCADE;
DROP TABLE IF EXISTS cand_addresses CASCADE;
DROP TABLE IF EXISTS cand_personal_details CASCADE;
DROP TABLE IF EXISTS recruitment_candidates_v2 CASCADE;

-- ============================================================================
-- REVERT recruitment_candidates TABLE CHANGES (from migrations 0062, 0063)
-- ============================================================================

-- Remove unique constraint added in 0062
ALTER TABLE recruitment_candidates DROP CONSTRAINT IF EXISTS recruitment_candidates_rec_can_uuid_key;

-- Remove columns added in 0062
ALTER TABLE recruitment_candidates DROP COLUMN IF EXISTS rec_can_uuid;
ALTER TABLE recruitment_candidates DROP COLUMN IF EXISTS nationality_uuid;
ALTER TABLE recruitment_candidates DROP COLUMN IF EXISTS uploaded_photo;
ALTER TABLE recruitment_candidates DROP COLUMN IF EXISTS created_by_uuid;
ALTER TABLE recruitment_candidates DROP COLUMN IF EXISTS updated_by_uuid;
ALTER TABLE recruitment_candidates DROP COLUMN IF EXISTS is_sync;

-- Note: We cannot easily restore NOT NULL constraints without knowing original defaults
-- The columns that had NOT NULL dropped in 0063 were optional in the original schema anyway
