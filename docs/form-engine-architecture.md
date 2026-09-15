# Form Engine Architecture and Data Flow

**Document type:** System architecture and operational reference  
**Applies to:** Admin Forms Configuration, Recruitment Interviews, Crew Briefings, Crew Debriefings  
**Audience:** Product owners, operations teams, developers, database administrators, QA, reporting teams  
**Status:** Current-state architecture  
**Last reviewed:** 10 September 2026

---

## 1. Purpose

This document explains how the shared Form Engine is configured in Admin and used by the Recruitment and Crew Pool modules. It covers:

- Form creation and versioning
- Rank-based template selection
- Runtime creation of Interview, Briefing, and Debriefing submissions
- Candidate and crew binding
- Storage of sections, answers, comments, and signatures
- Architectural strengths and risks
- Requirements for future reporting and analytics

The Form Engine supports three operational form categories:

| Category | Operational module | Subject |
|---|---|---|
| Interview | Recruitment | Recruitment candidate and interview item |
| Briefing | Crew Pool | Crew member and G1 briefing event |
| Debriefing | Crew Pool | Crew member and G2 debriefing event |

---

## 2. Executive Summary

The Form Engine separates reusable form definitions from operational submissions.

![Form Engine Architecture Overview](diagrams/form-engine/architecture-overview.svg)

*Figure 1. Form Engine Architecture Overview.*

The main architectural principles are:

1. Admin edits draft versions rather than live operational submissions.
2. A runtime submission is pinned to an exact released form version.
3. Sections, questions, and options are normalized into relational tables.
4. Answers are stored in long-form records, one answer per submission and question.
5. Interview, Briefing, and Debriefing use separate submission root tables.
6. Shared answer and section-state tables use a polymorphic `submission_uuid`.

The template/version design is sound. The main structural risk is the absence of a common submission parent table and database-enforced foreign keys for some subject relationships.

---

## 3. System Context

![System Context](diagrams/form-engine/system-context.svg)

*Figure 2. System Context.*

---

## 4. Form Definition Model

### 4.1 Form skeleton

The system seeds one shared form for each operational category:

- Crew Briefing Form
- Crew Debriefing Form
- Crew Interview Form

Each uses the following general structure:

| Part | Purpose | Configuration model |
|---|---|---|
| Part A | Basic or operational information | Fixed |
| Part B | Briefing, Debriefing, or Interview questions | Configurable |
| Part C | Office follow-up or Interview comments | Fixed and office-oriented |

The configurable Part B is managed through the Admin Form Engine.

### 4.2 Configuration hierarchy

![Form Configuration Hierarchy](diagrams/form-engine/configuration-hierarchy.svg)

*Figure 3. Form Configuration Hierarchy.*

### 4.3 Configuration tables

#### `adm_forms_v2`

The base form record.

Primary responsibilities:

- Identifies the form and category
- Stores the stable form UUID
- Maintains current or legacy version metadata
- Stores lock and lifecycle information
- Provides the parent for versions and form parts

#### `frm_form_parts`

Defines the high-level parts of the form.

Relationship:

```text
frm_form_parts.form_uuid
    → adm_forms_v2.form_uuid
```

Important attributes:

- Part UUID
- Part code
- Part title
- Fixed or configurable type
- Office-only indicator
- Display order

#### `adm_rank_groups_v2`

Associates a form with groups of applicable ranks.

Important attributes:

- Rank-group UUID
- Parent form ID
- Rank-group name
- Serialized rank list
- Configuration
- Archive state

The rank list is currently stored as JSON text rather than through a normalized rank-group membership table.

#### `adm_available_ranks_v2`

Provides the Admin rank catalog used to populate rank selection controls. It is not directly related to rank groups through a database join table.

#### `adm_form_versions_v2`

Represents one editable or released version of a form for a rank group.

Important attributes:

- Version UUID
- Parent form
- Rank group
- Version number and date
- Status: draft or released
- Release timestamp
- Configuration and shared configuration
- Lifecycle and audit fields

#### `frm_sections`

Stores sections belonging to an exact form version.

Relationships:

```text
frm_sections.form_version_uuid
    → adm_form_versions_v2.fv_uuid

frm_sections.form_part_uuid
    → frm_form_parts.form_part_uuid
```

Section configuration can include:

- Code and title
- Display order
- Responsible role
- Applicable vessels
- Officer and seafarer comment requirements
- Officer and seafarer signature requirements
- Default option set
- Layout preference

#### `frm_questions`

Stores version-specific questions.

Relationship:

```text
frm_questions.section_uuid
    → frm_sections.section_uuid
```

Question configuration can include:

- Stable row UUID
- Question code
- Question text
- Response type
- Mandatory status
- Comment rules
- Option-set reference
- Display order

#### `frm_option_sets` and `frm_options`

Option sets belong to an exact form version. Individual selectable values belong to an option set.

```text
frm_option_sets.form_version_uuid
    → adm_form_versions_v2.fv_uuid

frm_options.option_set_uuid
    → frm_option_sets.option_set_uuid
```

---

## 5. Admin Form Creation and Release Flow

### 5.1 End-to-end sequence

![Admin Form Creation & Release](diagrams/form-engine/admin-creation-sequence.svg)

*Figure 4. Admin Form Creation & Release.*

### 5.2 Operational rules

1. A version is created for a form and rank group.
2. Only a draft version can be structurally edited.
3. A previous released structure can be copied into the new draft.
4. Structure replacement is transactional.
5. Runtime submission creation requires a released version.
6. Releasing a newer version does not automatically migrate existing submissions.

### 5.3 Primary Admin endpoints

| Purpose | Endpoint |
|---|---|
| List/create forms | `GET/POST /api/v2/admin/forms` |
| Read/update/delete form | `GET/PUT/DELETE /api/v2/admin/forms/:id` |
| List/create versions | `GET/POST /api/v2/admin/forms/:id/versions` |
| Read/update/delete version | `GET/PUT/DELETE /api/v2/admin/form-versions/:id` |
| Release version | `POST /api/v2/admin/form-versions/:id/release` |
| Read pinned configuration | `GET /api/v2/admin/form-versions/:versionId/configuration` |
| Read part structure | `GET /api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` |
| Replace part structure | `PUT /api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` |
| Replace complete structure | `PUT /api/v2/admin/form-versions/:fvUuid/structures` |
| Manage rank groups | `/api/v2/admin/rank-groups` |

---

## 6. Runtime Template Resolution

Runtime services resolve a form using operational context rather than accepting a browser-supplied form version as authority.

![Runtime Template Resolution](diagrams/form-engine/runtime-template-resolution.svg)

*Figure 5. Runtime Template Resolution.*

Rank resolution can consider literal and base-rank forms. A rank group with no released version cannot produce a runtime submission.

---

## 7. Runtime Submission Model

### 7.1 Shared model

![Shared Runtime Submission Model](diagrams/form-engine/runtime-submission-model.svg)

*Figure 6. Shared Runtime Submission Model.*

Each submission root stores:

- Its own submission UUID
- The applicable form UUID
- The exact form-version UUID
- Operational subject and source-event identifiers
- Status and completion information

The normalized template is referenced at runtime; it is not copied wholesale into the submission.

### 7.2 Section state

`frm_section_states` stores runtime progress for each applicable section.

Typical statuses:

- `not_started`
- `in_progress`
- `submitted`
- `not_applicable`

It can also store:

- Section comments
- Submitter information
- Submission timestamps
- Signature-related metadata

### 7.3 Answers

`frm_answers` stores one answer per submission and question.

Logical key:

```text
submission_uuid + question_uuid
```

Stored values include:

- Raw answer value
- Answer comment
- Audit metadata

Answer values are primarily stored as text. Multi-select answers can use serialized JSON.

### 7.4 Signatures

`frm_signature_attachments` stores signature-file metadata.  
`frm_section_signatures` links a signature attachment to a section-state record.

---

## 8. Recruitment Interview Flow

### 8.1 Binding model

![Recruitment Interview Candidate Binding](diagrams/form-engine/interview-binding.svg)

*Figure 7. Recruitment Interview Candidate Binding.*

### 8.2 Creation sequence

![Interview Submission Creation](diagrams/form-engine/interview-creation-sequence.svg)

*Figure 8. Interview Submission Creation.*

### 8.3 Interview root entity

`crew_interview_submissions` stores:

- `submission_uuid`
- `rec_can_uuid`
- `interview_item_uuid`
- `form_uuid`
- `form_version_uuid`
- Interview category and stage
- Status and completion timestamp
- Comments and audit metadata

The database enforces one submission per interview item. Candidate and interview-item relationships are also checked by the service, but are not fully represented by database foreign keys in the current migration model.

---

## 9. Crew Briefing Flow

### 9.1 Binding model

![Crew Briefing Binding](diagrams/form-engine/briefing-binding.svg)

*Figure 9. Crew Briefing Binding.*

### 9.2 Creation sequence

1. The service receives an authoritative G1 briefing UUID.
2. It loads the G1 record and its crew UUID.
3. It derives the operational rank and vessel context.
4. It resolves the applicable released Briefing version.
5. It creates `crew_briefing_submissions`.
6. It pins the form and version.
7. It initializes section-state records.

The Briefing submission has a unique, restrictive relationship to the originating G1 briefing record. The crew UUID remains a logical text relationship rather than a direct database foreign key to the crew master.

---

## 10. Crew Debriefing Flow

### 10.1 Binding model

![Crew Debriefing Binding](diagrams/form-engine/debriefing-binding.svg)

*Figure 10. Crew Debriefing Binding.*

### 10.2 Creation sequence

1. The service receives the G2 debriefing UUID.
2. It locks and loads the source debriefing record.
3. It determines the crew member and operational context.
4. It resolves the applicable released Debriefing version.
5. It creates `crew_debriefing_submissions`.
6. It initializes section states.
7. It enforces mandatory answers, comments, signatures, and section submission rules.

The root submission also stores Debriefing-specific information such as date, mode, office-review comments, reviewer, and review timestamp.

---

## 11. Entity Relationship Summary

![Form Engine Entity Relationships](diagrams/form-engine/entity-relationship.svg)

*Figure 11. Form Engine Entity Relationships.*

> **Important:** The diagram shows the logical submission relationships. The current schema does not provide a common submission parent foreign key from `frm_section_states` and `frm_answers`.

---

## 12. Data Ownership and Source of Truth

| Information | Source of truth |
|---|---|
| Form identity and category | `adm_forms_v2` |
| Form parts | `frm_form_parts` |
| Applicable rank grouping | `adm_rank_groups_v2` |
| Draft/released lifecycle | `adm_form_versions_v2` |
| Section structure | `frm_sections` |
| Question definition | `frm_questions` |
| Selectable options | `frm_option_sets`, `frm_options` |
| Candidate Interview binding | `crew_interview_submissions` |
| Crew Briefing binding | `crew_briefing_submissions` |
| Crew Debriefing binding | `crew_debriefing_submissions` |
| Runtime section status | `frm_section_states` |
| Runtime answers | `frm_answers` |
| Runtime signatures | `frm_signature_attachments`, `frm_section_signatures` |

Browser-supplied rank, form, role, or subject values must not be treated as authoritative where the server can resolve them from the operational source record.

---

## 13. Architecture Evaluation

### 13.1 Strengths

#### Normalized template structure

Sections, questions, option sets, and options are independently queryable. This supports validation, reuse, reporting, and controlled editing better than a single opaque JSON document.

#### Exact version pinning

Every new submission records the form and exact version used at creation. A later release does not rewrite historical submissions.

#### Draft and release lifecycle

Operational users consume released versions while Admin works on drafts. This provides a clear publication boundary.

#### Transactional structure replacement

Multi-table structure changes are applied transactionally, reducing partial-update risk.

#### Long-form answer storage

One answer per submission/question is suitable for question-level reporting and avoids wide, form-specific response tables.

#### Operational event uniqueness

Source-event uniqueness limits duplicate submissions for the same Interview item, G1 briefing, or G2 debriefing.

### 13.2 Risks and anti-patterns

#### Polymorphic submission UUID without a parent foreign key

`frm_section_states.submission_uuid` and `frm_answers.submission_uuid` can refer to three different root tables.

Risks:

- Orphan answers or states
- Incorrect cross-form joins
- More complex deletion and retention rules
- Weak database integrity
- Repeated `UNION ALL` logic in reports

#### Inconsistent subject foreign keys

Some source-event links are database-enforced, while candidate and crew UUIDs are often plain text validated only by services.

#### Rank-group membership stored as JSON text

The database cannot enforce valid ranks, prevent duplicates, or automatically preserve mappings when ranks are renamed.

#### Weakly typed answers

Text storage provides flexibility but requires response-type-aware parsing for numbers, dates, booleans, and multi-select values.

#### Potential historical definition drift

Historical submissions reference version-owned definitions. If a released definition is modified or soft-deleted incorrectly, historical display and reports can change.

#### Legacy and normalized configuration coexistence

Configuration JSON fields coexist with normalized structure tables. The normalized structure must remain the declared source of truth to avoid conflicting representations.

---

## 14. Reporting and Analytics Readiness

### 14.1 Reporting possible today

The current schema can support:

- Candidate and crew completion rates
- Completion duration
- Section progress and abandonment
- Question-level response distribution
- Mandatory-answer compliance
- Interview stage and category analysis
- Briefing and Debriefing trends by rank, vessel, and date
- Comment and signature completion
- Version-specific comparisons

Briefing already has a long-form reporting view. Equivalent standardized views are needed for Interview and Debriefing.

### 14.2 Current reporting join

![Reporting Data Join](diagrams/form-engine/reporting-join.svg)

*Figure 12. Reporting Data Join.*

### 14.3 Reporting limitations

- Three different root submission tables
- No common submission foreign key
- Text and JSON answer decoding
- No stable semantic question key across versions
- Inconsistent reporting views
- JSON-based rank-group membership
- Historical label changes can affect interpretation

---

## 15. Recommended Target Architecture

### 15.1 Common submission root

Introduce a common `frm_submissions` table.

![Recommended Common Submission Architecture](diagrams/form-engine/target-submission-architecture.svg)

*Figure 13. Recommended Common Submission Architecture.*

Suggested fields:

| Field | Purpose |
|---|---|
| `submission_uuid` | Common primary identifier |
| `submission_type` | Interview, Briefing, or Debriefing |
| `form_uuid` | Stable form |
| `form_version_uuid` | Exact pinned version |
| `subject_type` | Candidate or crew |
| `subject_uuid` | Candidate or crew UUID |
| `source_event_type` | Interview item, G1, or G2 |
| `source_event_uuid` | Authoritative operational event |
| `status` | Runtime status |
| `started_at` | Start timestamp |
| `completed_at` | Completion timestamp |
| Audit fields | Actor and timestamps |

This allows real foreign keys from section states and answers.

### 15.2 Unified reporting views

As an incremental step, create:

- `vw_form_submissions`
- `vw_form_submission_sections`
- `vw_form_submission_answers`

The common submission view can initially use `UNION ALL` across the existing root tables.

### 15.3 Stable semantic question identifiers

Add a cross-version key such as:

```text
INTERVIEW.COMMUNICATION_SKILLS
BRIEFING.SAFETY_EXPECTATIONS
DEBRIEFING.INCIDENT_FEEDBACK
```

Version-specific question UUIDs remain unique, while the semantic key supports trend analysis across versions.

### 15.4 Typed analytics projection

Retain the raw answer value and expose type-specific reporting columns:

- `answer_text`
- `answer_number`
- `answer_boolean`
- `answer_date`
- `answer_option_value`
- `answer_option_values_jsonb`

### 15.5 Normalized rank-group membership

Introduce an `adm_rank_group_ranks` table:

```text
rank_group_uuid
rank_uuid
```

This provides referential integrity and simplifies template coverage reporting.

### 15.6 Released-version immutability

Released sections, questions, option sets, and options should be immutable. Any semantic change should create a new draft and release.

---

## 16. Recommended Delivery Priorities

| Priority | Recommendation | Benefit |
|---|---|---|
| 1 | Add unified reporting views | Immediate consistent reporting |
| 2 | Add Interview and Debriefing long-form views | Feature parity with Briefing |
| 3 | Add stable semantic question keys | Cross-version trends |
| 4 | Enforce released-definition immutability | Reliable history and audit |
| 5 | Normalize rank-group membership | Better integrity and rank matching |
| 6 | Introduce common submission root | Strong relational integrity |
| 7 | Add typed analytics projections | Simpler and faster reporting |
| 8 | Add missing candidate/crew constraints | Prevent orphan subject links |

---

## 17. Operational Controls

The following controls should be maintained:

1. Only users with the appropriate Forms permission may create, edit, release, or delete configurations.
2. Runtime services must resolve subject, rank, and source event from server-controlled records.
3. Only released versions may create new submissions.
4. Submitted sections must remain read-only.
5. Mandatory answers, comments, and signatures must be validated server-side.
6. Every submission must retain its pinned form version.
7. Released definitions must not be edited in place.
8. Deletes must preserve historical submissions and reporting integrity.

---

## 18. Code and Schema Reference

### Admin Form Engine

- `server/v2/admin/routes.ts`
- `server/v2/admin/controllers/formsController.ts`
- `server/v2/admin/controllers/formStructureController.ts`
- `server/v2/admin/services/formsService.ts`
- `server/v2/admin/services/formStructureService.ts`
- `server/v2/admin/repositories/formsRepository.ts`
- `server/v2/admin/repositories/formVersionsRepository.ts`
- `server/v2/admin/repositories/formStructureRepository.ts`
- `shared/v2/admin/schema.ts`
- `shared/v2/forms-engine/schema.ts`

### Runtime services

- `server/v2/interviews/routes.ts`
- `server/v2/interviews/service.ts`
- `server/v2/interviews/repository.ts`
- `server/v2/briefings/routes.ts`
- `server/v2/briefings/service.ts`
- `server/v2/briefings/repository.ts`
- `server/v2/debriefings/routes.ts`
- `server/v2/debriefings/service.ts`
- `server/v2/debriefings/repository.ts`

### Client renderers

- `client/src/components/FormEditor.tsx`
- `client/src/components/GenericFormEditor.tsx`
- `client/src/components/FormEditorFactory.tsx`
- `client/src/modules/crew-pool/components/BriefingLiveSubmissionHost.tsx`
- `client/src/modules/crew-pool/components/DebriefingLiveSubmissionHost.tsx`
- `client/src/modules/recruitment/components/InterviewLiveSubmissionHost.tsx`

### Foundational migrations

- `migrations/0197_create_shared_configurable_forms_tables.sql`
- `migrations/0198_seed_shared_configurable_forms.sql`
- `migrations/0199_correct_shared_configurable_form_parts.sql`
- `migrations/0202_create_crew_briefing_submission_tables.sql`
- `migrations/0205_seed_missing_shared_form_skeletons.sql`
- `migrations/0208_link_briefing_submission_to_g1.sql`
- `migrations/0209_create_crew_interview_submissions.sql`
- `migrations/0211_create_crew_debriefing_submissions.sql`

---

## 19. Glossary

| Term | Meaning |
|---|---|
| Form | Stable definition for Interview, Briefing, or Debriefing |
| Form Part | High-level fixed or configurable area, such as Part A, B, or C |
| Rank Group | Group of ranks that share an applicable form version |
| Draft Version | Editable version not available for new operational submissions |
| Released Version | Published version available for runtime submission creation |
| Submission Root | Type-specific Interview, Briefing, or Debriefing record |
| Section State | Runtime progress and metadata for one submission section |
| Answer | Value and optional comment for one submission question |
| Version Pinning | Recording the exact form version used by a submission |
| Source Event | Interview item, G1 briefing, or G2 debriefing that initiated the form |
| Semantic Question Key | Stable identifier used to compare equivalent questions across versions |

---

## 20. Conclusion

The Form Engine provides a strong foundation for versioned, configurable operational forms. Its normalized template hierarchy, release workflow, exact version pinning, and long-form answers support current operations and future reporting.

The most important architectural improvement is to establish a common submission root, or at minimum a unified reporting layer, so shared answers and section states have one authoritative parent. Released-version immutability, normalized rank membership, typed analytics projections, and stable semantic question keys will make the platform easier to audit, scale, and analyze.
# Form Engine Architecture and Data Flow

**Document type:** System architecture and operational reference  
**Applies to:** Admin Forms Configuration, Recruitment Interviews, Crew Briefings, Crew Debriefings  
**Audience:** Product owners, operations teams, developers, database administrators, QA, reporting teams  
**Status:** Current-state architecture  
**Last reviewed:** 10 September 2026

---

## 1. Purpose

This document explains how the shared Form Engine is configured in Admin and used by the Recruitment and Crew Pool modules. It covers:

- Form creation and versioning
- Rank-based template selection
- Runtime creation of Interview, Briefing, and Debriefing submissions
- Candidate and crew binding
- Storage of sections, answers, comments, and signatures
- Architectural strengths and risks
- Requirements for future reporting and analytics

The Form Engine supports three operational form categories:

| Category | Operational module | Subject |
|---|---|---|
| Interview | Recruitment | Recruitment candidate and interview item |
| Briefing | Crew Pool | Crew member and G1 briefing event |
| Debriefing | Crew Pool | Crew member and G2 debriefing event |

---

## 2. Executive Summary

The Form Engine separates reusable form definitions from operational submissions.

![Form Engine Architecture Overview](diagrams/form-engine/architecture-overview.svg)

*Figure 1. Form Engine Architecture Overview.*

The main architectural principles are:

1. Admin edits draft versions rather than live operational submissions.
2. A runtime submission is pinned to an exact released form version.
3. Sections, questions, and options are normalized into relational tables.
4. Answers are stored in long-form records, one answer per submission and question.
5. Interview, Briefing, and Debriefing use separate submission root tables.
6. Shared answer and section-state tables use a polymorphic `submission_uuid`.

The template/version design is sound. The main structural risk is the absence of a common submission parent table and database-enforced foreign keys for some subject relationships.

---

## 3. System Context

![System Context](diagrams/form-engine/system-context.svg)

*Figure 2. System Context.*

---

## 4. Form Definition Model

### 4.1 Form skeleton

The system seeds one shared form for each operational category:

- Crew Briefing Form
- Crew Debriefing Form
- Crew Interview Form

Each uses the following general structure:

| Part | Purpose | Configuration model |
|---|---|---|
| Part A | Basic or operational information | Fixed |
| Part B | Briefing, Debriefing, or Interview questions | Configurable |
| Part C | Office follow-up or Interview comments | Fixed and office-oriented |

The configurable Part B is managed through the Admin Form Engine.

### 4.2 Configuration hierarchy

![Form Configuration Hierarchy](diagrams/form-engine/configuration-hierarchy.svg)

*Figure 3. Form Configuration Hierarchy.*

### 4.3 Configuration tables

#### `adm_forms_v2`

The base form record.

Primary responsibilities:

- Identifies the form and category
- Stores the stable form UUID
- Maintains current or legacy version metadata
- Stores lock and lifecycle information
- Provides the parent for versions and form parts

#### `frm_form_parts`

Defines the high-level parts of the form.

Relationship:

```text
frm_form_parts.form_uuid
    → adm_forms_v2.form_uuid
```

Important attributes:

- Part UUID
- Part code
- Part title
- Fixed or configurable type
- Office-only indicator
- Display order

#### `adm_rank_groups_v2`

Associates a form with groups of applicable ranks.

Important attributes:

- Rank-group UUID
- Parent form ID
- Rank-group name
- Serialized rank list
- Configuration
- Archive state

The rank list is currently stored as JSON text rather than through a normalized rank-group membership table.

#### `adm_available_ranks_v2`

Provides the Admin rank catalog used to populate rank selection controls. It is not directly related to rank groups through a database join table.

#### `adm_form_versions_v2`

Represents one editable or released version of a form for a rank group.

Important attributes:

- Version UUID
- Parent form
- Rank group
- Version number and date
- Status: draft or released
- Release timestamp
- Configuration and shared configuration
- Lifecycle and audit fields

#### `frm_sections`

Stores sections belonging to an exact form version.

Relationships:

```text
frm_sections.form_version_uuid
    → adm_form_versions_v2.fv_uuid

frm_sections.form_part_uuid
    → frm_form_parts.form_part_uuid
```

Section configuration can include:

- Code and title
- Display order
- Responsible role
- Applicable vessels
- Officer and seafarer comment requirements
- Officer and seafarer signature requirements
- Default option set
- Layout preference

#### `frm_questions`

Stores version-specific questions.

Relationship:

```text
frm_questions.section_uuid
    → frm_sections.section_uuid
```

Question configuration can include:

- Stable row UUID
- Question code
- Question text
- Response type
- Mandatory status
- Comment rules
- Option-set reference
- Display order

#### `frm_option_sets` and `frm_options`

Option sets belong to an exact form version. Individual selectable values belong to an option set.

```text
frm_option_sets.form_version_uuid
    → adm_form_versions_v2.fv_uuid

frm_options.option_set_uuid
    → frm_option_sets.option_set_uuid
```

---

## 5. Admin Form Creation and Release Flow

### 5.1 End-to-end sequence

![Admin Form Creation & Release](diagrams/form-engine/admin-creation-sequence.svg)

*Figure 4. Admin Form Creation & Release.*

### 5.2 Operational rules

1. A version is created for a form and rank group.
2. Only a draft version can be structurally edited.
3. A previous released structure can be copied into the new draft.
4. Structure replacement is transactional.
5. Runtime submission creation requires a released version.
6. Releasing a newer version does not automatically migrate existing submissions.

### 5.3 Primary Admin endpoints

| Purpose | Endpoint |
|---|---|
| List/create forms | `GET/POST /api/v2/admin/forms` |
| Read/update/delete form | `GET/PUT/DELETE /api/v2/admin/forms/:id` |
| List/create versions | `GET/POST /api/v2/admin/forms/:id/versions` |
| Read/update/delete version | `GET/PUT/DELETE /api/v2/admin/form-versions/:id` |
| Release version | `POST /api/v2/admin/form-versions/:id/release` |
| Read pinned configuration | `GET /api/v2/admin/form-versions/:versionId/configuration` |
| Read part structure | `GET /api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` |
| Replace part structure | `PUT /api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` |
| Replace complete structure | `PUT /api/v2/admin/form-versions/:fvUuid/structures` |
| Manage rank groups | `/api/v2/admin/rank-groups` |

---

## 6. Runtime Template Resolution

Runtime services resolve a form using operational context rather than accepting a browser-supplied form version as authority.

![Runtime Template Resolution](diagrams/form-engine/runtime-template-resolution.svg)

*Figure 5. Runtime Template Resolution.*

Rank resolution can consider literal and base-rank forms. A rank group with no released version cannot produce a runtime submission.

---

## 7. Runtime Submission Model

### 7.1 Shared model

![Shared Runtime Submission Model](diagrams/form-engine/runtime-submission-model.svg)

*Figure 6. Shared Runtime Submission Model.*

Each submission root stores:

- Its own submission UUID
- The applicable form UUID
- The exact form-version UUID
- Operational subject and source-event identifiers
- Status and completion information

The normalized template is referenced at runtime; it is not copied wholesale into the submission.

### 7.2 Section state

`frm_section_states` stores runtime progress for each applicable section.

Typical statuses:

- `not_started`
- `in_progress`
- `submitted`
- `not_applicable`

It can also store:

- Section comments
- Submitter information
- Submission timestamps
- Signature-related metadata

### 7.3 Answers

`frm_answers` stores one answer per submission and question.

Logical key:

```text
submission_uuid + question_uuid
```

Stored values include:

- Raw answer value
- Answer comment
- Audit metadata

Answer values are primarily stored as text. Multi-select answers can use serialized JSON.

### 7.4 Signatures

`frm_signature_attachments` stores signature-file metadata.  
`frm_section_signatures` links a signature attachment to a section-state record.

---

## 8. Recruitment Interview Flow

### 8.1 Binding model

![Recruitment Interview Candidate Binding](diagrams/form-engine/interview-binding.svg)

*Figure 7. Recruitment Interview Candidate Binding.*

### 8.2 Creation sequence

![Interview Submission Creation](diagrams/form-engine/interview-creation-sequence.svg)

*Figure 8. Interview Submission Creation.*

### 8.3 Interview root entity

`crew_interview_submissions` stores:

- `submission_uuid`
- `rec_can_uuid`
- `interview_item_uuid`
- `form_uuid`
- `form_version_uuid`
- Interview category and stage
- Status and completion timestamp
- Comments and audit metadata

The database enforces one submission per interview item. Candidate and interview-item relationships are also checked by the service, but are not fully represented by database foreign keys in the current migration model.

---

## 9. Crew Briefing Flow

### 9.1 Binding model

![Crew Briefing Binding](diagrams/form-engine/briefing-binding.svg)

*Figure 9. Crew Briefing Binding.*

### 9.2 Creation sequence

1. The service receives an authoritative G1 briefing UUID.
2. It loads the G1 record and its crew UUID.
3. It derives the operational rank and vessel context.
4. It resolves the applicable released Briefing version.
5. It creates `crew_briefing_submissions`.
6. It pins the form and version.
7. It initializes section-state records.

The Briefing submission has a unique, restrictive relationship to the originating G1 briefing record. The crew UUID remains a logical text relationship rather than a direct database foreign key to the crew master.

---

## 10. Crew Debriefing Flow

### 10.1 Binding model

![Crew Debriefing Binding](diagrams/form-engine/debriefing-binding.svg)

*Figure 10. Crew Debriefing Binding.*

### 10.2 Creation sequence

1. The service receives the G2 debriefing UUID.
2. It locks and loads the source debriefing record.
3. It determines the crew member and operational context.
4. It resolves the applicable released Debriefing version.
5. It creates `crew_debriefing_submissions`.
6. It initializes section states.
7. It enforces mandatory answers, comments, signatures, and section submission rules.

The root submission also stores Debriefing-specific information such as date, mode, office-review comments, reviewer, and review timestamp.

---

## 11. Entity Relationship Summary

![Form Engine Entity Relationships](diagrams/form-engine/entity-relationship.svg)

*Figure 11. Form Engine Entity Relationships.*

> **Important:** The diagram shows the logical submission relationships. The current schema does not provide a common submission parent foreign key from `frm_section_states` and `frm_answers`.

---

## 12. Data Ownership and Source of Truth

| Information | Source of truth |
|---|---|
| Form identity and category | `adm_forms_v2` |
| Form parts | `frm_form_parts` |
| Applicable rank grouping | `adm_rank_groups_v2` |
| Draft/released lifecycle | `adm_form_versions_v2` |
| Section structure | `frm_sections` |
| Question definition | `frm_questions` |
| Selectable options | `frm_option_sets`, `frm_options` |
| Candidate Interview binding | `crew_interview_submissions` |
| Crew Briefing binding | `crew_briefing_submissions` |
| Crew Debriefing binding | `crew_debriefing_submissions` |
| Runtime section status | `frm_section_states` |
| Runtime answers | `frm_answers` |
| Runtime signatures | `frm_signature_attachments`, `frm_section_signatures` |

Browser-supplied rank, form, role, or subject values must not be treated as authoritative where the server can resolve them from the operational source record.

---

## 13. Architecture Evaluation

### 13.1 Strengths

#### Normalized template structure

Sections, questions, option sets, and options are independently queryable. This supports validation, reuse, reporting, and controlled editing better than a single opaque JSON document.

#### Exact version pinning

Every new submission records the form and exact version used at creation. A later release does not rewrite historical submissions.

#### Draft and release lifecycle

Operational users consume released versions while Admin works on drafts. This provides a clear publication boundary.

#### Transactional structure replacement

Multi-table structure changes are applied transactionally, reducing partial-update risk.

#### Long-form answer storage

One answer per submission/question is suitable for question-level reporting and avoids wide, form-specific response tables.

#### Operational event uniqueness

Source-event uniqueness limits duplicate submissions for the same Interview item, G1 briefing, or G2 debriefing.

### 13.2 Risks and anti-patterns

#### Polymorphic submission UUID without a parent foreign key

`frm_section_states.submission_uuid` and `frm_answers.submission_uuid` can refer to three different root tables.

Risks:

- Orphan answers or states
- Incorrect cross-form joins
- More complex deletion and retention rules
- Weak database integrity
- Repeated `UNION ALL` logic in reports

#### Inconsistent subject foreign keys

Some source-event links are database-enforced, while candidate and crew UUIDs are often plain text validated only by services.

#### Rank-group membership stored as JSON text

The database cannot enforce valid ranks, prevent duplicates, or automatically preserve mappings when ranks are renamed.

#### Weakly typed answers

Text storage provides flexibility but requires response-type-aware parsing for numbers, dates, booleans, and multi-select values.

#### Potential historical definition drift

Historical submissions reference version-owned definitions. If a released definition is modified or soft-deleted incorrectly, historical display and reports can change.

#### Legacy and normalized configuration coexistence

Configuration JSON fields coexist with normalized structure tables. The normalized structure must remain the declared source of truth to avoid conflicting representations.

---

## 14. Reporting and Analytics Readiness

### 14.1 Reporting possible today

The current schema can support:

- Candidate and crew completion rates
- Completion duration
- Section progress and abandonment
- Question-level response distribution
- Mandatory-answer compliance
- Interview stage and category analysis
- Briefing and Debriefing trends by rank, vessel, and date
- Comment and signature completion
- Version-specific comparisons

Briefing already has a long-form reporting view. Equivalent standardized views are needed for Interview and Debriefing.

### 14.2 Current reporting join

![Reporting Data Join](diagrams/form-engine/reporting-join.svg)

*Figure 12. Reporting Data Join.*

### 14.3 Reporting limitations

- Three different root submission tables
- No common submission foreign key
- Text and JSON answer decoding
- No stable semantic question key across versions
- Inconsistent reporting views
- JSON-based rank-group membership
- Historical label changes can affect interpretation

---

## 15. Recommended Target Architecture

### 15.1 Common submission root

Introduce a common `frm_submissions` table.

![Recommended Common Submission Architecture](diagrams/form-engine/target-submission-architecture.svg)

*Figure 13. Recommended Common Submission Architecture.*

Suggested fields:

| Field | Purpose |
|---|---|
| `submission_uuid` | Common primary identifier |
| `submission_type` | Interview, Briefing, or Debriefing |
| `form_uuid` | Stable form |
| `form_version_uuid` | Exact pinned version |
| `subject_type` | Candidate or crew |
| `subject_uuid` | Candidate or crew UUID |
| `source_event_type` | Interview item, G1, or G2 |
| `source_event_uuid` | Authoritative operational event |
| `status` | Runtime status |
| `started_at` | Start timestamp |
| `completed_at` | Completion timestamp |
| Audit fields | Actor and timestamps |

This allows real foreign keys from section states and answers.

### 15.2 Unified reporting views

As an incremental step, create:

- `vw_form_submissions`
- `vw_form_submission_sections`
- `vw_form_submission_answers`

The common submission view can initially use `UNION ALL` across the existing root tables.

### 15.3 Stable semantic question identifiers

Add a cross-version key such as:

```text
INTERVIEW.COMMUNICATION_SKILLS
BRIEFING.SAFETY_EXPECTATIONS
DEBRIEFING.INCIDENT_FEEDBACK
```

Version-specific question UUIDs remain unique, while the semantic key supports trend analysis across versions.

### 15.4 Typed analytics projection

Retain the raw answer value and expose type-specific reporting columns:

- `answer_text`
- `answer_number`
- `answer_boolean`
- `answer_date`
- `answer_option_value`
- `answer_option_values_jsonb`

### 15.5 Normalized rank-group membership

Introduce an `adm_rank_group_ranks` table:

```text
rank_group_uuid
rank_uuid
```

This provides referential integrity and simplifies template coverage reporting.

### 15.6 Released-version immutability

Released sections, questions, option sets, and options should be immutable. Any semantic change should create a new draft and release.

---

## 16. Recommended Delivery Priorities

| Priority | Recommendation | Benefit |
|---|---|---|
| 1 | Add unified reporting views | Immediate consistent reporting |
| 2 | Add Interview and Debriefing long-form views | Feature parity with Briefing |
| 3 | Add stable semantic question keys | Cross-version trends |
| 4 | Enforce released-definition immutability | Reliable history and audit |
| 5 | Normalize rank-group membership | Better integrity and rank matching |
| 6 | Introduce common submission root | Strong relational integrity |
| 7 | Add typed analytics projections | Simpler and faster reporting |
| 8 | Add missing candidate/crew constraints | Prevent orphan subject links |

---

## 17. Operational Controls

The following controls should be maintained:

1. Only users with the appropriate Forms permission may create, edit, release, or delete configurations.
2. Runtime services must resolve subject, rank, and source event from server-controlled records.
3. Only released versions may create new submissions.
4. Submitted sections must remain read-only.
5. Mandatory answers, comments, and signatures must be validated server-side.
6. Every submission must retain its pinned form version.
7. Released definitions must not be edited in place.
8. Deletes must preserve historical submissions and reporting integrity.

---

## 18. Code and Schema Reference

### Admin Form Engine

- `server/v2/admin/routes.ts`
- `server/v2/admin/controllers/formsController.ts`
- `server/v2/admin/controllers/formStructureController.ts`
- `server/v2/admin/services/formsService.ts`
- `server/v2/admin/services/formStructureService.ts`
- `server/v2/admin/repositories/formsRepository.ts`
- `server/v2/admin/repositories/formVersionsRepository.ts`
- `server/v2/admin/repositories/formStructureRepository.ts`
- `shared/v2/admin/schema.ts`
- `shared/v2/forms-engine/schema.ts`

### Runtime services

- `server/v2/interviews/routes.ts`
- `server/v2/interviews/service.ts`
- `server/v2/interviews/repository.ts`
- `server/v2/briefings/routes.ts`
- `server/v2/briefings/service.ts`
- `server/v2/briefings/repository.ts`
- `server/v2/debriefings/routes.ts`
- `server/v2/debriefings/service.ts`
- `server/v2/debriefings/repository.ts`

### Client renderers

- `client/src/components/FormEditor.tsx`
- `client/src/components/GenericFormEditor.tsx`
- `client/src/components/FormEditorFactory.tsx`
- `client/src/modules/crew-pool/components/BriefingLiveSubmissionHost.tsx`
- `client/src/modules/crew-pool/components/DebriefingLiveSubmissionHost.tsx`
- `client/src/modules/recruitment/components/InterviewLiveSubmissionHost.tsx`

### Foundational migrations

- `migrations/0197_create_shared_configurable_forms_tables.sql`
- `migrations/0198_seed_shared_configurable_forms.sql`
- `migrations/0199_correct_shared_configurable_form_parts.sql`
- `migrations/0202_create_crew_briefing_submission_tables.sql`
- `migrations/0205_seed_missing_shared_form_skeletons.sql`
- `migrations/0208_link_briefing_submission_to_g1.sql`
- `migrations/0209_create_crew_interview_submissions.sql`
- `migrations/0211_create_crew_debriefing_submissions.sql`

---

## 19. Glossary

| Term | Meaning |
|---|---|
| Form | Stable definition for Interview, Briefing, or Debriefing |
| Form Part | High-level fixed or configurable area, such as Part A, B, or C |
| Rank Group | Group of ranks that share an applicable form version |
| Draft Version | Editable version not available for new operational submissions |
| Released Version | Published version available for runtime submission creation |
| Submission Root | Type-specific Interview, Briefing, or Debriefing record |
| Section State | Runtime progress and metadata for one submission section |
| Answer | Value and optional comment for one submission question |
| Version Pinning | Recording the exact form version used by a submission |
| Source Event | Interview item, G1 briefing, or G2 debriefing that initiated the form |
| Semantic Question Key | Stable identifier used to compare equivalent questions across versions |

---

## 20. Conclusion

The Form Engine provides a strong foundation for versioned, configurable operational forms. Its normalized template hierarchy, release workflow, exact version pinning, and long-form answers support current operations and future reporting.

The most important architectural improvement is to establish a common submission root, or at minimum a unified reporting layer, so shared answers and section states have one authoritative parent. Released-version immutability, normalized rank membership, typed analytics projections, and stable semantic question keys will make the platform easier to audit, scale, and analyze.
# Form Engine Architecture and Data Flow

**Document type:** System architecture and operational reference  
**Applies to:** Admin Forms Configuration, Recruitment Interviews, Crew Briefings, Crew Debriefings  
**Audience:** Product owners, operations teams, developers, database administrators, QA, reporting teams  
**Status:** Current-state architecture  
**Last reviewed:** 10 September 2026

---

## 1. Purpose

This document explains how the shared Form Engine is configured in Admin and used by the Recruitment and Crew Pool modules. It covers:

- Form creation and versioning
- Rank-based template selection
- Runtime creation of Interview, Briefing, and Debriefing submissions
- Candidate and crew binding
- Storage of sections, answers, comments, and signatures
- Architectural strengths and risks
- Requirements for future reporting and analytics

The Form Engine supports three operational form categories:

| Category | Operational module | Subject |
|---|---|---|
| Interview | Recruitment | Recruitment candidate and interview item |
| Briefing | Crew Pool | Crew member and G1 briefing event |
| Debriefing | Crew Pool | Crew member and G2 debriefing event |

---

## 2. Executive Summary

The Form Engine separates reusable form definitions from operational submissions.

![Form Engine Architecture Overview](diagrams/form-engine/architecture-overview.svg)

*Figure 1. Form Engine Architecture Overview.*

The main architectural principles are:

1. Admin edits draft versions rather than live operational submissions.
2. A runtime submission is pinned to an exact released form version.
3. Sections, questions, and options are normalized into relational tables.
4. Answers are stored in long-form records, one answer per submission and question.
5. Interview, Briefing, and Debriefing use separate submission root tables.
6. Shared answer and section-state tables use a polymorphic `submission_uuid`.

The template/version design is sound. The main structural risk is the absence of a common submission parent table and database-enforced foreign keys for some subject relationships.

---

## 3. System Context

![System Context](diagrams/form-engine/system-context.svg)

*Figure 2. System Context.*

---

## 4. Form Definition Model

### 4.1 Form skeleton

The system seeds one shared form for each operational category:

- Crew Briefing Form
- Crew Debriefing Form
- Crew Interview Form

Each uses the following general structure:

| Part | Purpose | Configuration model |
|---|---|---|
| Part A | Basic or operational information | Fixed |
| Part B | Briefing, Debriefing, or Interview questions | Configurable |
| Part C | Office follow-up or Interview comments | Fixed and office-oriented |

The configurable Part B is managed through the Admin Form Engine.

### 4.2 Configuration hierarchy

![Form Configuration Hierarchy](diagrams/form-engine/configuration-hierarchy.svg)

*Figure 3. Form Configuration Hierarchy.*

### 4.3 Configuration tables

#### `adm_forms_v2`

The base form record.

Primary responsibilities:

- Identifies the form and category
- Stores the stable form UUID
- Maintains current or legacy version metadata
- Stores lock and lifecycle information
- Provides the parent for versions and form parts

#### `frm_form_parts`

Defines the high-level parts of the form.

Relationship:

```text
frm_form_parts.form_uuid
    → adm_forms_v2.form_uuid
```

Important attributes:

- Part UUID
- Part code
- Part title
- Fixed or configurable type
- Office-only indicator
- Display order

#### `adm_rank_groups_v2`

Associates a form with groups of applicable ranks.

Important attributes:

- Rank-group UUID
- Parent form ID
- Rank-group name
- Serialized rank list
- Configuration
- Archive state

The rank list is currently stored as JSON text rather than through a normalized rank-group membership table.

#### `adm_available_ranks_v2`

Provides the Admin rank catalog used to populate rank selection controls. It is not directly related to rank groups through a database join table.

#### `adm_form_versions_v2`

Represents one editable or released version of a form for a rank group.

Important attributes:

- Version UUID
- Parent form
- Rank group
- Version number and date
- Status: draft or released
- Release timestamp
- Configuration and shared configuration
- Lifecycle and audit fields

#### `frm_sections`

Stores sections belonging to an exact form version.

Relationships:

```text
frm_sections.form_version_uuid
    → adm_form_versions_v2.fv_uuid

frm_sections.form_part_uuid
    → frm_form_parts.form_part_uuid
```

Section configuration can include:

- Code and title
- Display order
- Responsible role
- Applicable vessels
- Officer and seafarer comment requirements
- Officer and seafarer signature requirements
- Default option set
- Layout preference

#### `frm_questions`

Stores version-specific questions.

Relationship:

```text
frm_questions.section_uuid
    → frm_sections.section_uuid
```

Question configuration can include:

- Stable row UUID
- Question code
- Question text
- Response type
- Mandatory status
- Comment rules
- Option-set reference
- Display order

#### `frm_option_sets` and `frm_options`

Option sets belong to an exact form version. Individual selectable values belong to an option set.

```text
frm_option_sets.form_version_uuid
    → adm_form_versions_v2.fv_uuid

frm_options.option_set_uuid
    → frm_option_sets.option_set_uuid
```

---

## 5. Admin Form Creation and Release Flow

### 5.1 End-to-end sequence

![Admin Form Creation & Release](diagrams/form-engine/admin-creation-sequence.svg)

*Figure 4. Admin Form Creation & Release.*

### 5.2 Operational rules

1. A version is created for a form and rank group.
2. Only a draft version can be structurally edited.
3. A previous released structure can be copied into the new draft.
4. Structure replacement is transactional.
5. Runtime submission creation requires a released version.
6. Releasing a newer version does not automatically migrate existing submissions.

### 5.3 Primary Admin endpoints

| Purpose | Endpoint |
|---|---|
| List/create forms | `GET/POST /api/v2/admin/forms` |
| Read/update/delete form | `GET/PUT/DELETE /api/v2/admin/forms/:id` |
| List/create versions | `GET/POST /api/v2/admin/forms/:id/versions` |
| Read/update/delete version | `GET/PUT/DELETE /api/v2/admin/form-versions/:id` |
| Release version | `POST /api/v2/admin/form-versions/:id/release` |
| Read pinned configuration | `GET /api/v2/admin/form-versions/:versionId/configuration` |
| Read part structure | `GET /api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` |
| Replace part structure | `PUT /api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` |
| Replace complete structure | `PUT /api/v2/admin/form-versions/:fvUuid/structures` |
| Manage rank groups | `/api/v2/admin/rank-groups` |

---

## 6. Runtime Template Resolution

Runtime services resolve a form using operational context rather than accepting a browser-supplied form version as authority.

![Runtime Template Resolution](diagrams/form-engine/runtime-template-resolution.svg)

*Figure 5. Runtime Template Resolution.*

Rank resolution can consider literal and base-rank forms. A rank group with no released version cannot produce a runtime submission.

---

## 7. Runtime Submission Model

### 7.1 Shared model

![Shared Runtime Submission Model](diagrams/form-engine/runtime-submission-model.svg)

*Figure 6. Shared Runtime Submission Model.*

Each submission root stores:

- Its own submission UUID
- The applicable form UUID
- The exact form-version UUID
- Operational subject and source-event identifiers
- Status and completion information

The normalized template is referenced at runtime; it is not copied wholesale into the submission.

### 7.2 Section state

`frm_section_states` stores runtime progress for each applicable section.

Typical statuses:

- `not_started`
- `in_progress`
- `submitted`
- `not_applicable`

It can also store:

- Section comments
- Submitter information
- Submission timestamps
- Signature-related metadata

### 7.3 Answers

`frm_answers` stores one answer per submission and question.

Logical key:

```text
submission_uuid + question_uuid
```

Stored values include:

- Raw answer value
- Answer comment
- Audit metadata

Answer values are primarily stored as text. Multi-select answers can use serialized JSON.

### 7.4 Signatures

`frm_signature_attachments` stores signature-file metadata.  
`frm_section_signatures` links a signature attachment to a section-state record.

---

## 8. Recruitment Interview Flow

### 8.1 Binding model

![Recruitment Interview Candidate Binding](diagrams/form-engine/interview-binding.svg)

*Figure 7. Recruitment Interview Candidate Binding.*

### 8.2 Creation sequence

![Interview Submission Creation](diagrams/form-engine/interview-creation-sequence.svg)

*Figure 8. Interview Submission Creation.*

### 8.3 Interview root entity

`crew_interview_submissions` stores:

- `submission_uuid`
- `rec_can_uuid`
- `interview_item_uuid`
- `form_uuid`
- `form_version_uuid`
- Interview category and stage
- Status and completion timestamp
- Comments and audit metadata

The database enforces one submission per interview item. Candidate and interview-item relationships are also checked by the service, but are not fully represented by database foreign keys in the current migration model.

---

## 9. Crew Briefing Flow

### 9.1 Binding model

![Crew Briefing Binding](diagrams/form-engine/briefing-binding.svg)

*Figure 9. Crew Briefing Binding.*

### 9.2 Creation sequence

1. The service receives an authoritative G1 briefing UUID.
2. It loads the G1 record and its crew UUID.
3. It derives the operational rank and vessel context.
4. It resolves the applicable released Briefing version.
5. It creates `crew_briefing_submissions`.
6. It pins the form and version.
7. It initializes section-state records.

The Briefing submission has a unique, restrictive relationship to the originating G1 briefing record. The crew UUID remains a logical text relationship rather than a direct database foreign key to the crew master.

---

## 10. Crew Debriefing Flow

### 10.1 Binding model

![Crew Debriefing Binding](diagrams/form-engine/debriefing-binding.svg)

*Figure 10. Crew Debriefing Binding.*

### 10.2 Creation sequence

1. The service receives the G2 debriefing UUID.
2. It locks and loads the source debriefing record.
3. It determines the crew member and operational context.
4. It resolves the applicable released Debriefing version.
5. It creates `crew_debriefing_submissions`.
6. It initializes section states.
7. It enforces mandatory answers, comments, signatures, and section submission rules.

The root submission also stores Debriefing-specific information such as date, mode, office-review comments, reviewer, and review timestamp.

---

## 11. Entity Relationship Summary

![Form Engine Entity Relationships](diagrams/form-engine/entity-relationship.svg)

*Figure 11. Form Engine Entity Relationships.*

> **Important:** The diagram shows the logical submission relationships. The current schema does not provide a common submission parent foreign key from `frm_section_states` and `frm_answers`.

---

## 12. Data Ownership and Source of Truth

| Information | Source of truth |
|---|---|
| Form identity and category | `adm_forms_v2` |
| Form parts | `frm_form_parts` |
| Applicable rank grouping | `adm_rank_groups_v2` |
| Draft/released lifecycle | `adm_form_versions_v2` |
| Section structure | `frm_sections` |
| Question definition | `frm_questions` |
| Selectable options | `frm_option_sets`, `frm_options` |
| Candidate Interview binding | `crew_interview_submissions` |
| Crew Briefing binding | `crew_briefing_submissions` |
| Crew Debriefing binding | `crew_debriefing_submissions` |
| Runtime section status | `frm_section_states` |
| Runtime answers | `frm_answers` |
| Runtime signatures | `frm_signature_attachments`, `frm_section_signatures` |

Browser-supplied rank, form, role, or subject values must not be treated as authoritative where the server can resolve them from the operational source record.

---

## 13. Architecture Evaluation

### 13.1 Strengths

#### Normalized template structure

Sections, questions, option sets, and options are independently queryable. This supports validation, reuse, reporting, and controlled editing better than a single opaque JSON document.

#### Exact version pinning

Every new submission records the form and exact version used at creation. A later release does not rewrite historical submissions.

#### Draft and release lifecycle

Operational users consume released versions while Admin works on drafts. This provides a clear publication boundary.

#### Transactional structure replacement

Multi-table structure changes are applied transactionally, reducing partial-update risk.

#### Long-form answer storage

One answer per submission/question is suitable for question-level reporting and avoids wide, form-specific response tables.

#### Operational event uniqueness

Source-event uniqueness limits duplicate submissions for the same Interview item, G1 briefing, or G2 debriefing.

### 13.2 Risks and anti-patterns

#### Polymorphic submission UUID without a parent foreign key

`frm_section_states.submission_uuid` and `frm_answers.submission_uuid` can refer to three different root tables.

Risks:

- Orphan answers or states
- Incorrect cross-form joins
- More complex deletion and retention rules
- Weak database integrity
- Repeated `UNION ALL` logic in reports

#### Inconsistent subject foreign keys

Some source-event links are database-enforced, while candidate and crew UUIDs are often plain text validated only by services.

#### Rank-group membership stored as JSON text

The database cannot enforce valid ranks, prevent duplicates, or automatically preserve mappings when ranks are renamed.

#### Weakly typed answers

Text storage provides flexibility but requires response-type-aware parsing for numbers, dates, booleans, and multi-select values.

#### Potential historical definition drift

Historical submissions reference version-owned definitions. If a released definition is modified or soft-deleted incorrectly, historical display and reports can change.

#### Legacy and normalized configuration coexistence

Configuration JSON fields coexist with normalized structure tables. The normalized structure must remain the declared source of truth to avoid conflicting representations.

---

## 14. Reporting and Analytics Readiness

### 14.1 Reporting possible today

The current schema can support:

- Candidate and crew completion rates
- Completion duration
- Section progress and abandonment
- Question-level response distribution
- Mandatory-answer compliance
- Interview stage and category analysis
- Briefing and Debriefing trends by rank, vessel, and date
- Comment and signature completion
- Version-specific comparisons

Briefing already has a long-form reporting view. Equivalent standardized views are needed for Interview and Debriefing.

### 14.2 Current reporting join

![Reporting Data Join](diagrams/form-engine/reporting-join.svg)

*Figure 12. Reporting Data Join.*

### 14.3 Reporting limitations

- Three different root submission tables
- No common submission foreign key
- Text and JSON answer decoding
- No stable semantic question key across versions
- Inconsistent reporting views
- JSON-based rank-group membership
- Historical label changes can affect interpretation

---

## 15. Recommended Target Architecture

### 15.1 Common submission root

Introduce a common `frm_submissions` table.

![Recommended Common Submission Architecture](diagrams/form-engine/target-submission-architecture.svg)

*Figure 13. Recommended Common Submission Architecture.*

Suggested fields:

| Field | Purpose |
|---|---|
| `submission_uuid` | Common primary identifier |
| `submission_type` | Interview, Briefing, or Debriefing |
| `form_uuid` | Stable form |
| `form_version_uuid` | Exact pinned version |
| `subject_type` | Candidate or crew |
| `subject_uuid` | Candidate or crew UUID |
| `source_event_type` | Interview item, G1, or G2 |
| `source_event_uuid` | Authoritative operational event |
| `status` | Runtime status |
| `started_at` | Start timestamp |
| `completed_at` | Completion timestamp |
| Audit fields | Actor and timestamps |

This allows real foreign keys from section states and answers.

### 15.2 Unified reporting views

As an incremental step, create:

- `vw_form_submissions`
- `vw_form_submission_sections`
- `vw_form_submission_answers`

The common submission view can initially use `UNION ALL` across the existing root tables.

### 15.3 Stable semantic question identifiers

Add a cross-version key such as:

```text
INTERVIEW.COMMUNICATION_SKILLS
BRIEFING.SAFETY_EXPECTATIONS
DEBRIEFING.INCIDENT_FEEDBACK
```

Version-specific question UUIDs remain unique, while the semantic key supports trend analysis across versions.

### 15.4 Typed analytics projection

Retain the raw answer value and expose type-specific reporting columns:

- `answer_text`
- `answer_number`
- `answer_boolean`
- `answer_date`
- `answer_option_value`
- `answer_option_values_jsonb`

### 15.5 Normalized rank-group membership

Introduce an `adm_rank_group_ranks` table:

```text
rank_group_uuid
rank_uuid
```

This provides referential integrity and simplifies template coverage reporting.

### 15.6 Released-version immutability

Released sections, questions, option sets, and options should be immutable. Any semantic change should create a new draft and release.

---

## 16. Recommended Delivery Priorities

| Priority | Recommendation | Benefit |
|---|---|---|
| 1 | Add unified reporting views | Immediate consistent reporting |
| 2 | Add Interview and Debriefing long-form views | Feature parity with Briefing |
| 3 | Add stable semantic question keys | Cross-version trends |
| 4 | Enforce released-definition immutability | Reliable history and audit |
| 5 | Normalize rank-group membership | Better integrity and rank matching |
| 6 | Introduce common submission root | Strong relational integrity |
| 7 | Add typed analytics projections | Simpler and faster reporting |
| 8 | Add missing candidate/crew constraints | Prevent orphan subject links |

---

## 17. Operational Controls

The following controls should be maintained:

1. Only users with the appropriate Forms permission may create, edit, release, or delete configurations.
2. Runtime services must resolve subject, rank, and source event from server-controlled records.
3. Only released versions may create new submissions.
4. Submitted sections must remain read-only.
5. Mandatory answers, comments, and signatures must be validated server-side.
6. Every submission must retain its pinned form version.
7. Released definitions must not be edited in place.
8. Deletes must preserve historical submissions and reporting integrity.

---

## 18. Code and Schema Reference

### Admin Form Engine

- `server/v2/admin/routes.ts`
- `server/v2/admin/controllers/formsController.ts`
- `server/v2/admin/controllers/formStructureController.ts`
- `server/v2/admin/services/formsService.ts`
- `server/v2/admin/services/formStructureService.ts`
- `server/v2/admin/repositories/formsRepository.ts`
- `server/v2/admin/repositories/formVersionsRepository.ts`
- `server/v2/admin/repositories/formStructureRepository.ts`
- `shared/v2/admin/schema.ts`
- `shared/v2/forms-engine/schema.ts`

### Runtime services

- `server/v2/interviews/routes.ts`
- `server/v2/interviews/service.ts`
- `server/v2/interviews/repository.ts`
- `server/v2/briefings/routes.ts`
- `server/v2/briefings/service.ts`
- `server/v2/briefings/repository.ts`
- `server/v2/debriefings/routes.ts`
- `server/v2/debriefings/service.ts`
- `server/v2/debriefings/repository.ts`

### Client renderers

- `client/src/components/FormEditor.tsx`
- `client/src/components/GenericFormEditor.tsx`
- `client/src/components/FormEditorFactory.tsx`
- `client/src/modules/crew-pool/components/BriefingLiveSubmissionHost.tsx`
- `client/src/modules/crew-pool/components/DebriefingLiveSubmissionHost.tsx`
- `client/src/modules/recruitment/components/InterviewLiveSubmissionHost.tsx`

### Foundational migrations

- `migrations/0197_create_shared_configurable_forms_tables.sql`
- `migrations/0198_seed_shared_configurable_forms.sql`
- `migrations/0199_correct_shared_configurable_form_parts.sql`
- `migrations/0202_create_crew_briefing_submission_tables.sql`
- `migrations/0205_seed_missing_shared_form_skeletons.sql`
- `migrations/0208_link_briefing_submission_to_g1.sql`
- `migrations/0209_create_crew_interview_submissions.sql`
- `migrations/0211_create_crew_debriefing_submissions.sql`

---

## 19. Glossary

| Term | Meaning |
|---|---|
| Form | Stable definition for Interview, Briefing, or Debriefing |
| Form Part | High-level fixed or configurable area, such as Part A, B, or C |
| Rank Group | Group of ranks that share an applicable form version |
| Draft Version | Editable version not available for new operational submissions |
| Released Version | Published version available for runtime submission creation |
| Submission Root | Type-specific Interview, Briefing, or Debriefing record |
| Section State | Runtime progress and metadata for one submission section |
| Answer | Value and optional comment for one submission question |
| Version Pinning | Recording the exact form version used by a submission |
| Source Event | Interview item, G1 briefing, or G2 debriefing that initiated the form |
| Semantic Question Key | Stable identifier used to compare equivalent questions across versions |

---

## 20. Conclusion

The Form Engine provides a strong foundation for versioned, configurable operational forms. Its normalized template hierarchy, release workflow, exact version pinning, and long-form answers support current operations and future reporting.

The most important architectural improvement is to establish a common submission root, or at minimum a unified reporting layer, so shared answers and section states have one authoritative parent. Released-version immutability, normalized rank membership, typed analytics projections, and stable semantic question keys will make the platform easier to audit, scale, and analyze.
# Form Engine Architecture and Data Flow

**Document type:** System architecture and operational reference  
**Applies to:** Admin Forms Configuration, Recruitment Interviews, Crew Briefings, Crew Debriefings  
**Audience:** Product owners, operations teams, developers, database administrators, QA, reporting teams  
**Status:** Current-state architecture  
**Last reviewed:** 10 September 2026

---

## 1. Purpose

This document explains how the shared Form Engine is configured in Admin and used by the Recruitment and Crew Pool modules. It covers:

- Form creation and versioning
- Rank-based template selection
- Runtime creation of Interview, Briefing, and Debriefing submissions
- Candidate and crew binding
- Storage of sections, answers, comments, and signatures
- Architectural strengths and risks
- Requirements for future reporting and analytics

The Form Engine supports three operational form categories:

| Category | Operational module | Subject |
|---|---|---|
| Interview | Recruitment | Recruitment candidate and interview item |
| Briefing | Crew Pool | Crew member and G1 briefing event |
| Debriefing | Crew Pool | Crew member and G2 debriefing event |

---

## 2. Executive Summary

The Form Engine separates reusable form definitions from operational submissions.

![Form Engine Architecture Overview](diagrams/form-engine/architecture-overview.svg)

*Figure 1. Form Engine Architecture Overview.*

The main architectural principles are:

1. Admin edits draft versions rather than live operational submissions.
2. A runtime submission is pinned to an exact released form version.
3. Sections, questions, and options are normalized into relational tables.
4. Answers are stored in long-form records, one answer per submission and question.
5. Interview, Briefing, and Debriefing use separate submission root tables.
6. Shared answer and section-state tables use a polymorphic `submission_uuid`.

The template/version design is sound. The main structural risk is the absence of a common submission parent table and database-enforced foreign keys for some subject relationships.

---

## 3. System Context

![System Context](diagrams/form-engine/system-context.svg)

*Figure 2. System Context.*

---

## 4. Form Definition Model

### 4.1 Form skeleton

The system seeds one shared form for each operational category:

- Crew Briefing Form
- Crew Debriefing Form
- Crew Interview Form

Each uses the following general structure:

| Part | Purpose | Configuration model |
|---|---|---|
| Part A | Basic or operational information | Fixed |
| Part B | Briefing, Debriefing, or Interview questions | Configurable |
| Part C | Office follow-up or Interview comments | Fixed and office-oriented |

The configurable Part B is managed through the Admin Form Engine.

### 4.2 Configuration hierarchy

![Form Configuration Hierarchy](diagrams/form-engine/configuration-hierarchy.svg)

*Figure 3. Form Configuration Hierarchy.*

### 4.3 Configuration tables

#### `adm_forms_v2`

The base form record.

Primary responsibilities:

- Identifies the form and category
- Stores the stable form UUID
- Maintains current or legacy version metadata
- Stores lock and lifecycle information
- Provides the parent for versions and form parts

#### `frm_form_parts`

Defines the high-level parts of the form.

Relationship:

```text
frm_form_parts.form_uuid
    → adm_forms_v2.form_uuid
```

Important attributes:

- Part UUID
- Part code
- Part title
- Fixed or configurable type
- Office-only indicator
- Display order

#### `adm_rank_groups_v2`

Associates a form with groups of applicable ranks.

Important attributes:

- Rank-group UUID
- Parent form ID
- Rank-group name
- Serialized rank list
- Configuration
- Archive state

The rank list is currently stored as JSON text rather than through a normalized rank-group membership table.

#### `adm_available_ranks_v2`

Provides the Admin rank catalog used to populate rank selection controls. It is not directly related to rank groups through a database join table.

#### `adm_form_versions_v2`

Represents one editable or released version of a form for a rank group.

Important attributes:

- Version UUID
- Parent form
- Rank group
- Version number and date
- Status: draft or released
- Release timestamp
- Configuration and shared configuration
- Lifecycle and audit fields

#### `frm_sections`

Stores sections belonging to an exact form version.

Relationships:

```text
frm_sections.form_version_uuid
    → adm_form_versions_v2.fv_uuid

frm_sections.form_part_uuid
    → frm_form_parts.form_part_uuid
```

Section configuration can include:

- Code and title
- Display order
- Responsible role
- Applicable vessels
- Officer and seafarer comment requirements
- Officer and seafarer signature requirements
- Default option set
- Layout preference

#### `frm_questions`

Stores version-specific questions.

Relationship:

```text
frm_questions.section_uuid
    → frm_sections.section_uuid
```

Question configuration can include:

- Stable row UUID
- Question code
- Question text
- Response type
- Mandatory status
- Comment rules
- Option-set reference
- Display order

#### `frm_option_sets` and `frm_options`

Option sets belong to an exact form version. Individual selectable values belong to an option set.

```text
frm_option_sets.form_version_uuid
    → adm_form_versions_v2.fv_uuid

frm_options.option_set_uuid
    → frm_option_sets.option_set_uuid
```

---

## 5. Admin Form Creation and Release Flow

### 5.1 End-to-end sequence

![Admin Form Creation & Release](diagrams/form-engine/admin-creation-sequence.svg)

*Figure 4. Admin Form Creation & Release.*

### 5.2 Operational rules

1. A version is created for a form and rank group.
2. Only a draft version can be structurally edited.
3. A previous released structure can be copied into the new draft.
4. Structure replacement is transactional.
5. Runtime submission creation requires a released version.
6. Releasing a newer version does not automatically migrate existing submissions.

### 5.3 Primary Admin endpoints

| Purpose | Endpoint |
|---|---|
| List/create forms | `GET/POST /api/v2/admin/forms` |
| Read/update/delete form | `GET/PUT/DELETE /api/v2/admin/forms/:id` |
| List/create versions | `GET/POST /api/v2/admin/forms/:id/versions` |
| Read/update/delete version | `GET/PUT/DELETE /api/v2/admin/form-versions/:id` |
| Release version | `POST /api/v2/admin/form-versions/:id/release` |
| Read pinned configuration | `GET /api/v2/admin/form-versions/:versionId/configuration` |
| Read part structure | `GET /api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` |
| Replace part structure | `PUT /api/v2/admin/form-versions/:fvUuid/parts/:partUuid/structure` |
| Replace complete structure | `PUT /api/v2/admin/form-versions/:fvUuid/structures` |
| Manage rank groups | `/api/v2/admin/rank-groups` |

---

## 6. Runtime Template Resolution

Runtime services resolve a form using operational context rather than accepting a browser-supplied form version as authority.

![Runtime Template Resolution](diagrams/form-engine/runtime-template-resolution.svg)

*Figure 5. Runtime Template Resolution.*

Rank resolution can consider literal and base-rank forms. A rank group with no released version cannot produce a runtime submission.

---

## 7. Runtime Submission Model

### 7.1 Shared model

![Shared Runtime Submission Model](diagrams/form-engine/runtime-submission-model.svg)

*Figure 6. Shared Runtime Submission Model.*

Each submission root stores:

- Its own submission UUID
- The applicable form UUID
- The exact form-version UUID
- Operational subject and source-event identifiers
- Status and completion information

The normalized template is referenced at runtime; it is not copied wholesale into the submission.

### 7.2 Section state

`frm_section_states` stores runtime progress for each applicable section.

Typical statuses:

- `not_started`
- `in_progress`
- `submitted`
- `not_applicable`

It can also store:

- Section comments
- Submitter information
- Submission timestamps
- Signature-related metadata

### 7.3 Answers

`frm_answers` stores one answer per submission and question.

Logical key:

```text
submission_uuid + question_uuid
```

Stored values include:

- Raw answer value
- Answer comment
- Audit metadata

Answer values are primarily stored as text. Multi-select answers can use serialized JSON.

### 7.4 Signatures

`frm_signature_attachments` stores signature-file metadata.  
`frm_section_signatures` links a signature attachment to a section-state record.

---

## 8. Recruitment Interview Flow

### 8.1 Binding model

![Recruitment Interview Candidate Binding](diagrams/form-engine/interview-binding.svg)

*Figure 7. Recruitment Interview Candidate Binding.*

### 8.2 Creation sequence

![Interview Submission Creation](diagrams/form-engine/interview-creation-sequence.svg)

*Figure 8. Interview Submission Creation.*

### 8.3 Interview root entity

`crew_interview_submissions` stores:

- `submission_uuid`
- `rec_can_uuid`
- `interview_item_uuid`
- `form_uuid`
- `form_version_uuid`
- Interview category and stage
- Status and completion timestamp
- Comments and audit metadata

The database enforces one submission per interview item. Candidate and interview-item relationships are also checked by the service, but are not fully represented by database foreign keys in the current migration model.

---

## 9. Crew Briefing Flow

### 9.1 Binding model

![Crew Briefing Binding](diagrams/form-engine/briefing-binding.svg)

*Figure 9. Crew Briefing Binding.*

### 9.2 Creation sequence

1. The service receives an authoritative G1 briefing UUID.
2. It loads the G1 record and its crew UUID.
3. It derives the operational rank and vessel context.
4. It resolves the applicable released Briefing version.
5. It creates `crew_briefing_submissions`.
6. It pins the form and version.
7. It initializes section-state records.

The Briefing submission has a unique, restrictive relationship to the originating G1 briefing record. The crew UUID remains a logical text relationship rather than a direct database foreign key to the crew master.

---

## 10. Crew Debriefing Flow

### 10.1 Binding model

![Crew Debriefing Binding](diagrams/form-engine/debriefing-binding.svg)

*Figure 10. Crew Debriefing Binding.*

### 10.2 Creation sequence

1. The service receives the G2 debriefing UUID.
2. It locks and loads the source debriefing record.
3. It determines the crew member and operational context.
4. It resolves the applicable released Debriefing version.
5. It creates `crew_debriefing_submissions`.
6. It initializes section states.
7. It enforces mandatory answers, comments, signatures, and section submission rules.

The root submission also stores Debriefing-specific information such as date, mode, office-review comments, reviewer, and review timestamp.

---

## 11. Entity Relationship Summary

![Form Engine Entity Relationships](diagrams/form-engine/entity-relationship.svg)

*Figure 11. Form Engine Entity Relationships.*

> **Important:** The diagram shows the logical submission relationships. The current schema does not provide a common submission parent foreign key from `frm_section_states` and `frm_answers`.

---

## 12. Data Ownership and Source of Truth

| Information | Source of truth |
|---|---|
| Form identity and category | `adm_forms_v2` |
| Form parts | `frm_form_parts` |
| Applicable rank grouping | `adm_rank_groups_v2` |
| Draft/released lifecycle | `adm_form_versions_v2` |
| Section structure | `frm_sections` |
| Question definition | `frm_questions` |
| Selectable options | `frm_option_sets`, `frm_options` |
| Candidate Interview binding | `crew_interview_submissions` |
| Crew Briefing binding | `crew_briefing_submissions` |
| Crew Debriefing binding | `crew_debriefing_submissions` |
| Runtime section status | `frm_section_states` |
| Runtime answers | `frm_answers` |
| Runtime signatures | `frm_signature_attachments`, `frm_section_signatures` |

Browser-supplied rank, form, role, or subject values must not be treated as authoritative where the server can resolve them from the operational source record.

---

## 13. Architecture Evaluation

### 13.1 Strengths

#### Normalized template structure

Sections, questions, option sets, and options are independently queryable. This supports validation, reuse, reporting, and controlled editing better than a single opaque JSON document.

#### Exact version pinning

Every new submission records the form and exact version used at creation. A later release does not rewrite historical submissions.

#### Draft and release lifecycle

Operational users consume released versions while Admin works on drafts. This provides a clear publication boundary.

#### Transactional structure replacement

Multi-table structure changes are applied transactionally, reducing partial-update risk.

#### Long-form answer storage

One answer per submission/question is suitable for question-level reporting and avoids wide, form-specific response tables.

#### Operational event uniqueness

Source-event uniqueness limits duplicate submissions for the same Interview item, G1 briefing, or G2 debriefing.

### 13.2 Risks and anti-patterns

#### Polymorphic submission UUID without a parent foreign key

`frm_section_states.submission_uuid` and `frm_answers.submission_uuid` can refer to three different root tables.

Risks:

- Orphan answers or states
- Incorrect cross-form joins
- More complex deletion and retention rules
- Weak database integrity
- Repeated `UNION ALL` logic in reports

#### Inconsistent subject foreign keys

Some source-event links are database-enforced, while candidate and crew UUIDs are often plain text validated only by services.

#### Rank-group membership stored as JSON text

The database cannot enforce valid ranks, prevent duplicates, or automatically preserve mappings when ranks are renamed.

#### Weakly typed answers

Text storage provides flexibility but requires response-type-aware parsing for numbers, dates, booleans, and multi-select values.

#### Potential historical definition drift

Historical submissions reference version-owned definitions. If a released definition is modified or soft-deleted incorrectly, historical display and reports can change.

#### Legacy and normalized configuration coexistence

Configuration JSON fields coexist with normalized structure tables. The normalized structure must remain the declared source of truth to avoid conflicting representations.

---

## 14. Reporting and Analytics Readiness

### 14.1 Reporting possible today

The current schema can support:

- Candidate and crew completion rates
- Completion duration
- Section progress and abandonment
- Question-level response distribution
- Mandatory-answer compliance
- Interview stage and category analysis
- Briefing and Debriefing trends by rank, vessel, and date
- Comment and signature completion
- Version-specific comparisons

Briefing already has a long-form reporting view. Equivalent standardized views are needed for Interview and Debriefing.

### 14.2 Current reporting join

![Reporting Data Join](diagrams/form-engine/reporting-join.svg)

*Figure 12. Reporting Data Join.*

### 14.3 Reporting limitations

- Three different root submission tables
- No common submission foreign key
- Text and JSON answer decoding
- No stable semantic question key across versions
- Inconsistent reporting views
- JSON-based rank-group membership
- Historical label changes can affect interpretation

---

## 15. Recommended Target Architecture

### 15.1 Common submission root

Introduce a common `frm_submissions` table.

![Recommended Common Submission Architecture](diagrams/form-engine/target-submission-architecture.svg)

*Figure 13. Recommended Common Submission Architecture.*

Suggested fields:

| Field | Purpose |
|---|---|
| `submission_uuid` | Common primary identifier |
| `submission_type` | Interview, Briefing, or Debriefing |
| `form_uuid` | Stable form |
| `form_version_uuid` | Exact pinned version |
| `subject_type` | Candidate or crew |
| `subject_uuid` | Candidate or crew UUID |
| `source_event_type` | Interview item, G1, or G2 |
| `source_event_uuid` | Authoritative operational event |
| `status` | Runtime status |
| `started_at` | Start timestamp |
| `completed_at` | Completion timestamp |
| Audit fields | Actor and timestamps |

This allows real foreign keys from section states and answers.

### 15.2 Unified reporting views

As an incremental step, create:

- `vw_form_submissions`
- `vw_form_submission_sections`
- `vw_form_submission_answers`

The common submission view can initially use `UNION ALL` across the existing root tables.

### 15.3 Stable semantic question identifiers

Add a cross-version key such as:

```text
INTERVIEW.COMMUNICATION_SKILLS
BRIEFING.SAFETY_EXPECTATIONS
DEBRIEFING.INCIDENT_FEEDBACK
```

Version-specific question UUIDs remain unique, while the semantic key supports trend analysis across versions.

### 15.4 Typed analytics projection

Retain the raw answer value and expose type-specific reporting columns:

- `answer_text`
- `answer_number`
- `answer_boolean`
- `answer_date`
- `answer_option_value`
- `answer_option_values_jsonb`

### 15.5 Normalized rank-group membership

Introduce an `adm_rank_group_ranks` table:

```text
rank_group_uuid
rank_uuid
```

This provides referential integrity and simplifies template coverage reporting.

### 15.6 Released-version immutability

Released sections, questions, option sets, and options should be immutable. Any semantic change should create a new draft and release.

---

## 16. Recommended Delivery Priorities

| Priority | Recommendation | Benefit |
|---|---|---|
| 1 | Add unified reporting views | Immediate consistent reporting |
| 2 | Add Interview and Debriefing long-form views | Feature parity with Briefing |
| 3 | Add stable semantic question keys | Cross-version trends |
| 4 | Enforce released-definition immutability | Reliable history and audit |
| 5 | Normalize rank-group membership | Better integrity and rank matching |
| 6 | Introduce common submission root | Strong relational integrity |
| 7 | Add typed analytics projections | Simpler and faster reporting |
| 8 | Add missing candidate/crew constraints | Prevent orphan subject links |

---

## 17. Operational Controls

The following controls should be maintained:

1. Only users with the appropriate Forms permission may create, edit, release, or delete configurations.
2. Runtime services must resolve subject, rank, and source event from server-controlled records.
3. Only released versions may create new submissions.
4. Submitted sections must remain read-only.
5. Mandatory answers, comments, and signatures must be validated server-side.
6. Every submission must retain its pinned form version.
7. Released definitions must not be edited in place.
8. Deletes must preserve historical submissions and reporting integrity.

---

## 18. Code and Schema Reference

### Admin Form Engine

- `server/v2/admin/routes.ts`
- `server/v2/admin/controllers/formsController.ts`
- `server/v2/admin/controllers/formStructureController.ts`
- `server/v2/admin/services/formsService.ts`
- `server/v2/admin/services/formStructureService.ts`
- `server/v2/admin/repositories/formsRepository.ts`
- `server/v2/admin/repositories/formVersionsRepository.ts`
- `server/v2/admin/repositories/formStructureRepository.ts`
- `shared/v2/admin/schema.ts`
- `shared/v2/forms-engine/schema.ts`

### Runtime services

- `server/v2/interviews/routes.ts`
- `server/v2/interviews/service.ts`
- `server/v2/interviews/repository.ts`
- `server/v2/briefings/routes.ts`
- `server/v2/briefings/service.ts`
- `server/v2/briefings/repository.ts`
- `server/v2/debriefings/routes.ts`
- `server/v2/debriefings/service.ts`
- `server/v2/debriefings/repository.ts`

### Client renderers

- `client/src/components/FormEditor.tsx`
- `client/src/components/GenericFormEditor.tsx`
- `client/src/components/FormEditorFactory.tsx`
- `client/src/modules/crew-pool/components/BriefingLiveSubmissionHost.tsx`
- `client/src/modules/crew-pool/components/DebriefingLiveSubmissionHost.tsx`
- `client/src/modules/recruitment/components/InterviewLiveSubmissionHost.tsx`

### Foundational migrations

- `migrations/0197_create_shared_configurable_forms_tables.sql`
- `migrations/0198_seed_shared_configurable_forms.sql`
- `migrations/0199_correct_shared_configurable_form_parts.sql`
- `migrations/0202_create_crew_briefing_submission_tables.sql`
- `migrations/0205_seed_missing_shared_form_skeletons.sql`
- `migrations/0208_link_briefing_submission_to_g1.sql`
- `migrations/0209_create_crew_interview_submissions.sql`
- `migrations/0211_create_crew_debriefing_submissions.sql`

---

## 19. Glossary

| Term | Meaning |
|---|---|
| Form | Stable definition for Interview, Briefing, or Debriefing |
| Form Part | High-level fixed or configurable area, such as Part A, B, or C |
| Rank Group | Group of ranks that share an applicable form version |
| Draft Version | Editable version not available for new operational submissions |
| Released Version | Published version available for runtime submission creation |
| Submission Root | Type-specific Interview, Briefing, or Debriefing record |
| Section State | Runtime progress and metadata for one submission section |
| Answer | Value and optional comment for one submission question |
| Version Pinning | Recording the exact form version used by a submission |
| Source Event | Interview item, G1 briefing, or G2 debriefing that initiated the form |
| Semantic Question Key | Stable identifier used to compare equivalent questions across versions |

---

## 20. Conclusion

The Form Engine provides a strong foundation for versioned, configurable operational forms. Its normalized template hierarchy, release workflow, exact version pinning, and long-form answers support current operations and future reporting.

The most important architectural improvement is to establish a common submission root, or at minimum a unified reporting layer, so shared answers and section states have one authoritative parent. Released-version immutability, normalized rank membership, typed analytics projections, and stable semantic question keys will make the platform easier to audit, scale, and analyze.
