# Configurable forms engine: technical handover

**Evidence cut:** pre-document HEAD `216f58deb739787ea254512bff2319e8f857a3be`.  
This is an evidence record, not a design proposal. Database facts below are from
the live development PostgreSQL catalog snapshot taken for this handover; code
facts cite the current source. `UNKNOWN` means the inspected evidence did not
establish the claim.

## 1. Data model

`YES`/`NO` below means nullable. Defaults are database defaults. All timestamps
are `timestamp without time zone`; all UUID-like identifiers are stored as
`text`, not PostgreSQL uuid. `sort_order` and the audit columns are repeated
explicitly in each table where present.

### Administrative tables

| Table (rows) | Complete columns (`name: type, nullable, default`) |
|---|---|
| `adm_forms_v2` (7) | `id: integer, NO, nextval('adm_forms_v2_id_seq'::regclass)`; `form_uuid: text, NO, NULL`; `name: text, NO, NULL`; `category: text, NO, 'appraisal'::text`; `rank_group: text, NO, NULL`; `version_no: text, NO, NULL`; `version_date: text, NO, NULL`; `configuration: text, YES, NULL`; `shared_config: text, YES, NULL`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false`; `is_lock_form: boolean, NO, true` |
| `adm_form_versions_v2` (48) | `id: integer, NO, nextval('adm_form_versions_v2_id_seq'::regclass)`; `fv_uuid: text, NO, NULL`; `form_id: integer, NO, NULL`; `rank_group_id: integer, YES, NULL`; `version_no: text, NO, NULL`; `version_date: text, NO, NULL`; `status: text, NO, 'draft'::text`; `configuration: text, YES, NULL`; `shared_config: text, YES, NULL`; `released_at: timestamp, YES, NULL`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |
| `adm_rank_groups_v2` (51) | `id: integer, NO, nextval('adm_rank_groups_v2_id_seq'::regclass)`; `rg_uuid: text, NO, NULL`; `form_id: integer, NO, NULL`; `name: text, NO, NULL`; `ranks: text, NO, NULL`; `archived_at: timestamp, YES, NULL`; `configuration: text, YES, NULL`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |

Exact catalog constraints: `adm_forms_v2_pkey` PRIMARY KEY `(id)`;
`adm_forms_v2_form_uuid_key` UNIQUE `(form_uuid)`;
`adm_form_versions_v2_pkey` PRIMARY KEY `(id)`;
`adm_form_versions_v2_fv_uuid_key` UNIQUE `(fv_uuid)`;
`adm_rank_groups_v2_pkey` PRIMARY KEY `(id)`;
`adm_rank_groups_v2_rg_uuid_key` UNIQUE `(rg_uuid)`. The live catalog has no
foreign keys and no CHECK constraints on these three tables: delete action is
therefore **N/A**, not UNKNOWN. `adm_form_versions_v2.form_id ->
adm_forms_v2.id` and `adm_rank_groups_v2.form_id -> adm_forms_v2.id` are
application-only relationships. `shared/v2/admin/schema.ts` declares these as
plain integer columns; it does not declare Drizzle foreign-key references.
Deleting a parent is not database-FK protected.

### Form structure tables

| Table (rows) | Complete columns (`name: type, nullable, default`) |
|---|---|
| `frm_form_parts` (9) | `id: integer, NO, nextval('frm_form_parts_id_seq'::regclass)`; `form_part_uuid: text, NO, NULL`; `form_uuid: text, NO, NULL`; `part_code: text, NO, NULL`; `part_title: text, NO, NULL`; `part_type: text, NO, NULL`; `is_office_only: boolean, NO, false`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |
| `frm_sections` (24) | `id: integer, NO, nextval('frm_sections_id_seq'::regclass)`; `section_uuid: text, NO, NULL`; `form_version_uuid: text, NO, NULL`; `form_part_uuid: text, NO, NULL`; `section_code: text, NO, NULL`; `section_title: text, NO, NULL`; `applicable_vessel_types: text, YES, NULL`; `responsible_mode: text, NO, 'not_applicable'::text`; `responsible_role_uuid: text, YES, NULL`; `responsible_department: text, YES, NULL`; `comment_box_required: boolean, NO, false`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false`; `default_option_set_uuid: text, YES, NULL`; `layout_preference: text, NO, 'auto'::text`; `signature_officer_required: boolean, NO, false`; `signature_seafarer_required: boolean, NO, false` |
| `frm_questions` (67) | `id: integer, NO, nextval('frm_questions_id_seq'::regclass)`; `question_uuid: text, NO, NULL`; `section_uuid: text, NO, NULL`; `question_code: text, NO, NULL`; `question_text: text, NO, NULL`; `response_type: text, NO, NULL`; `is_mandatory: boolean, NO, false`; `comment_enabled: boolean, NO, true`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false`; `option_set_uuid: text, YES, NULL` |
| `frm_option_sets` (26) | `id: integer, NO, nextval('frm_option_sets_id_seq'::regclass)`; `option_set_uuid: text, NO, NULL`; `form_version_uuid: text, NO, NULL`; `set_name: text, YES, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false`; `low_end_label: text, YES, NULL`; `high_end_label: text, YES, NULL` |
| `frm_options` (95) | `id: integer, NO, nextval('frm_options_id_seq'::regclass)`; `option_uuid: text, NO, NULL`; `option_set_uuid: text, NO, NULL`; `option_label: text, NO, NULL`; `option_value: text, NO, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |

Exact catalog constraints and FK actions: `frm_form_parts_pkey` PRIMARY KEY
`(id)`; `frm_form_parts_form_part_uuid_key` UNIQUE `(form_part_uuid)`;
`uq_frm_form_parts_form_code` UNIQUE `(form_uuid,part_code)`;
`chk_frm_form_parts_part_type` CHECK `(part_type = ANY
(ARRAY['fixed'::text, 'configurable'::text]))`;
`frm_form_parts_form_uuid_fkey` FOREIGN KEY `(form_uuid) REFERENCES
adm_forms_v2(form_uuid) ON UPDATE CASCADE ON DELETE RESTRICT`.
`frm_sections_pkey` PRIMARY KEY `(id)`; `frm_sections_section_uuid_key` UNIQUE
`(section_uuid)`; `uq_frm_sections_version_part_code` UNIQUE
`(form_version_uuid,form_part_uuid,section_code)`;
`chk_frm_sections_layout_preference` CHECK `(layout_preference = ANY
(ARRAY['auto'::text, 'list'::text, 'matrix'::text]))`;
`chk_frm_sections_responsible_mode` CHECK `(responsible_mode = ANY
(ARRAY['role'::text, 'department'::text, 'not_applicable'::text]))`;
`chk_frm_sections_responsible_target` CHECK `(responsible_mode = 'role'::text
AND responsible_role_uuid IS NOT NULL AND responsible_department IS NULL OR
responsible_mode = 'department'::text AND responsible_role_uuid IS NULL AND
responsible_department IS NOT NULL OR responsible_mode = 'not_applicable'::text
AND responsible_role_uuid IS NULL AND responsible_department IS NULL)`;
`chk_frm_sections_vessel_types_json_array` CHECK `(applicable_vessel_types IS
NULL OR jsonb_typeof(applicable_vessel_types::jsonb) = 'array'::text)`;
`fk_frm_sections_default_option_set` FOREIGN KEY `(default_option_set_uuid)
REFERENCES frm_option_sets(option_set_uuid) ON UPDATE CASCADE ON DELETE RESTRICT`;
`frm_sections_form_part_uuid_fkey` FOREIGN KEY `(form_part_uuid) REFERENCES
frm_form_parts(form_part_uuid) ON UPDATE CASCADE ON DELETE RESTRICT`;
`frm_sections_form_version_uuid_fkey` FOREIGN KEY `(form_version_uuid) REFERENCES
adm_form_versions_v2(fv_uuid) ON UPDATE CASCADE ON DELETE RESTRICT`;
`frm_sections_responsible_role_uuid_fkey` FOREIGN KEY `(responsible_role_uuid)
REFERENCES adm_rolemaster_ac(ruid) ON UPDATE CASCADE ON DELETE RESTRICT`.
`frm_questions_pkey` PRIMARY KEY `(id)`; `frm_questions_question_uuid_key`
UNIQUE `(question_uuid)`; `uq_frm_questions_section_code` UNIQUE
`(section_uuid,question_code)`;
`chk_frm_questions_response_type` CHECK `(response_type = ANY
(ARRAY['yes_no'::text, 'yes_no_na'::text, 'single_select'::text,
'multi_select'::text, 'free_text'::text, 'date'::text, 'number'::text,
'checkbox'::text, 'info_only'::text]))`;
`fk_frm_questions_option_set` FOREIGN KEY `(option_set_uuid) REFERENCES
frm_option_sets(option_set_uuid) ON UPDATE CASCADE ON DELETE RESTRICT`;
`frm_questions_section_uuid_fkey` FOREIGN KEY `(section_uuid) REFERENCES
frm_sections(section_uuid) ON UPDATE CASCADE ON DELETE RESTRICT`.
`frm_option_sets_pkey` PRIMARY KEY `(id)`; `frm_option_sets_option_set_uuid_key`
UNIQUE `(option_set_uuid)`; `frm_option_sets_form_version_uuid_fkey` FOREIGN
KEY `(form_version_uuid) REFERENCES adm_form_versions_v2(fv_uuid) ON UPDATE
CASCADE ON DELETE RESTRICT`.
`frm_options_pkey` PRIMARY KEY `(id)`; `frm_options_option_uuid_key` UNIQUE
`(option_uuid)`; `uq_frm_options_set_value` UNIQUE
`(option_set_uuid,option_value)`; `frm_options_option_set_uuid_fkey` FOREIGN
KEY `(option_set_uuid) REFERENCES frm_option_sets(option_set_uuid) ON UPDATE
CASCADE ON DELETE RESTRICT`.

### Submission and response tables

| Table (rows) | Complete columns (`name: type, nullable, default`) |
|---|---|
| `crew_briefing_submissions` (6) | `id: integer, NO, nextval('crew_briefing_submissions_id_seq'::regclass)`; `briefing_submission_uuid: text, NO, NULL`; `crew_uuid: text, NO, NULL`; `vessel_uuid: text, YES, NULL`; `vessel_type_uuid: text, YES, NULL`; `form_uuid: text, NO, NULL`; `form_version_uuid: text, NO, NULL`; `status: text, NO, 'in_progress'::text`; `completed_at: timestamp, YES, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false`; `briefing_uuid: text, YES, NULL`; `date_of_briefing: date, YES, NULL`; `mode_of_briefing: text, YES, NULL`; `office_review_comments: text, YES, NULL`; `office_reviewed_by_uuid: text, YES, NULL`; `office_reviewed_by_name: text, YES, NULL`; `office_reviewed_at: timestamp, YES, NULL` |
| `crew_interview_submissions` (1) | `id: integer, NO, nextval('crew_interview_submissions_id_seq'::regclass)`; `interview_submission_uuid: text, NO, NULL`; `rec_can_uuid: text, NO, NULL`; `interview_item_uuid: text, YES, NULL`; `form_uuid: text, NO, NULL`; `form_version_uuid: text, NO, NULL`; `status: text, NO, 'in_progress'::text`; `completed_at: timestamp, YES, NULL`; `interview_category: text, YES, NULL`; `interview_stage: text, YES, NULL`; `interviewer_comments: text, YES, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false`; `office_reviewed_by_uuid: text, YES, NULL`; `office_reviewed_by_name: text, YES, NULL`; `office_reviewed_at: timestamp, YES, NULL` |
| `crew_debriefing_submissions` (1) | `id: integer, NO, nextval('crew_debriefing_submissions_id_seq'::regclass)`; `debriefing_submission_uuid: text, NO, NULL`; `crew_uuid: text, NO, NULL`; `debriefing_uuid: text, YES, NULL`; `form_uuid: text, NO, NULL`; `form_version_uuid: text, NO, NULL`; `status: text, NO, 'in_progress'::text`; `completed_at: timestamp, YES, NULL`; `debriefing_date: date, YES, NULL`; `mode_of_debriefing: text, YES, NULL`; `office_review_comments: text, YES, NULL`; `office_reviewed_by_uuid: text, YES, NULL`; `office_reviewed_by_name: text, YES, NULL`; `office_reviewed_at: timestamp, YES, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |
| `frm_section_states` (26) | `id: integer, NO, nextval('frm_section_states_id_seq'::regclass)`; `section_state_uuid: text, NO, NULL`; `submission_uuid: text, NO, NULL`; `section_uuid: text, NO, NULL`; `status: text, NO, 'not_started'::text`; `section_comment: text, YES, NULL`; `submitted_by_uuid: text, YES, NULL`; `submitted_by_name: text, YES, NULL`; `submitted_at: timestamp, YES, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |
| `frm_answers` (17) | `id: integer, NO, nextval('frm_answers_id_seq'::regclass)`; `answer_uuid: text, NO, NULL`; `submission_uuid: text, NO, NULL`; `question_uuid: text, NO, NULL`; `answer_value: text, YES, NULL`; `answer_comment: text, YES, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |
| `frm_signature_attachments` (11) | `id: integer, NO, nextval('frm_signature_attachments_id_seq'::regclass)`; `sig_att_uuid: text, NO, NULL`; `file_name: text, YES, NULL`; `file_type: text, YES, NULL`; `file_size: text, YES, NULL`; `file_path: text, NO, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |
| `frm_section_signatures` (11) | `id: integer, NO, nextval('frm_section_signatures_id_seq'::regclass)`; `section_signature_uuid: text, NO, NULL`; `section_state_uuid: text, NO, NULL`; `signature_type: text, NO, NULL`; `signature_att_uuid: text, NO, NULL`; `signer_name: text, NO, NULL`; `signer_rank: text, YES, NULL`; `signed_at: timestamp, NO, NULL`; `signed_by_uuid: text, NO, NULL`; `signature_method: text, NO, NULL`; `sort_order: integer, NO, 0`; `created_at: timestamp, YES, now()`; `updated_at: timestamp, YES, now()`; `created_by_uuid: text, YES, NULL`; `updated_by_uuid: text, YES, NULL`; `is_deleted: boolean, YES, false`; `is_sync: boolean, YES, false` |

Submission constraints (exact catalog names/definitions): `crew_briefing_submissions`
has `crew_briefing_submissions_pkey` PRIMARY KEY `(id)`,
`crew_briefing_submissions_briefing_submission_uuid_key` UNIQUE
`(briefing_submission_uuid)`, `chk_crew_briefing_submissions_mode` CHECK
`(mode_of_briefing IS NULL OR (mode_of_briefing = ANY
(ARRAY['company_office'::text, 'manning_agent'::text, 'video_call'::text])))`,
and `chk_crew_briefing_submissions_status` CHECK
`(status = ANY (ARRAY['in_progress'::text, 'completed'::text]))`. The live
catalog snapshot has **no UNIQUE constraint on `briefing_uuid`**, despite the
UNIQUE declaration in `shared/v2/forms-engine/schema.ts`; this is schema drift.
Briefing FKs
`briefing_uuid -> crew_briefings(briefing_uuid)`, `form_uuid ->
adm_forms_v2(form_uuid)`, `form_version_uuid -> adm_form_versions_v2(fv_uuid)`,
all RESTRICT. Interview has UNIQUE submission UUID and UNIQUE nullable
`interview_item_uuid`, FKs form/form-version RESTRICT; `interview_item_uuid` is
intentionally not an FK (see `shared/v2/forms-engine/schema.ts:181-210`).
Debriefing has UNIQUE submission UUID and UNIQUE nullable `debriefing_uuid`,
CHECK mode is `company_office|manning_agent|video_call`, FKs debriefing/form/version
all RESTRICT. `frm_section_states` has PK, UNIQUE state UUID, UNIQUE
`(submission_uuid,section_uuid)`, FK section RESTRICT, and status CHECK
`not_started|in_progress|submitted|not_applicable`. `frm_answers` has PK,
UNIQUE answer UUID, UNIQUE `(submission_uuid,question_uuid)`, FK question
RESTRICT. `frm_signature_attachments` has PK and UNIQUE attachment UUID, no
FKs. `frm_section_signatures` has PK, UNIQUE signature UUID, UNIQUE
`(section_state_uuid,signature_type)`, FKs state and attachment RESTRICT, CHECK
type `officer|seafarer`, method `officer|witnessed|authenticated`, and officer/
seafarer identity rules from the live catalog snapshot. Exact remaining names
and definitions are: `crew_interview_submissions_pkey` PRIMARY KEY `(id)`;
`crew_interview_submissions_interview_submission_uuid_key` UNIQUE
`(interview_submission_uuid)`; `crew_interview_submissions_interview_item_uuid_key`
UNIQUE `(interview_item_uuid)`; `crew_interview_submissions_status_check` CHECK
`(status = ANY (ARRAY['in_progress'::text, 'completed'::text]))`;
`crew_debriefing_submissions_pkey` PRIMARY KEY `(id)`;
`crew_debriefing_submissions_debriefing_submission_uuid_key` UNIQUE
`(debriefing_submission_uuid)`; `crew_debriefing_submissions_debriefing_uuid_key`
UNIQUE `(debriefing_uuid)`; `crew_debriefing_submissions_status_check` CHECK
`(status = ANY (ARRAY['in_progress'::text, 'completed'::text]))`;
`crew_debriefing_submissions_mode_of_debriefing_check` CHECK
`(mode_of_debriefing = ANY (ARRAY['company_office'::text, 'manning_agent'::text,
'video_call'::text]))`; `frm_section_states_pkey` PRIMARY KEY `(id)`;
`frm_section_states_section_state_uuid_key` UNIQUE `(section_state_uuid)`;
`uq_frm_section_states_submission_section` UNIQUE `(submission_uuid,section_uuid)`;
`chk_frm_section_states_status` CHECK `(status = ANY
(ARRAY['not_started'::text, 'in_progress'::text, 'submitted'::text,
'not_applicable'::text]))`; `frm_answers_pkey` PRIMARY KEY `(id)`;
`frm_answers_answer_uuid_key` UNIQUE `(answer_uuid)`;
`uq_frm_answers_submission_question` UNIQUE `(submission_uuid,question_uuid)`;
`frm_signature_attachments_pkey` PRIMARY KEY `(id)`;
`frm_signature_attachments_sig_att_uuid_key` UNIQUE `(sig_att_uuid)`;
`frm_section_signatures_pkey` PRIMARY KEY `(id)`;
`frm_section_signatures_section_signature_uuid_key` UNIQUE `(section_signature_uuid)`;
`uq_frm_section_signatures_state_type` UNIQUE `(section_state_uuid,signature_type)`;
`chk_frm_section_signatures_method` CHECK `(signature_method = ANY
(ARRAY['officer'::text, 'witnessed'::text, 'authenticated'::text]))`;
`chk_frm_section_signatures_officer` CHECK `(signature_type <> 'officer'::text
OR signature_method = 'officer'::text AND signer_rank IS NULL)`;
`chk_frm_section_signatures_seafarer` CHECK `(signature_type <> 'seafarer'::text
OR (signature_method = ANY (ARRAY['witnessed'::text, 'authenticated'::text]))
AND btrim(signer_name) <> ''::text AND signer_rank IS NOT NULL AND
btrim(signer_rank) <> ''::text)`; `chk_frm_section_signatures_type` CHECK
`(signature_type = ANY (ARRAY['officer'::text, 'seafarer'::text]))`.
Submission FK catalog names are `crew_briefing_submissions_form_uuid_fkey`,
`crew_briefing_submissions_form_version_uuid_fkey`,
`fk_crew_briefing_submissions_briefing_uuid`,
`crew_interview_submissions_form_uuid_fkey`,
`crew_interview_submissions_form_version_uuid_fkey`,
`crew_debriefing_submissions_form_uuid_fkey`,
`crew_debriefing_submissions_form_version_uuid_fkey`, and
`crew_debriefing_submissions_debriefing_uuid_fkey`; each uses the source and
target columns named above with ON UPDATE CASCADE ON DELETE RESTRICT.
Child FK names are `frm_section_states_section_uuid_fkey`,
`frm_answers_question_uuid_fkey`,
`frm_section_signatures_section_state_uuid_fkey`, and
`frm_section_signatures_signature_att_uuid_fkey`; each is also ON UPDATE
CASCADE ON DELETE RESTRICT.

### Relationship diagram and scope

```text
adm_forms_v2 ──< adm_rank_groups_v2 ──< adm_form_versions_v2 ──< frm_sections ──< frm_questions
      └───────< adm_form_versions_v2 (application form_id; rank_group_id also application-only)
      │                    │                 │                 │
      └──< frm_form_parts ──┘                 └──< frm_section_states ──< frm_section_signatures ──> frm_signature_attachments
                           └──< frm_option_sets ──< frm_options
adm_forms_v2 ──< {crew_briefing_submissions, crew_interview_submissions,
                 crew_debriefing_submissions} ──< frm_section_states/frm_answers
```

**SHARED across all three forms:** `adm_forms_v2`, `adm_form_versions_v2`,
`adm_rank_groups_v2`, `frm_form_parts`, `frm_sections`, `frm_questions`,
`frm_option_sets`, `frm_options`, `frm_section_states`, `frm_answers`,
`frm_section_signatures`, and `frm_signature_attachments`. `frm_section_states`
and `frm_answers` are polymorphic by untyped `submission_uuid` (no FK to a
submission parent). **Per-form:** the three `crew_*_submissions` parent tables.

## 2. The three live forms

| Form | Parent/link column | Version resolution | Part A / Part C |
|---|---|---|---|
| Briefing | G1 `crew_briefings.briefing_uuid` -> `crew_briefing_submissions.briefing_uuid` (nullable; live DB has no UNIQUE constraint despite the Drizzle declaration—schema drift) | `resolveBriefingCreationTarget` in `server/v2/briefings/service.ts:31-73`; rank is G1 `joiningRank`, then `formsService.getFormForRank(rank,"briefing")` | A reads crew/G1/vessel context and stores `date_of_briefing`, `mode_of_briefing`; C stores `office_review_comments`, reviewer UUID/name/time |
| Interview | B6 item `screening_b6_interview_items.int_uuid` -> unique nullable `interview_item_uuid`; candidate is `rec_can_uuid` | `resolveInterviewCreationTarget` in `server/v2/interviews/service.ts:47-53`; rank is candidate `rankAppliedFor`, through `formsService.getFormForRank(rank,"interview")` | A reads candidate/B6 context and stores `interview_category`, `interview_stage`; C stores `interviewer_comments` and review audit |
| Debriefing | G2 `crew_debriefings.debriefing_uuid` -> unique nullable `debriefing_uuid` | `resolveDebriefingCreationTarget` in `server/v2/debriefings/service.ts:41-98`; rank is G2 `rankServed`; it queries actual `adm_rank_groups_v2.ranks`, literal then base rank, released versions | A reads crew/G2/vessel context and stores `debriefing_date`, `mode_of_debriefing`; C stores `office_review_comments` and review audit |

All three pin `form_uuid` and `form_version_uuid` at creation and create section
states for the pinned structure. Routes are mounted in `server/routes.ts:124-127`.
Briefing routes/controller/service are `server/v2/briefings/routes.ts`,
`controller.ts`, `service.ts`; Interview equivalents are
`server/v2/interviews/*`; Debriefing equivalents are
`server/v2/debriefings/*`. Fixed parts are registered in
`client/src/fixedPartRegistrations.ts`, imported by `client/src/main.tsx`.
The fixed modules are `client/src/modules/crew-pool/components/BriefingFixedParts.tsx`,
`DebriefingFixedParts.tsx`, and
`client/src/modules/recruitment/components/InterviewFixedParts.tsx`.
UI entry points are `CrewInfoForm_v2.tsx:421-468` and `:8869-8874` for Briefing
and Debriefing, and `RecruitmentApplicationForm_v2.tsx:188,9431` for Interview;
hosts are the three `*LiveSubmissionHost.tsx` files in those component
directories. Approximate lines are based on current files.

### Part A resolution and storage

* **Briefing:** `briefingService.read` (`server/v2/briefings/service.ts:238-403`)
  calls `briefingRepository.g1(submission.briefingUuid)`, resolves crew with
  `crewMembersService.getByUuid`, nationality through `masterNationalities`, and
  vessel name from G1 or `masterVessels`. It returns crew
  first/middle/family as `seafarer_name`, G1 `joiningRank` as `rank`, nationality,
  vessel, formatted G1 `dateSignOn`, and submission
  `dateOfBriefing`/`modeOfBriefing`. `savePartA` writes the latter two columns
  in `crew_briefing_submissions`.
* **Interview:** `interviewService.read` (`server/v2/interviews/service.ts:111-153`)
  calls `interviewRepository.item(submission.interviewItemUuid)`, reads the B6
  candidate and item, resolves candidate name/nationality, B6 `rankAppliedFor`
  and `interviewDate`, and resolves B6 `interviewerUuid` with
  `resolveInterviewInterviewerName` (UUID match before display-name fallback).
  `interviewCategory` and `interviewStage` are submission columns written by
  `interviewService.savePartA`.
* **Debriefing:** `debriefingService.read`
  (`server/v2/debriefings/service.ts:264-433`) calls
  `debriefingRepository.g1(submission.debriefingUuid)`, resolves crew,
  nationality and vessel, and returns G2 `rankServed`, `dateSignOn`,
  `dateSignedOff`, and `reasonForSignOff`. `debriefingDate` and
  `modeOfDebriefing` are submission columns written by
  `debriefingService.savePartA`.

Part A context is source-derived and is not copied into generic answers. Part C
is per-form parent storage: Briefing/Debriefing `office_review_comments` plus
review audit columns, and Interview `interviewer_comments` plus review audit.

## 3. The renderer

`ConfiguredFormRenderer` is exported from
`client/src/components/configured-form/ConfiguredFormRenderer.tsx`. Props
(`:145-164`) are: `mode: "preview"|"live"`; optional `formTitle`; required
`parts: ConfiguredFormPart[]`, `structures: Record<string,ConfiguredFormSection[]>`;
optional `roles`, `departments`, `vesselTypes`, selected-vessel UUID and callback,
`onBack`, `embedded`, selected part UUID and callback, expanded sections and
callback, `live?: ConfiguredFormLiveProps`, `fixedParts?: Record<string,ReactNode>`,
and `className`. The part/question/section/role/department/vessel and signature
types are declared at `:34-120`. The complete live contract includes
`answers: Record<string,ConfiguredFormAnswerValue>`,
`onAnswerChange`, optional `answerComments`/`onAnswerCommentChange`,
`sectionComments`/`onSectionCommentChange`, `sectionOwnership` with
`{ownerLabel,canEdit}`, `signatureDefaults`, `onSaveDraft`,
`onSubmitSection`, `onSignatureChange`, `onDeleteSignature`, `isLocked`, and
`onSubmit`. Its exact types are:

```ts
type ConfiguredFormAnswerValue = string | string[] | boolean;
type ConfiguredSignatureType = "officer" | "seafarer";
interface ConfiguredFormLiveProps {
  answers: Record<string, ConfiguredFormAnswerValue>;
  onAnswerChange: (questionId: string, value: ConfiguredFormAnswerValue) => void;
  answerComments?: Record<string, string | null>;
  onAnswerCommentChange?: (questionId: string, comment: string) => void;
  sectionComments?: Record<string, string>;
  onSectionCommentChange?: (sectionId: string, comment: string) => void;
  sectionOwnership?: Record<string, { ownerLabel: string; canEdit: boolean }>;
  sectionStates?: Record<string, {
    status: "not_started" | "submitted" | "not_applicable";
    sectionComment?: string | null; submittedByName?: string | null;
    submittedAt?: string | null;
    signatures?: Partial<Record<ConfiguredSignatureType, ConfiguredSignature>>;
    signatureAttUuid?: string | null; signatureName?: string | null;
    signedAt?: string | null; signatureUrl?: string | null;
  }>;
  signatureDefaults?: Partial<Record<ConfiguredSignatureType,
    { name?: string | null; rank?: string | null }>>;
  onSaveDraft?: (sectionId: string) => void | Promise<void>;
  onSubmitSection?: (sectionId: string, comment: string) => void | Promise<void>;
  onSignatureChange?: (sectionId: string, type: ConfiguredSignatureType,
    pngDataUrl: string, signerName?: string, signerRank?: string) =>
    void | Promise<void>;
  onDeleteSignature?: (sectionId: string, type: ConfiguredSignatureType) =>
    void | Promise<void>;
  isLocked?: boolean; onSubmit?: () => void | Promise<void>;
}
```

The surrounding complete contract is `ConfiguredFormPart`,
`ConfiguredFormOption`, `ConfiguredFormQuestion`, `ConfiguredFormSection`,
`ConfiguredFormRole`, `ConfiguredFormDepartment`, `ConfiguredFormVesselType`,
`ConfiguredSignature`, and `ConfiguredFormRendererProps` at
`ConfiguredFormRenderer.tsx:34-164`. Notably the client section-state type omits
DB `in_progress`; DB allows `not_started|in_progress|submitted|not_applicable`.
For completeness, the non-live declarations are:

```ts
interface ConfiguredFormRole {
  ruid: string; assignedRole?: string; name?: string; roleName?: string;
  isActive?: boolean; isDeleted?: boolean;
}
type ConfiguredFormDepartment = string | {
  uuid?: string; departmentUuid?: string; name?: string; departmentName?: string;
};
interface ConfiguredFormVesselType {
  vtUuid?: string; vtuid?: string; name?: string; vesselType?: string; label?: string;
}
interface ConfiguredSignature {
  signatureAttUuid?: string|null; signatureName?: string|null;
  signatureRank?: string|null; witnessedByName?: string|null;
  signedAt?: string|null; signatureUrl?: string|null;
}
interface ConfiguredFormRendererProps {
  mode: ConfiguredFormMode; formTitle?: string; parts: ConfiguredFormPart[];
  structures: Record<string, ConfiguredFormSection[]>;
  roles?: ConfiguredFormRole[]; departments?: ConfiguredFormDepartment[];
  vesselTypes?: ConfiguredFormVesselType[]; selectedVesselTypeUuid?: string;
  onSelectedVesselTypeUuidChange?: (value: string) => void;
  onBack?: () => void; embedded?: boolean; selectedPartUuid?: string;
  onSelectedPartUuidChange?: (value: string) => void;
  expandedSections?: Record<string, boolean>;
  onExpandedSectionsChange?: (value: Record<string, boolean>) => void;
  live?: ConfiguredFormLiveProps;
  fixedParts?: Record<string, React.ReactNode>; className?: string;
}
```

Preview owns ephemeral answers (`ConfiguredFormRenderer.tsx:1085-1092`) and
does not persist them; live consumes supplied answers/callbacks and renders
state, save, submit, ownership, lock, and signature controls. Fixed content is
looked up by normalized part code in `fixedPartContent`/`FixedPartRenderer`
(`:983-1000`); configurable content is dispatched to the configured section
renderer. The registry is a case-insensitive `Map` in
`fixedPartRegistry.ts:11-28`, with `registerFixedParts(category,factory)` and
`getFixedParts(category,context)`. Registration is triggered by the imports in
`client/src/main.tsx`; editor preview calls `getFixedParts` at
`GenericFormEditor.tsx:710` and live hosts provide runtime nodes.

Sections are grouped by `part.formPartUuid`: renderer grouping/part selection is
`:1100-1109` and `:1155-1197`; each part's sections are rendered in sort order.
The exact matrix rule (server `resolveEffectiveLayout`, service
`:130-150`, mirrored by editor `:267-280`) is: explicit `list` => list; no
questions, any non-`single_select`/`multi_select`, missing option set, or mixed
set UUIDs => list; set must exist and contain 1–12 options; 1–6 => matrix;
7–12 => matrix only if every option label has at most four characters; otherwise
list. `effectiveLayout` then selects matrix versus `FormTable` (`renderer
:945-955`). Explicit `matrix` does not override ineligible content.

## 4. Rules enforced server-side

| Rule | Evidence (file/function) |
|---|---|
| Pin version at creation | `resolveBriefingCreationTarget`, `resolveInterviewCreationTarget`, `resolveDebriefingCreationTarget`; each create inserts both form UUID and version UUID. |
| Read pinned version | Each `read` loads `submission.formVersionUuid` through its repository `structure`; form parts come from `submission.formUuid`. |
| Released immutability | `formStructureService.replaceStructure` and repository `replaceTree` reject status other than `draft`; `formsService.releaseVersion` only releases drafts. |
| Ownership | `assertOwner` in each service: admin bypass; `not_applicable` bypass; department compares normalized user department; role uses `resolveRequestRole`; otherwise 403. |
| Submitted-section freeze | `lockWritableSection` locks parent and state with `FOR UPDATE` and rejects `submitted` or `not_applicable`; `writable` helpers repeat this guard. |
| Mandatory answers | `isMandatory*AnswerPresent` treats `info_only` as present, requires nonblank values, and requires a nonempty JSON array for multi-select; submit rechecks transactionally (Interview evidence `service.ts:213-220`; analogous Briefing/Debriefing). |
| Signatures | Submit computes officer/seafarer requirements from section flags and requires each signature type. Route/service accepts PNG data URLs, validates size/MIME, and stores attachment plus signature. DB checks enforce identity/method rules. |
| Vessel applicability | `isBriefingSectionApplicable` and `isDebriefingSectionApplicable`: empty JSON list is universal; constrained list requires known matching vessel type; malformed JSON errors. Interview sections are all applicable because candidates have no vessel assignment (Interview `service.ts:105-106`). |
| Completion | `briefingService.submit` (`server/v2/briefings/service.ts:608-667`) transactionally updates the section to `submitted`, then marks `crew_briefing_submissions.status` `completed` and sets `completed_at` when every active state is `submitted` **or** `not_applicable`. Debriefing uses the same `submitted`-or-`not_applicable` rule; Interview requires every state to be exactly `submitted` (its `not_applicable` state does not complete the parent). |
| Read authorization | `authorizeBriefingRead`, `authorizeInterviewRead`, `authorizeDebriefingRead`: authenticated JWT user must be an office user and match the master user `userType`; all read/raw-signature paths call it. |
| Admin permissions | `server/v2/admin/routes.ts`: Forms view/edit/create/delete guards protect form/version/structure/rank-group routes; structure GET is `Forms:view`, PUT/release is `Forms:edit`. The unguarded `GET /form-versions/:versionId/configuration` is present at line 39. |

## 5. Structure and live APIs

### Authoritative exhaustive endpoint inventory

The following individual rows are the authoritative inventory. Response
shapes are controller JSON unless stated. Admin request bodies are the
controller's validated form/version/rank-group objects; where a controller
does not define a narrower DTO, this is explicitly marked UNKNOWN.

#### Admin forms, versions, structure and option-set-related routes

| Method/path | Permission | Request | Response |
|---|---|---|---|
| GET `/api/v2/admin/forms` | Forms:view | none | 200 form array; 500 `{error}` |
| GET `/api/v2/admin/forms/for-rank/:rankLabel` | no route permission | `rankLabel` path, optional `category` query | 200 resolved form/version; 404 `{error}`; 500 `{error}` |
| POST `/api/v2/admin/forms/cleanup-duplicates` | Forms:delete | **no body** | 200 cleanup result; 500 `{error}` |
| GET `/api/v2/admin/forms/:id` | Forms:view | integer `id` path | 200 form; 400/404/500 `{error}` |
| GET `/api/v2/admin/forms/:id/parts` | Forms:view | integer `id` path | 200 ordered part array; 400/404/500 `{error}` |
| POST `/api/v2/admin/forms` | Forms:create | `insertAdmFormV2Schema` minus `formUuid`, plus optional `auditUserUuid` | 200 created form; 400 `{error,details}`; 500 `{error}` |
| PUT `/api/v2/admin/forms/:id` | Forms:edit | partial `insertAdmFormV2Schema` minus `formUuid`, plus optional `auditUserUuid` | 200 updated form; 400/404/500 `{error}` |
| PATCH `/api/v2/admin/forms/:id` | Forms:edit | `{isLockForm:boolean}`, optional `auditUserUuid` | 200 updated form; 400/404/500 `{error}` |
| DELETE `/api/v2/admin/forms/:id` | Forms:delete | integer `id` path; no body | 200 `{success:true}`; 400/404/500 `{error}` |
| GET `/api/v2/admin/forms/:id/versions` | Forms:view | integer `id` path, optional integer `rankGroupId` query | 200 version array; 400/404/500 `{error}` |
| POST `/api/v2/admin/forms/:id/versions` | Forms:create | `insertAdmFormVersionV2Schema` minus `fvUuid,formId`, plus optional `auditUserUuid` | 200 created version; 400/409/500 `{error}` |
| GET `/api/v2/admin/form-versions/:versionId/configuration` | **unguarded** | integer `versionId` path | 200 configuration; 400/404/500 `{error}` (security limitation) |
| GET `/api/v2/admin/form-versions/:id` | Forms:view | integer `id` path | 200 version; 400/404/500 `{error}` |
| PUT `/api/v2/admin/form-versions/:id` | Forms:edit | partial `insertAdmFormVersionV2Schema` minus `fvUuid`, plus optional `auditUserUuid` | 200 version; 400/404/500 `{error}` |
| POST `/api/v2/admin/form-versions/:id/release` | Forms:edit | no required body; optional `auditUserUuid` | 200 released version; 400/404/500 `{error}` |
| DELETE `/api/v2/admin/form-versions/:id` | Forms:delete | integer `id` path; no body | 200 `{success:true}`; 400/404/500 `{error}` |
| GET `/api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` | Forms:view | UUID paths | 200 `{form_version_uuid,form_part_uuid,option_sets[],sections[]}` nested; 400 `{error:"Invalid form version or form part UUID",details}`; 404 `{error}`; 500 `{error}` |
| PUT `/api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` | Forms:edit | `formStructureInputSchema` `{option_sets[],sections[]}` | 200 structure tree; 400 `{error,details}`; 404 `{error}`; 409 `{error}`; 500 `{error}` |
| PUT `/api/v2/admin/form-versions/:fvUuid/structures` | Forms:edit | `{parts:[{form_part_uuid,structure:{option_sets[],sections[]}}]}` | 200 `{form_version_uuid,parts:[tree]}`; 400 `{error,details}`; 404 `{error}`; 409 `{error}`; 500 `{error}` |

Option sets have no standalone endpoint: create/update/delete is embedded in
the two structure PUT payloads (`option_sets[]`, with `options[]`). This is the
complete option-set route inventory.

#### Admin rank-group routes

| Method/path | Permission | Request | Response |
|---|---|---|---|
| GET `/api/v2/admin/rank-groups` | Forms:view | optional `includeArchived` query is read as `query.includeArchived !== "false"` but the computed value is not passed to `rankGroupsService.getAll()`, so it currently has no effect | 200 group array; 500 `{error}` |
| GET `/api/v2/admin/rank-groups/check-assignment` | Forms:view | `rank`, `formName` query | 200 assignment result; 400/500 `{error}` |
| GET `/api/v2/admin/rank-groups/form/:formId` | Forms:view | integer `formId`, optional `includeArchived` query (only literal `"false"` is special; not boolean-validated) | 200 group array; a nonexistent form is not validated and therefore returns an empty array; 400/500 `{error}` |
| GET `/api/v2/admin/rank-groups/form/:formId/rank-conflicts` | Forms:view | integer `formId`, optional integer `excludeGroupId` query | 200 conflicts; 404 `{error}` when form is absent; 400/500 `{error}` |
| GET `/api/v2/admin/rank-groups/:id/copy-sources` | Forms:view | integer `id` | 200 copy-source versions; 400/404/500 `{error}` |
| POST `/api/v2/admin/rank-groups/:id/copy-configuration` | Forms:create | `{sourceFormVersionUuid:UUID,confirmReplace?:boolean=false}` | 200 copy counts/result; 400/409/500 `{error}` |
| GET `/api/v2/admin/rank-groups/:id` | Forms:view | integer `id` | 200 group; 400/404/500 `{error}` |
| POST `/api/v2/admin/rank-groups` | Forms:create | rank-group insert schema fields `formId,name,ranks`, optional audit fields | 200 group; 400 `{error}` |
| PUT `/api/v2/admin/rank-groups/:id` | Forms:edit | partial rank-group update schema, optional audit fields | 200 group; 400/404/500 `{error}` |
| PUT `/api/v2/admin/rank-groups/:id/configuration` | Forms:edit | `{configuration:any}` | 200 configuration; 400/404/500 `{error}` |
| POST `/api/v2/admin/rank-groups/:id/release-configuration` | Forms:edit | `{configuration:any}`, optional `auditUserUuid` | 200 released configuration/version; 400/404/500 `{error}` |
| POST `/api/v2/admin/rank-groups/:id/archive` | Forms:delete | integer `id`; optional `{auditUserUuid?:string|null}` | 200 archived group; 400/404/500 `{error}` |
| POST `/api/v2/admin/rank-groups/:id/unarchive` | Forms:edit | integer `id`; optional `{auditUserUuid?:string|null}` | 200 unarchived group; 400/404/500 `{error}` |
| DELETE `/api/v2/admin/rank-groups/:id` | Forms:delete | integer `id`; no body | 200 `{success:true}`; 400/404/500 `{error}` |

#### Briefing endpoints (`server/v2/briefings/routes.ts`)

| Method/path | Permission | Request | Response |
|---|---|---|---|
| GET `/api/v2/briefings/resolve-creation` | **unguarded; no Request/auth call in `briefingService.resolveCreation`** | `briefingUuid` query | 200 resolved form/version/id/rank/group; service errors `{error}` |
| POST `/api/v2/briefings/submissions` | authenticated | `{briefingUuid}` | 201: submission UUID, parent, pinned form/version/id, rank/group/status |
| GET `/api/v2/briefings/submissions/crew/:crewUuid` | office read (`authorizeBriefingRead`) | crew UUID | 200 submission list |
| GET `/api/v2/briefings/submissions/:uuid` | office read (`authorizeBriefingRead`) | submission UUID | 200 submission, A/C, parts, structure, states, answers, signatures |
| PUT `/api/v2/briefings/submissions/:uuid/part-a` | authenticated (no office read; writable lock) | `{dateOfBriefing,modeOfBriefing}` | 200 saved A fields |
| PUT `/api/v2/briefings/submissions/:uuid/part-c` | office read (`authorizeBriefingRead`) | `{officeReviewComments}` | 200 review fields/audit |
| PUT `/api/v2/briefings/submissions/:uuid/sections/:sectionUuid/answers` | owner only (`assertOwner`; no `authorizeBriefingRead`) | `{answers,sectionComment?}` | 204 empty |
| POST `/api/v2/briefings/submissions/:uuid/sections/:sectionUuid/signature` | office read then owner | `{type,data,signerName?,signerRank?}` | 201 `{sig_att_uuid}` |
| DELETE `/api/v2/briefings/submissions/:uuid/sections/:sectionUuid/signature/:type` | office read then owner | type officer/seafarer | 204 empty |
| POST `/api/v2/briefings/submissions/:uuid/sections/:sectionUuid/submit` | owner only (`assertOwner`) | `{comment?}` | 200 `{missing_questions:[]}`; completion may update parent |
| GET `/api/v2/briefings/signatures/:sigAttUuid/raw` | office read (`authorizeBriefingRead`) | attachment UUID | 200 streamed attachment |

#### Interview endpoints (`server/v2/interviews/routes.ts`)

| Method/path | Permission | Request | Response |
|---|---|---|---|
| GET `/api/v2/interviews/resolve-creation` | office read (`authorizeInterviewRead`) | `interviewItemUuid` query | 200 resolved form/version/id/rank/group |
| POST `/api/v2/interviews/submissions` | office read | `{interviewItemUuid}` | 201: submission UUID, item, candidate, pinned form/version/id, rank/group/status |
| GET `/api/v2/interviews/submissions/candidate/:recCanUuid` | office read | candidate UUID | 200 submission list |
| GET `/api/v2/interviews/submissions/:uuid` | office read | submission UUID | 200 submission, A/C, parts, structure, states, answers, signatures |
| PUT `/api/v2/interviews/submissions/:uuid/part-a` | office read | `{interviewCategory,interviewStage}` | 200 saved A fields |
| PUT `/api/v2/interviews/submissions/:uuid/part-c` | office read | `{interviewerComments}` | 200 review fields/audit |
| PUT `/api/v2/interviews/submissions/:uuid/sections/:sectionUuid/answers` | office read then owner | `{answers,sectionComment?}` | 204 empty |
| POST `/api/v2/interviews/submissions/:uuid/sections/:sectionUuid/signature` | office read then owner | `{type,data,signerName?,signerRank?}` | 201 `{sig_att_uuid}` |
| DELETE `/api/v2/interviews/submissions/:uuid/sections/:sectionUuid/signature/:type` | office read then owner | type officer/seafarer | 204 empty |
| POST `/api/v2/interviews/submissions/:uuid/sections/:sectionUuid/submit` | office read then owner | `{comment?}` | 204 empty |
| GET `/api/v2/interviews/signatures/:sigAttUuid/raw` | office read | attachment UUID | 200 streamed attachment |

#### Debriefing endpoints (`server/v2/debriefings/routes.ts`)

| Method/path | Permission | Request | Response |
|---|---|---|---|
| GET `/api/v2/debriefings/resolve-creation` | office read (`authorizeDebriefingRead`) | `debriefingUuid` query | 200 resolved form/version/id/rank/group |
| POST `/api/v2/debriefings/submissions` | office read | `{debriefingUuid}` | 201: submission UUID, parent, pinned form/version/id, rank/group/status |
| GET `/api/v2/debriefings/submissions/crew/:crewUuid` | office read (`authorizeDebriefingRead`) | crew UUID | 200 submission list |
| GET `/api/v2/debriefings/submissions/:uuid` | office read (`authorizeDebriefingRead`) | submission UUID | 200 submission, A/C, parts, structure, states, answers, signatures |
| PUT `/api/v2/debriefings/submissions/:uuid/part-a` | office read | `{debriefingDate,modeOfDebriefing}` | 200 saved A fields |
| PUT `/api/v2/debriefings/submissions/:uuid/part-c` | office read | `{officeReviewComments}` | 200 review fields/audit |
| PUT `/api/v2/debriefings/submissions/:uuid/sections/:sectionUuid/answers` | office read then owner | `{answers,sectionComment?}` | 204 empty |
| POST `/api/v2/debriefings/submissions/:uuid/sections/:sectionUuid/signature` | office read then owner | `{type,data,signerName?,signerRank?}` | 201 `{sig_att_uuid}` |
| DELETE `/api/v2/debriefings/submissions/:uuid/sections/:sectionUuid/signature/:type` | office read then owner | type officer/seafarer | 204 empty |
| POST `/api/v2/debriefings/submissions/:uuid/sections/:sectionUuid/submit` | office read then owner | `{comment?}` | 200 `{missing_questions:[]}`; completion may update parent |
| GET `/api/v2/debriefings/signatures/:sigAttUuid/raw` | office read (`authorizeDebriefingRead`) | attachment UUID | 200 streamed attachment |

Controllers confirm answer saves are 204 for all three
(`server/v2/{briefings,interviews,debriefings}/controller.ts`); Interview submit
is 204, while Briefing and Debriefing submit return service JSON. Error
responses are `{error}` with service status (400/403/404/409) or 500.

### Live-route validation contract (exact `routes.ts` schemas)

All three route modules use `z.string().uuid()` for every UUID query/path
parameter; the `:type` parameter is exactly `"officer"|"seafarer"`. Invalid
parameters return 400 `{error:"Invalid route parameters",details}` and invalid
bodies/queries return 400 `{error:"Invalid request",details}` or
`{error:"Invalid query",details}`. Bodies are strict (unknown keys rejected).
Briefing and Debriefing `create` and resolve bodies are exactly one required
UUID (`briefingUuid` or `debriefingUuid`). Their Part A bodies are exactly
`{dateOfBriefing: ISO date string|null, modeOfBriefing:
"company_office"|"manning_agent"|"video_call"|null}` and
`{debriefingDate: ISO date string|null, modeOfDebriefing:
"company_office"|"manning_agent"|"video_call"|null}`. Their Part C bodies are
exactly `{officeReviewComments: string|null}` with max length 10,000.

For Briefing/Debriefing answer saves, `answers` is required and is either an
array of at most 500 `{questionUuid:UUID,value:string(max 10,000)|string[]
(each max 500, array max 100)|boolean|null,comment?:string(max 10,000)|null}`
items, or a UUID-keyed record whose values are
`{value:<same union>,comment?:string(max 10,000)|null}`. The optional
`sectionComment` is string max 10,000 or null. Signature bodies require
`{type:"officer"|"seafarer",data:string(max 7,000,000),signerName?:trimmed
string min 1 max 500,signerRank?:trimmed string min 1 max 500}`; seafarer
requires both signer fields. Submit bodies are exactly
`{comment?:string(max 10,000)|null}`. Interview create requires
`{interviewItemUuid:UUID}`; its Part A is exactly
`{interviewCategory:string(max 500)|null,interviewStage:string(max 500)|null}`,
Part C is `{interviewerComments:string(max 10,000)|null}`, and its answer
body is `{answers:array(max 500)}` where each item is
`{questionUuid:UUID,value:string(max 10,000)|string[](each max 500,array max
100)|boolean|null,comment?:string(max 10,000)|null}` plus optional
`sectionComment:string(max 10,000)|null`. Its signature and submit schemas
are identical to Briefing/Debriefing.

## 6. `copyFormVersionStructure`

Signature: `copyFormVersionStructure(sourceFormVersionUuid: string,
targetFormVersionUuid: string, executor?: any)` in
`server/v2/admin/services/formStructureService.ts:31-37`; service method
`:423-429` delegates to `formStructureRepository.copyStructure`.

`copyStructure` (`formStructureRepository.ts:367-507`) requires both versions,
source status draft/released, target status exactly draft, and equal `formId`
before inserting anything. It copies option sets, options, sections, and
questions. Every copied option set, option, section, and question gets a fresh
UUID. Maps remap option `option_set_uuid`, section `default_option_set_uuid`,
and question `option_set_uuid`; order, labels, values, response metadata,
responsibility, applicability, signatures flags, and layout are preserved.
Missing section maps throw; missing section and question option-set maps become
`null`. Return value is
`{sections:number,questions:number,options:number}` (option-set count is not
returned). It is transactional unless an executor is supplied.

Callers are exactly `server/v2/admin/services/formsService.ts:338` when making
a draft from the latest released version, `server/v2/admin/services/rankGroupsService.ts:218`
after copy confirmation, and `rankGroupsService.ts:281` when a rank-group draft
is created from its latest release. There is no
`rankGroupsService.ts:423-428` caller.

The return value is exactly `{sections, questions, options}`; copied option-set
count is not part of `copyStructure`'s return (rank-group copy separately
obtains it with `getStructureSummary`). A missing mapped section throws
`Missing copied section for question ...`. If a source question or section has
no option-set mapping, the repository writes the destination reference as
`null` via `map.get(...) ?? null`. Distinctly, if an option's active source
option set has no mapped copied set, copying that option throws
`Missing copied option set for option ...`.

## 7. The builder

The builder is `client/src/components/GenericFormEditor.tsx`, reached when the
admin Forms configuration screen renders `GenericFormEditor` with `form`,
rank-group, parts, `onClose`, and `onSave` props; no public route renders it
directly. It loads `/api/v2/admin/forms/:id/parts`, rank groups, versions,
roles, departments, and vessel types (`:601-671`). Every part is navigable;
only `partType === "configurable"` receives an editable tree. Multiple
configurable parts use `trees[formPartUuid]` and `optionSets[formPartUuid]`;
fixed parts use the registry.

Option sets support named/unnamed sets, cloning, reorder, option add/remove,
stable option values, low/high endpoint labels, and per-question overrides.
Section defaults are inherited unless a question has an explicit set. The
numeric generator `buildNumericScaleOptions` (`:240-264`) accepts integer start
and end, rejects nonintegers, descending/equal ranges, creates every inclusive
numeric option, and stores trimmed endpoint labels. `resolveDraftEffectiveLayout`
mirrors the server rule. New sections/questions are generated with
`emptySection`, `emptyQuestion`, and codes are renumbered by
`renumberSections`.

Save serializes `toPayload` (`:421-464`) and calls the structure PUT. Release
controls at approximately `:1659-1683` save/reload then invoke the admin release
endpoint; only drafts can be edited/released. Copying rank-group configuration
is POST `/api/v2/admin/rank-groups/:id/copy-configuration` with Forms:create.
The service accepts a source selection and `confirmReplace`; nonempty targets
without confirmation return 409 `{reason:"confirmation_required",discarded,
targetVersionUuid}`. With confirmation it deletes target structure, copies into
a draft with fresh IDs, and returns target/source metadata,
`sourceCounts`, `copied:{sections,questions,options,optionSets}`, and
`discarded`. It never copies submission answers.

## 8. What is hardcoded

* `migrations/0198_seed_shared_configurable_forms.sql:12-83` seeds exactly
  `Crew Briefing/briefing`, `Crew Debriefing/debriefing`, and `Crew
  Interview/interview`; each has A fixed Basic Information, B configurable
  form-specific points, and C fixed office-only Office Followup/Interview
  Comments. `0199_correct_shared_configurable_form_parts.sql` asserts exactly
  those literal categories and A/B/C parts.
* `frm_form_parts` belongs to a form, not a version. `FORM_PART_TYPES` only
  allows `fixed` and `configurable`. No part create/rename/reorder/delete API or
  UI exists in `server/v2/admin/routes.ts`; creation is migration-only in the
  inspected implementation. Direct SQL/migration edits could create or alter
  parts, but that is outside the application API and has no released-version
  safety guard.
* Fixed UI is feature-owned: `BriefingFixedParts`, `DebriefingFixedParts`, and
  `InterviewFixedParts`. Registry dispatch is category/part-code keyed, so a new
  client-defined fixed part has no database-driven component.
* A is assumed by seed, host context and `partA` response objects, although the
  database does not require a Part A section. A context fields are hardcoded in
  each service (`crew/g1`, candidate/B6, crew/G2). C is similarly hardcoded to
  office review/interviewer comments and per-form parent columns.
* Each form has a separate parent submission table. Generic state/answer rows use
  untyped `submission_uuid`; they cannot enforce which parent table owns a UUID.
* Categories `briefing`, `interview`, and `debriefing` are literal strings in
  migrations and resolution queries. No authoritative category enum/FK was
  found; whether arbitrary categories are accepted everywhere is UNKNOWN.
* Mode values, response types, responsibility modes, layout values, statuses,
  officer/seafarer signature types, and fixed part codes are hardcoded in DB
  checks, Zod schemas, services, and renderer.
* `partCode` is normalized for registry lookup; renderer has fixed fallback
  behavior and missing-content messages. Part A/B/C ordering and office-only
  behavior are seeded assumptions, not a generic extension point.
* Vessel applicability is JSON text and only server-validated against active
  vessel types; interview assumes universal applicability.
* Submission completion is tied to every section state being submitted and
  parent status values. There is no generic submission parent or generic
  context payload.
* The renderer hardcodes response controls and labels for all nine response
  types, missing-content strings, Yes/No/NA labels, `Confirm`, date formatting,
  signature canvas dimensions, PNG signature transport, and the officer versus
  seafarer signature workflow (`ConfiguredFormRenderer.tsx:511-670`,
  `:266-339`). A client-defined response type therefore requires renderer code.
* Each live host hardcodes its create/resolve/reopen contracts, parent source,
  Part A/C payload shape, default signer values, and category-specific fixed
  parts. The three services separately duplicate answer validation, locking,
  applicability, ownership, signature, and completion logic; there is no
  generic form-category service.

## 9. Known limitations

`frm_form_parts` is form-owned. Adding a part to a form with released versions
would make that part visible to every version of the form, while existing
version structures contain no sections for it; there is no version-part join or
part-version migration.

No UI/API was found to create, rename, reorder, or remove parts; migration is
the only evidenced mechanism. There is a soft-delete column, but no part
deletion service/route. Hard deletion is blocked while `frm_sections` reference
the part by the catalog `ON DELETE RESTRICT` FK. A soft-deleted part is filtered
from live `formParts`, while version sections/states/answers remain stored;
renderer grouping cannot reach those sections. Structure replacement deletes
omitted active questions/sections (`formStructureRepository.ts:165-178`).

Other limitations: form/version and part/version consistency is application
enforced rather than encoded in a composite FK; option-set ownership is likewise
application validated; options and answers are text (multi-select JSON);
released structures require a new version; fixed components are not
client-defined; categories and per-form A/C payloads are not generic; and
historical source rows may be soft-deleted while nullable source links preserve
submissions.

## 10. Test and baseline state

Final document audit: 705 lines, 66 endpoint rows in the authoritative §5
inventory, and 6 literal `UNKNOWN` occurrences. The six occurrences include
the definition/negative constraint wording; the unresolved behavior claims are
listed explicitly at the end of this section.

During this session, the focused test command was run and **19 suites / 140
tests passed**:
`npx vitest run tests/unit/configured-form-renderer.test.tsx
tests/unit/form-structure-contract.test.ts tests/unit/form-effective-layout.test.ts
tests/unit/generic-form-editor-helpers.test.ts tests/unit/generic-form-editor-release.test.tsx
tests/unit/generic-form-editor-preview-portal.test.tsx tests/unit/fixed-part-registry.test.tsx
tests/unit/forms-permission-route-inventory.test.ts tests/unit/briefing-creation-resolution.test.ts
tests/unit/briefing-read-authorization.test.ts tests/unit/briefing-live-submission-host.test.ts
tests/unit/interview-creation-resolution.test.ts tests/unit/interview-read-authorization.test.ts
tests/unit/interview-live-submission-host.test.ts tests/unit/debriefing-service.test.ts
tests/unit/debriefing-live-submission-host.test.ts tests/integration/form-structure-service.test.ts
tests/integration/form-option-set-migration.test.ts tests/integration/debriefing-submission.acceptance.test.ts`.

Baseline: **227 TypeScript errors across 41 files**;
`npm run check` is the configured command (`package.json:15`, strict `tsconfig`).
The focused baseline is **19 focused suites / 140 tests passing**. The focused
engine suites are:

`configured-form-renderer.test.tsx`, `form-structure-contract.test.ts`,
`form-effective-layout.test.ts`, `generic-form-editor-helpers.test.ts`,
`generic-form-editor-release.test.tsx`, `generic-form-editor-preview-portal.test.tsx`,
`fixed-part-registry.test.tsx`, `forms-permission-route-inventory.test.ts`,
`briefing-creation-resolution.test.ts`, `briefing-read-authorization.test.ts`,
`briefing-live-submission-host.test.ts`, `interview-creation-resolution.test.ts`,
`interview-read-authorization.test.ts`, `interview-live-submission-host.test.ts`,
`debriefing-service.test.ts`, `debriefing-live-submission-host.test.ts`,
`form-structure-service.test.ts`, `form-option-set-migration.test.ts`, and
`debriefing-submission.acceptance.test.ts`. The dedicated suites are current
focused coverage according to the focused source/test inventory. The older
`tests/integration/api/forms.test.ts` is explicitly stale because it targets
removed `/api/appraisals`; unrelated stale tests are recorded in
`docs/test-baseline.md`.

### Unresolved UNKNOWN claims

1. Whether categories beyond the three seeded literals are accepted universally
   is not established.
