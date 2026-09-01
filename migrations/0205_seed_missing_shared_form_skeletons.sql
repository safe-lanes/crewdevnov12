-- Seed the remaining shared configurable-form parent records.
-- This migration runs independently in each tenant database.
--
-- Parent records only: no rank groups, form versions, sections, questions,
-- or options are created here.
--
-- The metadata matches the existing development-tenant records. Name-only
-- idempotence prevents duplicate records if a tenant already has either form
-- from the legacy V1-to-V2 backfill or an earlier onboarding step.

WITH requested_forms (
  name,
  category,
  rank_group,
  version_no,
  version_date,
  configuration,
  shared_config
) AS (
  VALUES
    (
      'Crew Appraisal Form',
      'appraisal',
      'Cadets, Senior Officers Appraisal Form, Junior Officers Appraisal Form, Rating Appraisal Form',
      '02',
      '10-Jul-2026',
      NULL,
      '{"appraisalTypeOptions":["End of Contract","Mid Term","Special","Probation","Appraiser Signing Off"]}'
    ),
    (
      'Promotion Review Form',
      'promotion',
      'Promotion to CCK, Promotion to AB, Promotion to Bosun, Promotion to 3rd Engineer, Promotion to 2nd Officer, Promotion to 2nd Engineer, Promotion to Chief Engineer, Promotion to Chief Officer, Promotion to Master',
      '10',
      '17-Apr-2026',
      NULL,
      NULL
    )
)
INSERT INTO adm_forms_v2 (
  form_uuid,
  name,
  category,
  rank_group,
  version_no,
  version_date,
  configuration,
  shared_config,
  created_by_uuid,
  updated_by_uuid
)
SELECT
  gen_random_uuid()::text,
  requested.name,
  requested.category,
  requested.rank_group,
  requested.version_no,
  requested.version_date,
  requested.configuration,
  requested.shared_config,
  NULL,
  NULL
FROM requested_forms AS requested
WHERE NOT EXISTS (
  SELECT 1
  FROM adm_forms_v2 AS existing
  WHERE existing.name = requested.name
);