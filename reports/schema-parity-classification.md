# Migration Schema Parity Proof

## Outcome

The complete numbered migration directory successfully provisioned a disposable PostgreSQL database from empty state:

- Migrations applied: **207**
- Migrations skipped: **0**
- Migration-runner failures: **0**
- Schema objects compared: tables, columns, constraints, indexes, views, enum types, and sequences
- Object-level schema differences: **30**
- Development-only differences requiring a forward migration: **0**
- Development-only obsolete leftovers that should not be reproduced: **30**
- Fresh-only differences showing development is behind: **0**

The migration directory now reproduces all current, migration-relevant development
schema objects. The two genuine gaps identified by the original parity proof are
provided by forward migrations 0205 and 0206. The remaining differences are
obsolete development-only leftovers.

## Classification rules

- **A — Genuine forward-migration gap:** Present in development, absent from fresh, and still represented or used by the current application.
- **B — Obsolete development leftover:** Present in development, absent from fresh, but intentionally excluded from current tenant provisioning.
- **C — Development behind:** Present in fresh, absent from development.

## Complete object-level classification

Every difference from `reports/schema-diff.json` is listed below.

### A — Genuine forward-migration gaps (0)

The original two gaps are now supplied by forward migrations:

- `public.master_data_entries.officerMatrixLabel`
- `public.master_data_entries.idx_master_data_entries_master_id`

The post-fix comparison reports neither object as missing from fresh.

### B — Obsolete development leftovers (30)

#### Drizzle migration bookkeeping (7)

The application migration runner uses `public.schema_migrations`, not Drizzle's private ledger. These objects are tooling residue and should not be added to tenant migrations.

| Object category | Object |
| --- | --- |
| Table | `drizzle.__drizzle_migrations` |
| Column | `drizzle.__drizzle_migrations.created_at` |
| Column | `drizzle.__drizzle_migrations.hash` |
| Column | `drizzle.__drizzle_migrations.id` |
| Constraint | `drizzle.__drizzle_migrations.__drizzle_migrations_pkey` |
| Index | `drizzle.__drizzle_migrations.__drizzle_migrations_pkey` |
| Sequence | `drizzle.__drizzle_migrations_id_seq` |

#### Legacy Phase 2 promotion storage (23)

`PHASE2_DATABASE_MIGRATION.sql` is retained as historical documentation and is intentionally excluded from automatic migration discovery. `migrations/README.md` explicitly identifies its `promotion_forms` changes as obsolete for fresh-tenant provisioning. The active promotions implementation uses the V2 promotion tables instead.

| Object category | Object |
| --- | --- |
| Table | `public.promotion_forms` |
| Column | `public.promotion_forms.appraisal_result_id` |
| Column | `public.promotion_forms.created_at` |
| Column | `public.promotion_forms.crew_member_id` |
| Column | `public.promotion_forms.current_rank` |
| Column | `public.promotion_forms.effective_date` |
| Column | `public.promotion_forms.id` |
| Column | `public.promotion_forms.justification` |
| Column | `public.promotion_forms.proposed_rank` |
| Column | `public.promotion_forms.reviewed_at` |
| Column | `public.promotion_forms.reviewed_by` |
| Column | `public.promotion_forms.reviewer_comments` |
| Column | `public.promotion_forms.status` |
| Column | `public.promotion_forms.submitted_at` |
| Column | `public.promotion_forms.submitted_by` |
| Column | `public.promotion_forms.updated_at` |
| Constraint | `public.promotion_forms.promotion_forms_crew_member_id_crew_members_id_fk` |
| Constraint | `public.promotion_forms.promotion_forms_pkey` |
| Index | `public.promotion_forms.idx_promotion_forms_appraisal_result_id` |
| Index | `public.promotion_forms.idx_promotion_forms_crew_member_id` |
| Index | `public.promotion_forms.idx_promotion_forms_status` |
| Index | `public.promotion_forms.promotion_forms_pkey` |
| Sequence | `public.promotion_forms_id_seq` |

### C — Development behind (0)

No tables, columns, constraints, indexes, views, enum types, or sequences were present in fresh but absent from development.

## Seed-data onboarding checklist

Counts are exact independent `COUNT(*)` results from development and the freshly migrated disposable database. Different counts are onboarding information, not schema defects.

| Table | Development | Fresh | Onboarding status | Guidance |
| --- | ---: | ---: | --- | --- |
| `adm_menumaster_ac` | 81 | 81 | Sufficient baseline | The access-control menu catalogue is available for navigation and grant configuration. |
| `adm_rolemaster_ac` | 51 | 15 | Sufficient baseline | The fresh chain supplies baseline roles; development includes additional historical/client roles. |
| `adm_roleaccess_ac` | 1383 | 225 | Sufficient baseline | Grants exist for the fresh baseline roles; client-specific roles need matching onboarding grants. |
| `master_vessel_types` | 19 | 0 | Populate during onboarding | Add baseline and client-specific vessel types before vessel and crew validation workflows are used. |
| `master_users` | 24 | 0 | Populate during onboarding | Provision tenant users; development users must not be copied as client users. |
| `master_vessels` | 10 | 0 | Populate during onboarding | Add the client's vessel fleet. |
| `adm_forms_v2` | 7 | 5 | Sufficient baseline | The fresh chain supplies all five expected parent form skeletons; configure rank groups, versions, sections, questions, and options during onboarding. |
| `adm_rank_groups_v2` | 49 | 0 | Populate during onboarding | Configure the rank groups that connect forms to eligible ranks. |
| `adm_form_versions_v2` | 44 | 0 | Populate during onboarding | Create or import runnable form versions. |
| `frm_form_parts` | 9 | 9 | Sufficient baseline | Baseline form parts are present. |
| `frm_option_sets` | 22 | 0 | Conditional | Populate when selected forms use reusable option sets. |
| `frm_options` | 84 | 0 | Conditional | Populate option values when selected forms use option sets. |
| `frm_sections` | 13 | 0 | Populate during onboarding | Add the sections required by the selected forms. |
| `frm_questions` | 41 | 0 | Populate during onboarding | Add the questions required by the selected forms. |
| `master_nationalities` | 243 | 0 | Populate during onboarding | Add nationality master data before crew and recruitment validation. |
| `master_data_entries` | 0 | 25 | Sufficient baseline | The migration chain supplies shared baseline lookup values. |

## Safety and reproducibility notes

- Development was queried read-only by the comparator.
- All fresh migration execution targeted a newly created disposable database.
- The post-fix comparison included migrations 0205 and 0206; no development data was populated by the validation run.
- The disposable database was dropped by a shell cleanup trap after each run.
- `server/migrationRunner.ts` and `package.json` were not modified.
- Raw human-readable output: `reports/schema-diff.txt`
- Raw machine-readable output: `reports/schema-diff.json`
- Reproduction command shape:

  `DEV_DATABASE_URL=<development-url> FRESH_DATABASE_URL=<fresh-url> npx tsx scripts/schema-diff.ts --json-out reports/schema-diff.json --text-out reports/schema-diff.txt`

The comparator exits `0` for identical schemas, `1` for differences, and `2` for configuration or execution errors.