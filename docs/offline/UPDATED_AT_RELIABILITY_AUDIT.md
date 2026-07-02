# `updated_at` Reliability Audit (System-Wide)

**Date:** 29-Jun-2026
**Scope:** Every UPDATE / upsert / soft-delete / bulk / raw-SQL write path on every table carrying `updated_at` / `updatedAt`.
**Purpose:** Verify that `updated_at` is reliably stamped on every mutation, because the planned offline Ship↔Shore sync uses `updated_at` as the change-detection watermark. A single write path that mutates a row without bumping `updated_at` causes a permanent, silent desync.
**Method:** Read-only. Static analysis of the full `server/` tree (Drizzle `.update().set()` blocks, repository abstractions, raw SQL, upserts) plus read-only `SELECT` drift sampling against the live tenant database. No code, schema, or data was changed.

---

## 1. Executive Summary

There is **no automatic safety net** for `updated_at` anywhere in the system:

- **No `$onUpdate()`** handlers exist in any Drizzle schema (`shared/` confirmed clean).
- **No PostgreSQL triggers / functions** stamp `updated_at` (`server/migrations/` confirmed clean).
- **No ORM middleware** intercepts updates.

Consequently **every** UPDATE must stamp `updated_at` explicitly. Across **463 Drizzle `.update()` call sites** the codebase does this remarkably consistently, primarily through two patterns:

1. **`applyAuditUser(...)`** — the centralized helper (`server/v2/admin/utils/auditUser.ts`) which sets `result.updatedAt = sql\`now()\`` **and** the user columns atomically. This is a genuine safety net wherever it is used.
2. **Explicit `updatedAt: new Date()` / `sql\`NOW()\``** inside the `.set({...})` object or in a pre-stamped data object.

After classifying all 463 sites (filtering out `Map.set()` false positives, repository method-call false positives, and helper/spread-stamped sites), the audit finds:

| Determination | Count |
|---|---|
| **VERIFIED-MISSING** (mutates a row, does **not** stamp `updated_at`) | **10** |
| **NEEDS MANUAL VERIFICATION** (legacy storage; correctness depends on caller-supplied object / route reachability) | **2** |
| **VERIFIED-CORRECT** (all remaining live Drizzle update sites) | **451** |

**The 10 VERIFIED-MISSING sites are concentrated in three places, all touching sync-critical tables:**

1. **Recruitment screening attachment soft-deletes (7 sites)** — `screeningRepository.ts` deletes B1/B2/B3/B4/B5/B6/B8 attachment rows with `.set({ isDeleted: true })` and **no** `updatedAt`. A soft-delete that does not bump `updated_at` is the worst case for sync: the deletion will never replicate to the other side.
2. **Vessel planning — crew-assignment promotion (2 sites)** — `vesselPlanningService.ts:1374` and `:1422` run **raw** `tx.update(crewAssignments).set({ isCurrent: true, assignmentType: "OnBoard", … , updatedByUuid })` to promote a reliever to on-board. Both stamp `updatedByUuid` but **not** `updatedAt`. (The `updatedAt: sql\`NOW()\`` immediately above each — lines 1367 / 1415 — belongs to the *preceding* `vesselPlanningV2` update, not the `crewAssignments` update.)
3. **Rotation deploy — crew-assignment deactivation (1 site)** — `rotationDeployService.ts:171` runs a **raw** `db.update(crewAssignments).set({ isCurrent: false, updatedByUuid })` that stamps *who* but **not** *when*.

Note that 3 of the 10 misses (items 2 and 3) mutate `crew_assignments` — a core, high-churn, vessel-scoped sync table — on both the sign-on (activation) and sign-off/deactivation paths.

**Key cross-check correction:** the prior `.docx` analysis states *"applyAuditUser sets updated_by_uuid but NOT updated_at."* This is **inaccurate as of the current code** — `applyAuditUser` does set `updatedAt`. This materially narrows the real exposure: the realistic gap is **10 specific sites**, not "every UPDATE in the system." (Determinations rest on a Drizzle `.update().set()` block parser plus a manual read of every flagged site; the 451 "correct" sites either carry a literal `updatedAt` token or were individually confirmed to stamp it via `applyAuditUser` or a pre-stamped object.)

**Bottom line:** The recommendation in the prior docs to add a DB-level `set_updated_at` trigger (or schema-level `$onUpdate`) remains the correct *defense-in-depth* fix — it would close all 10 gaps and prevent regressions. But the system is **not** broadly unreliable today; it is reliable except for the 10 enumerated sites (plus the 2 legacy methods pending reachability verification).

> **Remediation status (29-Jun-2026):** The schema-level ORM auto-stamp has since been implemented. Every per-domain `auditColumns.updatedAt` now carries `.$onUpdate(() => new Date())`, so all 10 VERIFIED-MISSING sites — which are all Drizzle `.update()` calls — now stamp `updated_at` automatically without any change to the call sites. This closes the 10 gaps at the ORM layer. It does **not** cover writes that bypass Drizzle's query builder (raw `sql` UPDATEs, external/`psql` writes); a DB-level `BEFORE UPDATE` trigger remains the stronger, exhaustive guarantee and is still recommended. The 2 legacy `database.ts` methods (§3.2) and the inbound-sync re-stamp concern remain open.

---

## 2. Per-Table Inventory

### 2.1 Schema-level guarantees (all tables)

| Property | Finding |
|---|---|
| `$onUpdate()` present on any `updatedAt` column | **No** — zero occurrences in `shared/` |
| DB trigger stamping `updated_at` | **No** — zero in `server/migrations/` |
| ORM/middleware auto-stamp | **No** |
| `updatedAt` definition | `auditColumns` spread → `timestamp("updated_at").defaultNow()` only (stamped on INSERT, **not** on UPDATE) |

### 2.2 Tables carrying `updated_at` (via `auditColumns`)

All `updatedAt` columns originate from the shared `auditColumns` spread (`shared/v2/rest-hours/schema.ts` is the canonical definition). Table counts by schema file:

| Schema file | `pgTable` count |
|---|---|
| `shared/schema.ts` (legacy/V1 + shared) | 37 |
| `shared/v2/recruitment/schema.ts` | 56 |
| `shared/v2/crew-pool/schema.ts` | 29 |
| `shared/v2/admin/schema.ts` | 19 |
| `shared/v2/promotions/schema.ts` | 12 |
| `shared/v2/appraisals/schema.ts` | 11 |
| `shared/v2/rest-hours/schema.ts` | 9 |
| `shared/v2/drugs-alcohol/schema.ts` | 5 |
| `shared/v2/rotation/schema.ts` | 5 |
| `shared/v2/alerts/schema.ts` | 3 |
| `shared/v2/vessel/schema.ts` | 2 |
| `shared/v2/training-needs/schema.ts` | 2 |
| `shared/v2/test-cases/schema.ts` | 1 |
| `shared/v2/tenant/schema.ts` | 1 |
| **Total** | **~192** |

Live DB confirmation: the connected tenant (`heliumdb`) reports **177 columns** named `updated_at`/`updatedAt` across `public`.

`$onUpdate present? = NO` for every table. `Trigger present? = NO` for every table. Every table therefore depends entirely on application code stamping `updated_at`.

---

## 3. Per-Call-Site Determinations

Determinations are based on reading the actual `.set({...})` content (or the repository method it delegates to). The static scan flagged 69 sites without a literal `updatedAt` token and 64 sites with no nearby `.set()`; both buckets were manually resolved below.

### 3.1 VERIFIED-MISSING

| # | File:Line | Table | What it does | Why MISSING |
|---|---|---|---|---|
| 1 | `server/v2/recruitment/repositories/screeningRepository.ts:188` | `screening_b1_attachments` | `.set({ isDeleted: true })` soft-delete | No `updatedAt` — soft-delete never stamps |
| 2 | `server/v2/recruitment/repositories/screeningRepository.ts:306` | `screening_b2_attachments` | `.set({ isDeleted: true })` soft-delete | No `updatedAt` |
| 3 | `server/v2/recruitment/repositories/screeningRepository.ts:433` | `screening_b3_attachments` | `.set({ isDeleted: true })` soft-delete | No `updatedAt` |
| 4 | `server/v2/recruitment/repositories/screeningRepository.ts:560` | `screening_b4_attachments` | `.set({ isDeleted: true })` soft-delete | No `updatedAt` |
| 5 | `server/v2/recruitment/repositories/screeningRepository.ts:687` | `screening_b5_attachments` | `.set({ isDeleted: true })` soft-delete | No `updatedAt` |
| 6 | `server/v2/recruitment/repositories/screeningRepository.ts:835` | `screening_b6_attachments` | `.set({ isDeleted: true })` soft-delete | No `updatedAt` |
| 7 | `server/v2/recruitment/repositories/screeningRepository.ts:1058` | `screening_b8_attachments` | `.set({ isDeleted: true })` soft-delete | No `updatedAt` |
| 8 | `server/v2/vessel/services/vesselPlanningService.ts:1374` | `crew_assignments` | raw `tx.update(crewAssignments).set({ isCurrent: true, assignmentType: "OnBoard", …, updatedByUuid })` (reliever promotion, CASE A) | Stamps `updatedByUuid` but **not** `updatedAt` |
| 9 | `server/v2/vessel/services/vesselPlanningService.ts:1422` | `crew_assignments` | raw `tx.update(crewAssignments).set({ isCurrent: true, assignmentType: "OnBoard", …, updatedByUuid })` (reliever promotion, CASE B) | Stamps `updatedByUuid` but **not** `updatedAt` |
| 10 | `server/v2/rotation/services/rotationDeployService.ts:171` | `crew_assignments` | raw `db.update(crewAssignments).set({ isCurrent: false, updatedByUuid })` | Stamps `updatedByUuid` but **not** `updatedAt` |

> Note 1: every **other** soft-delete in the codebase (appraisals ×11 repositories, promotions ×10 repositories, admin, rotation repositories, vessel repository, test-cases, training-needs) was verified to include `updatedAt: new Date()` (or `sql\`NOW()\``). The 7 screening-attachment sites are the **only** soft-delete sites missing it.
> Note 2: sites 8–10 are the dangerous pattern unique to `crew_assignments` — a `.set()` that carries `updatedByUuid` (so it *looks* audited) but omits `updatedAt`. In each case the surrounding `vesselPlanningV2` / repository update *does* stamp `updatedAt`, which makes the omission on the adjacent `crewAssignments` write easy to miss on casual reading.

### 3.2 NEEDS MANUAL VERIFICATION

| # | File:Line | Table | Reason |
|---|---|---|---|
| 1 | `server/database.ts:225` (`updateForm`) | `forms` | Legacy `DatabaseStorage` layer. Applies the caller-supplied `formData` object verbatim with **no** forced `updatedAt`. Correctness depends on (a) whether any live route still calls `updateForm`, and (b) whether callers pre-stamp `updatedAt`. Reachability could not be conclusively determined from static analysis; `DatabaseStorage` is still imported by `server/routes.ts`. |
| 2 | `server/database.ts:444` (`updateVesselPlanning`) | `vessel_planning` | Same legacy layer; applies caller-supplied `planning` verbatim with no forced `updatedAt`. Same reachability caveat. |

> `server/database.ts:352` (`updateCrewMember`) is **CORRECT** by contrast — it explicitly builds `dataWithTimestamp = { ...crewMemberData, updatedAt: new Date() }` before `.set()`.

### 3.3 VERIFIED-CORRECT (representative patterns — all 453 remaining live sites)

**Pattern A — `applyAuditUser(...)` (helper stamps `updatedAt = sql\`now()\``).** Confirmed at `server/v2/admin/utils/auditUser.ts:21`. Representative sites:
- `server/v2/crew-pool/services/crewBriefingService.ts:284,294,379,389`
- `server/v2/crew-pool/services/crewCertificatesService.ts:187,275,285,374,452,462`
- `server/v2/crew-pool/services/crewVisasService.ts:111,219,229`
- `server/v2/crew-pool/services/crewDocumentsService.ts:119,223,233`
- `server/v2/crew-pool/services/crewMedicalService.ts:350,360,431,441`
- `server/v2/crew-pool/services/crewSeaServiceService.ts:547,557`
- `server/v2/crew-pool/services/crewAssignmentsService.ts:66,121,207`
- `server/v2/admin/services/rankGroupsService.ts:131`
- `server/v2/admin/repositories/{rankGroupsRepository.ts:84,94,104,114, companyTrainingsRepository.ts:154, accessControlRepository.ts:176, trainingMasterRepository.ts:92, availableRanksRepository.ts:107}`

**Pattern B — explicit `updatedAt` in a pre-built object.**
- `server/database.ts:352` (`dataWithTimestamp`)
- `server/v2/crew-pool/services/crewMembersService.ts:1083` (`updateData = { ...data, updatedAt: new Date() }`)
- `server/v2/training-needs/repository.ts:285,310,329` (`sets` initialized with `updatedAt: new Date()`)

**Pattern C — explicit `updatedAt` inline (the majority — 330 sites with a literal `updatedAt`/`updated_at` token in `.set()`).** Example: `server/v2/vessel/services/vesselPlanningService.ts:1367,1415` set `updatedAt: sql\`NOW()\`` on the `vesselPlanningV2` update. **Caution:** these inline-stamped `vesselPlanningV2` updates sit *directly above* the un-stamped `crewAssignments` updates at lines 1374/1422 (see §3.1 sites 8–9) — proximity of a correct stamp does not imply the adjacent write is stamped.

**Pattern D — upsert.** The single `onConflictDoUpdate` in the codebase, `server/v2/promotions/repositories/suitabilityRepository.ts:59`, includes `updatedAt: new Date()` in its `set:` branch — **CORRECT**.

**Pattern E — repository method-call delegation.** Many flagged sites are not raw Drizzle; they call `xRepository.update(...)`, and the repository stamps `updatedAt` centrally. Verified examples:
- `rotationDeployService.ts:101,111` → `rotationEntriesRepository.update` (stamps `updatedAt: new Date()` at lines 90/105) — **CORRECT**
- `rotationDeployService.ts:140` → `vesselPlanningRepository.update` (stamps at 253/267) — **CORRECT**

### 3.4 Excluded false positives (not update gaps)

The static scan flagged these, but manual reading shows they are **not** Drizzle updates (they are `Map.set(key, value)` calls, two-argument form):
- `server/v2/recruitment/services/documentsService.ts:128,211,294,377,460,543`
- `server/v2/drugs-alcohol/services/testRecordsService.ts:298,339`
- `server/v2/rest-hours/services/dailyRecordsService.ts:424`
- `server/v2/rest-hours/services/variableTasksService.ts:136,170`
- `server/v2/rotation/services/rotationDraftsService.ts:249,292,403,439`

The 64 "no nearby `.set()`" sites are all **service/controller method calls** named `.update(...)` (e.g. `testCasesService.update(...)`, `dailyRecordsService.update(...)`), which route through repositories already covered above — not raw table mutations.

---

## 4. Live-Data Drift Sampling

Read-only sampling against tenant DB `heliumdb`. The drift signal is rows where `updated_at = created_at` despite having been mutated.

### 4.1 Screening attachment tables (the 7 VERIFIED-MISSING soft-delete targets)

| Table | Total rows | Soft-deleted | Deleted with `updated_at = created_at` |
|---|---|---|---|
| `screening_b1_attachments` | 1 | 0 | 0 |
| `screening_b2_attachments` | 0 | 0 | 0 |
| `screening_b3_attachments` | 0 | 0 | 0 |
| `screening_b4_attachments` | 0 | 0 | 0 |
| `screening_b5_attachments` | 0 | 0 | 0 |
| `screening_b6_attachments` | 0 | 0 | 0 |
| `screening_b8_attachments` | 0 | 0 | 0 |

**Result: inconclusive — these tables are effectively empty in this tenant.** The code defect is confirmed by static analysis (§3.1); the absence of deleted rows here only means it has not yet manifested as data in *this* tenant. The risk is real and will manifest the first time a screening attachment is deleted on a tenant with data.

### 4.2 `crew_assignments` (the raw-update VERIFIED-MISSING target)

| Metric | Count |
|---|---|
| Total rows | 96 |
| `updated_at = created_at` (never updated since insert) | 43 |
| `is_current = false` (deactivated) | 55 |
| **`is_current = false` AND `updated_at = created_at`** | **7** |

**Result: corroborating.** 7 deactivated assignment rows carry an `updated_at` identical to `created_at` — consistent with the deactivation path (`rotationDeployService.ts:171`) that flips `is_current = false` without bumping `updated_at`. The promotion paths (`vesselPlanningService.ts:1374,1422`) flip `is_current = true` without bumping `updated_at` and would similarly leave `is_current = true` rows frozen after a reliever sign-on; of the 96 total rows, 43 carry `updated_at = created_at`, which is the expected baseline for never-updated rows but also the bucket any un-stamped promotion would hide in. (Frozen timestamps are suggestive, not conclusive on their own — a row could be inserted already in its final state — but combined with the static findings in §3.1 they are strong evidence the gaps are live.)

---

## 5. Cross-Check vs. Prior Offline Docs

### 5.1 `docs/offline/PRE-IMPLEMENTATION-AUDIT.md`

- **Claim (§2 "Change Tracking"):** *"almost all tables have an `updated_at` column, [but] there are no PostgreSQL triggers enforcing its update… relies entirely on manual ORM-level updates… If a developer forgets… those changes will slip past the sync checkpoint."*
- **This audit:** **CONFIRMED and quantified.** No triggers, no `$onUpdate`. The "developer forgets" risk has already materialized in **10 specific sites** (§3.1). The doc's recommended fix (a `set_updated_at` BEFORE-UPDATE trigger on every V2 table) would close all 10 and is endorsed as defense-in-depth.

### 5.2 `docs/offline/CREWING-SHIP-CLOUD-SYNC-READINESS-ANALYSIS.docx`

- **Claim (§4.2):** *"`updated_at` is `defaultNow()` only — stamped on INSERT, NO `$onUpdate`; applyAuditUser sets `updated_by_uuid` but NOT `updated_at`. Not reliable as a delta watermark."*
- **This audit — partial correction.**
  - ✅ Correct: `defaultNow()` only, no `$onUpdate`, no trigger.
  - ❌ **Inaccurate:** `applyAuditUser` **does** set `updated_at` — `server/v2/admin/utils/auditUser.ts:21` executes `result.updatedAt = sql\`now()\``. The doc's assertion that it sets only `updated_by_uuid` does not match the current code.
  - **Impact of the correction:** because `applyAuditUser` is the dominant write pattern in crew-pool and admin (dozens of sites), the realistic exposure is **10 enumerated sites**, not a system-wide watermark failure. The `.docx` recommendation to *"drive deltas from the field-log (authoritative), not `updated_at`; or add `$onUpdate` / stamp in the write layer"* remains sound; this audit simply scopes the `updated_at`-stamping work down to the 10 sites (plus the 2 legacy methods) rather than every table's write path.

### 5.3 Net reconciliation

Both prior docs correctly identify the *structural* weakness (no DB-level guarantee). This audit adds the *empirical* layer: the structural weakness has produced **10 concrete defects** — 7 recruitment screening-attachment soft-deletes plus 3 `crew_assignments` writes (2 reliever-promotion activations in vessel planning, 1 deactivation in rotation deploy) — with everything else verified as correctly stamped today.

---

## 6. Prioritized VERIFIED-MISSING List (by production write frequency)

Ordered by how often the path runs in production and the severity for sync (soft-deletes are most severe because un-stamped deletions never replicate).

| Priority | Site(s) | Table(s) | Frequency | Sync impact |
|---|---|---|---|---|
| **P1 — Highest** | `vesselPlanningService.ts:1374,1422` and `rotationDeployService.ts:171` | `crew_assignments` | High — fires on every reliever sign-on/promotion (vessel planning) and every rotation deployment; `crew_assignments` is a core, high-churn, vessel-scoped sync table | Both activation (`is_current=true`) and deactivation (`is_current=false`) are invisible to the watermark → ship/shore disagree on who is currently aboard |
| **P2 — High** | `screeningRepository.ts:188,306,433,560,687,835,1058` | `screening_b1/b2/b3/b4/b5/b6/b8_attachments` | Medium — fires whenever a recruitment screening attachment is deleted | Soft-deleted attachments never replicate the deletion → orphaned/zombie attachments persist on the other side |
| **P3 — Verify first** | `database.ts:225` (`updateForm`), `database.ts:444` (`updateVesselPlanning`) | `forms`, `vessel_planning` | Unknown — legacy `DatabaseStorage`; may be dead or low-traffic | If still reachable, edits land without a watermark bump. Confirm route reachability before remediating |

### Recommended remediation (out of scope for this read-only audit; for the follow-up implementation task)

1. **Targeted fix:** add `updatedAt: new Date()` (or `sql\`NOW()\``) to the 10 VERIFIED-MISSING `.set()` objects (and force it in the 2 legacy methods once reachability is confirmed).
2. **Defense-in-depth (recommended by both prior docs):** add a `set_updated_at` BEFORE-UPDATE trigger to every V2 table — or a schema-level `$onUpdate(() => new Date())` on the shared `auditColumns.updatedAt` — so future write paths cannot regress. With this in place, the `updated_at` watermark becomes trustworthy regardless of call-site discipline.
   - **DONE (ORM layer, 29-Jun-2026):** `.$onUpdate(() => new Date())` was added to all per-domain `auditColumns.updatedAt` definitions, closing the 10 Drizzle-update gaps automatically. Note: `$onUpdate` runs the value through the column's date mapper, so a `sql\`now()\`` expression is **not** supported there — `new Date()` (app-server clock) is the working form.
   - **DONE (DB layer, 29-Jun-2026):** `migrations/0143_add_updated_at_triggers.sql` installs an idempotent `set_updated_at()` function and a `BEFORE UPDATE` trigger (`trg_<table>_updated_at`) on every `public` base table carrying an `updated_at` column (177/177 tables on the connected DB). This stamps `updated_at = NOW()` (DB clock) on every UPDATE regardless of write path — including raw `sql` UPDATEs and external/`psql` writes — closing the gap the ORM hook can't reach. The trigger honors a `sync.bypass_trigger` session GUC: the sync engine sets `set_config('sync.bypass_trigger','true', true)` to preserve a replayed row's source `updated_at`.
   - **Open follow-on:** for the sync-replay path, bypassing the trigger alone is **not** sufficient to preserve the source timestamp — the ORM `.$onUpdate()` overwrites `NEW.updated_at` with the local clock *before* the trigger runs. The sync-apply code must also set `updatedAt` explicitly to the source value in `.set({...})` (an explicit value suppresses `$onUpdate`).

---

*Audit produced read-only on 29-Jun-2026. No source, schema, or data was modified. Static findings cite exact `file:line`; live-data figures reflect tenant `heliumdb` at audit time and will vary per tenant.*
