-- Crewing Test Case Manager — follow-up to 0132.
-- 1) Ensures the area_feature column exists on databases that already ran 0132.
-- 2) Constrains module / priority / category to known values via CHECK.
-- 3) Backfills area_feature for the seeded starter test cases.
-- 4) Registers the "Test Cases" menu in the RBAC menu list and grants access
--    to the admin-tier roles, consistent with other modules.
-- Fully idempotent: safe to re-run and safe per-tenant.

-- 1. Column (no-op on fresh databases that created it in 0132) -----------------
ALTER TABLE test_cases_v2 ADD COLUMN IF NOT EXISTS area_feature TEXT;

-- 2. CHECK constraints --------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_test_cases_v2_module') THEN
    ALTER TABLE test_cases_v2 ADD CONSTRAINT chk_test_cases_v2_module
      CHECK (module IN (
        'Crew Pool','Vessel','Rest Hours','Promotions','Appraisals',
        'Drugs & Alcohol','Recruitment','Rotation','Admin & Masters'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_test_cases_v2_priority') THEN
    ALTER TABLE test_cases_v2 ADD CONSTRAINT chk_test_cases_v2_priority
      CHECK (priority IN ('High','Medium','Low'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_test_cases_v2_category') THEN
    ALTER TABLE test_cases_v2 ADD CONSTRAINT chk_test_cases_v2_category
      CHECK (category IN ('Functional','UAT'));
  END IF;
END $$;

-- 3. Backfill area / feature for the seeded starter test cases ----------------
UPDATE test_cases_v2 t SET area_feature = v.area
FROM (VALUES
  ('seed-cp-001', 'Crew Profiles'),
  ('seed-cp-002', 'Crew Profiles'),
  ('seed-cp-003', 'Crew Search & Filtering'),
  ('seed-cp-004', 'Document Management'),
  ('seed-cp-005', 'Sea Service & Experience'),
  ('seed-cp-006', 'Briefing / De-briefing'),
  ('seed-cp-007', 'Employment Lifecycle'),
  ('seed-ve-001', 'Manning Plan'),
  ('seed-ve-002', 'Sign On / Relievers'),
  ('seed-ve-003', 'Compliance Matrix'),
  ('seed-ve-004', 'Reports & Exports'),
  ('seed-ve-005', 'Reports & Exports'),
  ('seed-rh-001', 'Work/Rest Recording'),
  ('seed-rh-002', 'Non-Conformities'),
  ('seed-rh-003', 'Review & Sign-off'),
  ('seed-rh-004', 'Task Scheduling'),
  ('seed-rh-005', 'Dateline Adjustment'),
  ('seed-pr-001', 'Review Board'),
  ('seed-pr-002', 'Promotion Checklist'),
  ('seed-pr-003', 'Approval Workflow'),
  ('seed-pr-004', 'Criteria Verification'),
  ('seed-ap-001', 'Vessel Appraisal'),
  ('seed-ap-002', 'Competence Assessment'),
  ('seed-ap-003', 'Training Needs'),
  ('seed-ap-004', 'Promotion Recommendation'),
  ('seed-ap-005', 'Office Appraisal'),
  ('seed-da-001', 'Test Records'),
  ('seed-da-002', 'Test Records'),
  ('seed-da-003', 'Testing Schedule'),
  ('seed-da-004', 'Violations & Reports'),
  ('seed-da-005', 'Onboard Verification'),
  ('seed-rc-001', 'Candidate Pipeline'),
  ('seed-rc-002', 'Screening Workflow'),
  ('seed-rc-003', 'Suitability Assessment'),
  ('seed-rc-004', 'Crew Pool Transfer'),
  ('seed-ro-001', 'Planning Drafts'),
  ('seed-ro-002', 'Due Crew Dashboard'),
  ('seed-ro-003', 'Assignment Proposals'),
  ('seed-ro-004', 'Deployment'),
  ('seed-ad-001', 'Form Builder'),
  ('seed-ad-002', 'Rank Hierarchy'),
  ('seed-ad-003', 'Access Control'),
  ('seed-ad-004', 'Master Data')
) AS v(uuid, area)
WHERE t.tc_uuid = v.uuid AND t.area_feature IS NULL;

-- 4. RBAC menu registration ---------------------------------------------------
INSERT INTO adm_menumaster_ac (muid, name, display_name, route, parent_menu, is_active, sort_order)
VALUES (gen_random_uuid(), 'Test Cases', 'Test Cases', '/test-cases', NULL, true, 11)
ON CONFLICT (name) DO NOTHING;

-- Grant full access to the admin-tier roles (others can be configured via the
-- Access Control UI). Guarded so re-runs do not create duplicate rows.
INSERT INTO adm_roleaccess_ac (rauid, canview, cancreate, canedit, candelete, menu_id, role_id, sort_order)
SELECT gen_random_uuid(), true, true, true, true, m.muid, r.ruid, 0
FROM adm_menumaster_ac m
CROSS JOIN adm_rolemaster_ac r
WHERE m.name = 'Test Cases'
  AND r.assigned_role IN ('Admin', 'Sail Admin', 'Super Admin')
  AND NOT EXISTS (
    SELECT 1 FROM adm_roleaccess_ac ra
    WHERE ra.menu_id = m.muid AND ra.role_id = r.ruid
  );
