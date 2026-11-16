# Admin KPI settings

## Scope and editing
Admin > KPIs follows Approval Workflow's visual tree/detail pattern without
changing or extracting any Approval Workflow component. The reference image's
other groups/counts are not configuration requirements.

The sole group is **Training & Retention**:

| KPI | Components | Direction | Unit | Period basis |
| --- | --- | --- | --- | --- |
| Retention Rate | Senior Officers; Officers; Ratings | minimum | percentage | annual percentage |
| Alcohol violations | Overall | maximum | count | annual count |
| Drug violations | Overall | maximum | count | annual count |

Select a KPI and year, choose Edit, enter targets and Save. Empty means no
target, not zero. Clear an input and save to remove its value; a deliberately
entered zero persists as zero. Retention components and years are independent.
Percentage targets permit 0–100 including fractions; count targets must be
non-negative whole numbers. Decimal inputs are exact strings (up to 15 integer
digits and six decimal places), normalized before persistence and comparison.
Changing KPI/year or cancelling asks before discarding unsaved changes.
Conflicting writes refuse with a reload instruction rather than overwrite.

No Dashboard display, actual calculation or Reports behavior is changed.

## Storage and installation
Four tenant-local tables: `kpi_definitions`, `kpi_components`,
`kpi_target_years`, `kpi_target_values`. Definitions explicitly store direction,
unit, calculation key/version and period basis; these are not inferred from labels.
The current catalogue identifies existing calculations as:

- `crew_retention`, version `1`: the existing retention endpoint's formula,
  exclusion categories, period-boundary average headcount and rank-band selection.
- `da_personnel_alcohol_violations` / `da_personnel_drug_violations`, version `1`:
  the existing Dashboard D&A service's filtered, deduplicated violating personnel
  occurrences, not Report form counts.

These identifiers document existing semantics; they do not introduce new
calculations. Future formula changes require deliberate versioning.

Target years are unique per KPI/year/company scope; components are unique per
definition/code. Composite foreign keys prevent attaching a component to another
KPI's year, and a database trigger enforces percentage/count units, including
direct inserts. Values use PostgreSQL NUMERIC, not floating point. No value row
means no target. Header revisions provide optimistic concurrency; a
tenant-local transaction advisory lock serializes initial inserts and updates.

Migration 0270 was first prepared as
`.local/pending-migrations/0270_kpi_targets.sql.pending`, outside startup scans.
Read-only preflight captured all 271 development tables' counts/fingerprints,
columns and relevant menu/ledger state before watched server edits. Promotion
preserved SHA-256
`c0501514401e092e7f22c86feca8ec0d751968043c05e0a220b8429424ac855d`.
It creates the four tables, three definitions, five components and KPIs menu,
but no target/year/grant rows.

0271 separately registers the action in the existing permission catalogue.
It was staged outside scans after checking post-0270 fingerprints; 0270 was
already applied and was not edited. No action grant is seeded.

Rollback is not an automatic destructive down migration. Removing tables after
targets/audit facts exist would discard configuration/provenance and requires a
separate reviewed preservation decision. Deleting the action is refused while
grants reference it by the existing RESTRICT foreign key.

## Permissions and audit
KPIs View follows normal Admin menu authorization. **Set KPI targets** is a
separate `kpi_targets/set` action against the trusted parent role UUID, default
off. Every target write rechecks View plus the explicit action server-side,
inside the transaction; Access Control management does not imply it. Assigning
the action still requires existing Access Control management. It participates
in the same atomic grid/Company Forms/deployment-override role save; omission by
an old client preserves the existing KPI decision.

Target changes and their append-only audit event commit or roll back together.
Identity and time are server-derived, and browser identity/time/authority fields
are rejected. Each event freezes actor name, KPI and component labels, direction,
unit, year, company scope, and before/after values including null for removal.
No-op or decimal-format-only saves do not change the revision, last-change line
or audit. Full history remains in Access audit history with unchanged access.

The KPI/year read returns only the newest matching target-change event's frozen
name/time, deterministically ordered by event time then event ID. Below its
targets, the panel shows “Last changed by [name] on [date]”. No event means no
line. A real clearing event still appears after all values are removed.
The summary is available to KPI editors without Access Control rights; it
does not expose raw actors, other years/KPIs, grants or unrelated audit history.

## Deliberate retention overlap
Senior Officers and Officers are **not mutually exclusive**. A rank marked as
both counts in both retention calculations, deliberately following **TMSA 2.4**
(senior officer retention) and **TMSA 3.4** (all officers, including senior
officers). Do not “fix” this by excluding senior officers from Officers.
Only an explanatory source comment was added; the calculation is unchanged.

## Reports alignment assessment — no implementation
Dashboard is the correct definition in each of these cases:

1. **Promotions.** Dashboard requires completed status AND confirmation Yes;
   Reports currently requires completed status and a recorded promotion date.
   Align by adding the same confirmed-Yes eligibility and matching date/status
   normalization. The change is small, but historical completed rows without
   confirmation will disappear; regression counts and date boundaries must be
   verified. Sources: `CrewPromotionsRankChart.tsx:189–227` and
   `reports/handlers/promotions.ts:78–98`.
2. **Appraisals.** Dashboard averages eligible stage-2-submitted appraisals,
   using period end, usable numeric rating and canonical rank grouping.
   Reports averages non-deleted/date-filtered rows without the same submission
   condition. Align the stage interpretation, date selection, canonical ranks
   and numeric handling; do not assume a single status string is equivalent.
   Moderate risk: both counts and averages change, including historical drafts
   and multi-stage records. Sources: `CrewAppraisalsRankChart.tsx:205–255` and
   `reports/handlers/appraisals.ts:105–167`.
3. **D&A.** Dashboard counts filtered violating personnel occurrences,
   deduplicated per form/crew; one occurrence may contribute to both alcohol
   and drug figures. Reports returns one row per violating test form. Reuse
   the shared personnel filter/count definition, then explicitly decide whether
   report rows become occurrences or retain form rows with separate occurrence
   totals. This is not a one-line COUNT replacement: exports, pagination,
   drilldown and consumer assumptions about row grain need review.
   Sources: `drugs-alcohol/services/testRecordsService.ts:366–382,483–537` and
   `reports/handlers/drugAlcohol.ts:55–127`.

No Reports handler or Dashboard code is aligned or modified in this task.

## Verification policy
Automated tests and saved-target/browser audit evidence use the identity-verified
isolated test database and its own backend, never development. The read-only
development evidence script compares every existing table's contents and lists
the required migration/catalogue/menu/ledger writes separately. No development
target values, years or grants are created for evidence.
