-- Migration: 0094_drop_legacy_v1_tables.sql
-- Description: Drop 27 legacy v1 tables that are no longer used by any runtime code.
--              All functionality has been migrated to v2 equivalents (adm_*, v2_* tables).
--              Run `npm run db:backup` before applying this migration to create a full restore point.
--
-- Tables retained (still actively used by runtime routes):
--   company_ranks, forms, id_counters, revisions, users, vessel_planning, vessels

DROP TABLE IF EXISTS appraisal_results CASCADE;
DROP TABLE IF EXISTS available_ranks CASCADE;
DROP TABLE IF EXISTS company_processing CASCADE;
DROP TABLE IF EXISTS company_training_requirements CASCADE;
DROP TABLE IF EXISTS company_trainings CASCADE;
DROP TABLE IF EXISTS company_training_groups CASCADE;
DROP TABLE IF EXISTS drug_alcohol_test_records CASCADE;
DROP TABLE IF EXISTS fixed_tasks CASCADE;
DROP TABLE IF EXISTS form_versions CASCADE;
DROP TABLE IF EXISTS nc_reports CASCADE;
DROP TABLE IF EXISTS office_violation_comments CASCADE;
DROP TABLE IF EXISTS rank_groups CASCADE;
DROP TABLE IF EXISTS recruitment_candidates CASCADE;
DROP TABLE IF EXISTS rest_hours_crew_records CASCADE;
DROP TABLE IF EXISTS rest_hours_daily_records CASCADE;
DROP TABLE IF EXISTS rest_hours_vessel_records CASCADE;
DROP TABLE IF EXISTS seafarers CASCADE;
DROP TABLE IF EXISTS training_master CASCADE;
DROP TABLE IF EXISTS training_matrix_vessel_drafts CASCADE;
DROP TABLE IF EXISTS training_matrix_vessel_revisions CASCADE;
DROP TABLE IF EXISTS variable_tasks CASCADE;
DROP TABLE IF EXISTS vessel_dateline_adjustments CASCADE;
DROP TABLE IF EXISTS vessel_drafts CASCADE;
DROP TABLE IF EXISTS vessel_groups CASCADE;
DROP TABLE IF EXISTS vessel_id_mappings CASCADE;
DROP TABLE IF EXISTS vessel_ranks CASCADE;
DROP TABLE IF EXISTS vessel_revisions CASCADE;
DROP TABLE IF EXISTS vessel_violation_comments CASCADE;
