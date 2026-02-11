-- Migration 0089: Backfill V2 admin tables with data from V1 tables
-- This copies all existing data from V1 tables into V2 tables,
-- generating UUIDs and setting audit columns appropriately.
-- Uses ON CONFLICT DO NOTHING so it is safe to re-run (idempotent).

-- 1. Forms: forms → adm_forms_v2
INSERT INTO adm_forms_v2 (id, form_uuid, name, category, rank_group, version_no, version_date, configuration, shared_config, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  name,
  category,
  rank_group,
  version_no,
  version_date,
  configuration,
  shared_config,
  NOW(),
  NOW(),
  false,
  false
FROM forms
ON CONFLICT (id) DO UPDATE SET
  form_uuid = EXCLUDED.form_uuid,
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  rank_group = EXCLUDED.rank_group,
  version_no = EXCLUDED.version_no,
  version_date = EXCLUDED.version_date,
  configuration = EXCLUDED.configuration,
  shared_config = EXCLUDED.shared_config,
  is_deleted = false,
  updated_at = NOW();

-- Reset sequence for forms
SELECT setval(pg_get_serial_sequence('adm_forms_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_forms_v2), 0) + 1, false);

-- 2. Form Versions: form_versions → adm_form_versions_v2
INSERT INTO adm_form_versions_v2 (id, fv_uuid, form_id, rank_group_id, version_no, version_date, status, configuration, shared_config, released_at, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  form_id,
  rank_group_id,
  version_no,
  version_date,
  status,
  configuration,
  shared_config,
  released_at,
  COALESCE(created_at, NOW()),
  NOW(),
  false,
  false
FROM form_versions
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_form_versions_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_form_versions_v2), 0) + 1, false);

-- 3. Rank Groups: rank_groups → adm_rank_groups_v2
INSERT INTO adm_rank_groups_v2 (id, rg_uuid, form_id, name, ranks, archived_at, configuration, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  form_id,
  name,
  ranks,
  archived_at,
  configuration,
  NOW(),
  NOW(),
  false,
  false
FROM rank_groups
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_rank_groups_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_rank_groups_v2), 0) + 1, false);

-- 4. Available Ranks: available_ranks → adm_available_ranks_v2
INSERT INTO adm_available_ranks_v2 (id, ar_uuid, name, category, rank_id, label, applicable_to_company, is_system_rank, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  name,
  category,
  rank_id,
  label,
  COALESCE(applicable_to_company, false),
  COALESCE(is_system_rank, false),
  COALESCE(sort_order, 0),
  NOW(),
  NOW(),
  false,
  false
FROM available_ranks
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_available_ranks_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_available_ranks_v2), 0) + 1, false);

-- 5. Promotion Hierarchies: promotion_hierarchies → adm_promotion_hierarchies_v2
INSERT INTO adm_promotion_hierarchies_v2 (id, ph_uuid, group_name, rank_path, is_active, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  group_name,
  rank_path,
  COALESCE(is_active, true),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW()),
  false,
  false
FROM promotion_hierarchies
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_promotion_hierarchies_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_promotion_hierarchies_v2), 0) + 1, false);

-- 6. Training Master: training_master → adm_training_master_v2
INSERT INTO adm_training_master_v2 (id, tm_uuid, training_id, training_name, category, training_group, requirement_reference, applicable_to_company, training_label, sort_order, is_default, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  training_id,
  training_name,
  category,
  training_group,
  requirement_reference,
  COALESCE(applicable_to_company, false),
  training_label,
  COALESCE(sort_order, 0),
  COALESCE(is_default, false),
  NOW(),
  NOW(),
  false,
  false
FROM training_master
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_training_master_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_training_master_v2), 0) + 1, false);

-- 7. Company Training Groups: company_training_groups → adm_company_training_groups_v2
INSERT INTO adm_company_training_groups_v2 (ctg_uuid, code, label, display_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  gen_random_uuid()::text,
  code,
  label,
  COALESCE(display_order, 0),
  NOW(),
  NOW(),
  false,
  false
FROM company_training_groups
ON CONFLICT (code) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_company_training_groups_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_company_training_groups_v2), 0) + 1, false);

-- 8. Company Trainings: company_trainings → adm_company_trainings_v2
INSERT INTO adm_company_trainings_v2 (id, ct_uuid, training_master_id, company_id, training_label, abr, requirement, group_code, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  training_master_id,
  company_id,
  training_label,
  abr,
  requirement,
  group_code,
  COALESCE(sort_order, 0),
  NOW(),
  NOW(),
  false,
  false
FROM company_trainings
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_company_trainings_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_company_trainings_v2), 0) + 1, false);

-- 9. Company Training Requirements: company_training_requirements → adm_company_training_requirements_v2
INSERT INTO adm_company_training_requirements_v2 (id, ctr_uuid, company_training_id, rank_id, status, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  company_training_id,
  rank_id,
  status,
  NOW(),
  NOW(),
  false,
  false
FROM company_training_requirements
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_company_training_requirements_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_company_training_requirements_v2), 0) + 1, false);

-- 10. Company Ranks: company_ranks → adm_company_ranks_v2
-- Note: company_ranks uses TEXT id, same as V2
INSERT INTO adm_company_ranks_v2 (id, cr_uuid, rank, rank_id, role, original_rank_id, is_role_row, officer, rating, senior_officer, deck_officer, eng_officer, petty_officer, deck_rating, engine_rating, general_rating, catering_rating, safety_officer, sso, medical_officer, navigating_officer, emt_officer, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  rank,
  rank_id,
  role,
  original_rank_id,
  COALESCE(is_role_row, false),
  COALESCE(officer, false),
  COALESCE(rating, false),
  COALESCE(senior_officer, false),
  COALESCE(deck_officer, false),
  COALESCE(eng_officer, false),
  COALESCE(petty_officer, false),
  COALESCE(deck_rating, false),
  COALESCE(engine_rating, false),
  COALESCE(general_rating, false),
  COALESCE(catering_rating, false),
  COALESCE(safety_officer, false),
  COALESCE(sso, false),
  COALESCE(medical_officer, false),
  COALESCE(navigating_officer, false),
  COALESCE(emt_officer, false),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW()),
  false,
  false
FROM company_ranks
ON CONFLICT (id) DO NOTHING;

-- 11. Vessel Groups: vessel_groups → adm_vessel_groups_v2
INSERT INTO adm_vessel_groups_v2 (id, vg_uuid, name, description, vessel_ids, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  name,
  description,
  vessel_ids,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW()),
  false,
  false
FROM vessel_groups
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_vessel_groups_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_vessel_groups_v2), 0) + 1, false);

-- 12. Vessel Drafts: vessel_drafts → adm_vessel_drafts_v2
INSERT INTO adm_vessel_drafts_v2 (id, vd_uuid, vessel_id, revision, draft_data, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  vessel_id,
  revision,
  draft_data,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW()),
  false,
  false
FROM vessel_drafts
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_vessel_drafts_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_vessel_drafts_v2), 0) + 1, false);

-- 13. Vessel Revisions: vessel_revisions → adm_vessel_revisions_v2
INSERT INTO adm_vessel_revisions_v2 (id, vr_uuid, vessel_id, revision, revision_date, revision_data, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  vessel_id,
  revision,
  revision_date,
  revision_data,
  COALESCE(created_at, NOW()),
  NOW(),
  false,
  false
FROM vessel_revisions
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_vessel_revisions_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_vessel_revisions_v2), 0) + 1, false);

-- 14. Training Matrix Vessel Drafts: training_matrix_vessel_drafts → adm_training_matrix_vessel_drafts_v2
INSERT INTO adm_training_matrix_vessel_drafts_v2 (id, tmvd_uuid, vessel_id, revision, draft_data, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  vessel_id,
  revision,
  draft_data,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW()),
  false,
  false
FROM training_matrix_vessel_drafts
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_training_matrix_vessel_drafts_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_training_matrix_vessel_drafts_v2), 0) + 1, false);

-- 15. Training Matrix Vessel Revisions: training_matrix_vessel_revisions → adm_training_matrix_vessel_revisions_v2
INSERT INTO adm_training_matrix_vessel_revisions_v2 (id, tmvr_uuid, vessel_id, revision, revision_date, revision_data, created_at, updated_at, is_deleted, is_sync)
SELECT
  id,
  gen_random_uuid()::text,
  vessel_id,
  revision,
  revision_date,
  revision_data,
  COALESCE(created_at, NOW()),
  NOW(),
  false,
  false
FROM training_matrix_vessel_revisions
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('adm_training_matrix_vessel_revisions_v2', 'id'), COALESCE((SELECT MAX(id) FROM adm_training_matrix_vessel_revisions_v2), 0) + 1, false);
