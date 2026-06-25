# Attachment Storage Audit — Crewing (CrewingV2)

> **Scope:** Read-only architectural audit. No code, schema, migration, route, or component was modified.
> **Focus:** Every place file/document attachments are uploaded, stored, retrieved, or rendered — with emphasis on attachment data persisted to the database as **base64-encoded strings**.
> **Date:** 25-Jun-2026

---

## 1. Executive Summary

Attachments in this application are stored **inline in the database as base64 data URLs** in `text` columns. There is no object/blob store and no filesystem persistence in use today.

> **Note:** This report covers **V2 tables only**. Legacy V1 attachment storage (e.g. `crew_members.uploaded_photo`, `crew_members` aggregate JSON columns, and `vessel_planning.handover_attachments`) is explicitly **excluded**.

**Distinct attachment storage points found: 29**, broken down as:

| Category | Count | Storage mechanism |
|---|---:|---|
| Dedicated attachment tables with a `file_data` text column | **26** | base64 data URL in `file_data` |
| Profile photo columns (`uploaded_photo`) | **2** | base64 data URL in `uploaded_photo` |
| JSON-in-text columns embedding `fileData` | **1** | base64 inside a serialized JSON value |

Key findings:
- All 26 dedicated attachment tables share an identical column shape: `file_name`, `file_type`, `file_size`, `file_path`, `file_data`, `uploaded_by_uuid`. **`file_path` exists in the schema but is currently unused** — every write path persists base64 to `file_data` (see §4).
- Upload encoding is centralized in the frontend via `FileReader.readAsDataURL` (data URL). A **5 MB per-file limit** and an allow-list of **PDF/JPEG/PNG** are enforced client-side only.
- Retrieval is split: newer modules (briefing/de-briefing) decode base64 server-side and stream bytes via a shared `serveAttachment` helper; older modules and the photo fields embed the raw data URL directly in the client (`<img src="data:...">`).

---

## 2. Attachment Storage Points

### 2a. Master table

| Module / Feature | DB Table.Column | Column type | File Path(s) | Multitenancy Scope | Notes |
|---|---|---|---|---|---|
| **Crew Pool — Documents** | `crew_documents_attachments.file_data` (+ unused `.file_path`) | `text` | `shared/v2/crew-pool/schema.ts:202-214`; svc `server/v2/crew-pool/services/crewDocumentsService.ts:142-233`; routes `server/v2/crew-pool/routes.ts` | Tenant (per-tenant DB); crew-scoped via `doc_uuid`→`crew_uuid` | base64 in `file_data`; rendered inline via `<img>` / object URL |
| **Crew Pool — Visas** | `crew_visas_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:230-242` | Tenant; crew-scoped via `visa_uuid` | base64 |
| **Crew Pool — Education** | `crew_education_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:259-271` | Tenant; crew-scoped via `edu_uuid` | base64 |
| **Crew Pool — Licenses** | `crew_licenses_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:294-306` | Tenant; crew-scoped via `lic_uuid` | base64 |
| **Crew Pool — Training** | `crew_training_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:328-340` | Tenant; crew-scoped via `train_uuid` | base64 |
| **Crew Pool — Sea Service** | `crew_sea_service_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:365-377` | Tenant; crew-scoped via `sea_uuid` | base64 |
| **Crew Pool — Medical** | `crew_medical_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:399-411` | Tenant; crew-scoped via `med_uuid` (record also has `vessel_uuid`) | base64 |
| **Crew Pool — Doctor Visits** | `crew_doctor_visits_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:431-443` | Tenant; crew-scoped via `visit_uuid` | base64 |
| **Crew Pool — Briefing** | `crew_briefing_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:460-472`; serve `server/v2/crew-pool/controllers/crewBriefingController.ts:45-80,194` | Tenant; crew-scoped via `briefing_uuid` (record has `vessel_uuid`) | base64; **decoded server-side & streamed** via `serveAttachment` |
| **Crew Pool — De-briefing** | `crew_debriefing_attachments.file_data` | `text` | `shared/v2/crew-pool/schema.ts:488-500`; serve `crewBriefingController.ts:45-80,314` | Tenant; crew-scoped via `debriefing_uuid` (record has `vessel_uuid`) | base64; decoded server-side & streamed |
| **Recruitment — Documents** | `cand_documents_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:135-145` | Tenant; candidate-scoped via `doc_uuid`→`rec_can_uuid` | base64 |
| **Recruitment — Visas** | `cand_visas_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:162-174` | Tenant; candidate-scoped | base64 |
| **Recruitment — Education** | `cand_education_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:188-200` | Tenant; candidate-scoped | base64 |
| **Recruitment — Licenses** | `cand_licenses_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:219-231` | Tenant; candidate-scoped | base64 |
| **Recruitment — Training** | `cand_training_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:250-262` | Tenant; candidate-scoped | base64 |
| **Recruitment — Sea Service** | `cand_sea_service_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:282-294` | Tenant; candidate-scoped | base64 |
| **Recruitment — Additional Info** | `cand_additional_info_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:306-318` | Tenant; candidate-scoped | base64 |
| **Recruitment — Screening B1 (Initial)** | `screening_b1_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:348-360` | Tenant; candidate-scoped via `b1_uuid` | base64 |
| **Recruitment — Screening B2 (References)** | `screening_b2_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:399-411` | Tenant; candidate-scoped via `b2_uuid` | base64 |
| **Recruitment — Screening B3 (Security)** | `screening_b3_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:449-461` | Tenant; candidate-scoped via `b3_uuid` | base64 |
| **Recruitment — Screening B4 (Certificates)** | `screening_b4_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:500-512` | Tenant; candidate-scoped via `b4_uuid` | base64 |
| **Recruitment — Screening B5 (Tests)** | `screening_b5_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:551-563` | Tenant; candidate-scoped via `b5_uuid` | base64 |
| **Recruitment — Screening B6 (Interviews)** | `screening_b6_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:603-615` | Tenant; candidate-scoped via `b6_uuid` | base64 |
| **Recruitment — Screening B8 (Shortlisting)** | `screening_b8_attachments.file_data` | `text` | `shared/v2/recruitment/schema.ts:678-690` | Tenant; candidate-scoped via `b8_uuid` | base64 (B7 has no attachments table) |
| **Drugs & Alcohol** | `da_attachments_v2.file_data` | `text` | `shared/v2/drugs-alcohol/schema.ts:90-101`; migration `migrations/0086_create_drugs_alcohol_v2_tables.sql` | Tenant; record-scoped via `test_record_uuid` (D&A record is vessel-scoped) | base64 |
| **Vessel Planning (v2)** | `vessel_planning_attachments_v2.file_data` | `text` | `shared/v2/vessel/schema.ts:51-64`; migration `migrations/0075_create_vessel_planning_attachments_v2.sql` | Tenant + **vessel-scoped** via `plan_uuid` | base64 |

### 2b. Profile photo columns (base64 data URL, not in an attachment table)

| Module / Feature | DB Table.Column | Column type | File Path(s) | Multitenancy Scope | Notes |
|---|---|---|---|---|---|
| **Crew (v2)** | `crew_members_v2.uploaded_photo` | `text` | `shared/v2/crew-pool/schema.ts:37` | Tenant; crew-scoped | base64 photo; embedded into PDFs (`client/src/lib/generateCrewInfoPDF.ts`) |
| **Recruitment Candidate (v2)** | `recruitment_candidates_v2.uploaded_photo` | `text` | `shared/v2/recruitment/schema.ts:30` | Tenant; candidate-scoped | base64 photo; embedded into PDFs (`client/src/lib/generateRecruitmentPDF.ts`) |

### 2c. JSON-in-text columns embedding base64 file data

| Module / Feature | DB Table.Column | Column type | File Path(s) | Multitenancy Scope | Notes |
|---|---|---|---|---|---|
| **Promotions — Checklist progress** | `promo_checklist_progress_v2.attachments_data` | `text` | `shared/v2/promotions/schema.ts:148-163` (column at `:162`) | Tenant; review-scoped via `review_uuid` | **Needs verification** — serialized `attachments_data` text; likely JSON containing base64 `fileData`, confirm whether it carries file bytes or only metadata |

---

## 3. Shared / Reusable Encode–Decode Utilities

There is **no single shared base64 utility module**; logic is split between one reusable upload component, one reusable server decoder, and several inline duplicates.

**Reusable:**
- **Frontend upload encoder** — `client/src/components/FileAttachmentDialog.tsx`
  - `MAX_FILE_SIZE = 5 * 1024 * 1024` (line 40); `ALLOWED_TYPES = pdf/jpeg/png/jpg` (line 41).
  - `FileReader.readAsDataURL` produces the base64 data URL (lines 77-96).
  - `dataUrlToBlob()` decodes a data URL to a `Blob` via `atob` (lines 167-177).
  - `fetchAsObjectUrl()` fetches server-served attachments through the tenant-aware patched `fetch` (lines 206-213).
  - Inline render `<img src={getFileContent(...)}>` uses the raw data URL (lines 370-375).
- **Backend decoder** — `server/v2/crew-pool/controllers/crewBriefingController.ts`
  - `decodeStoredFile()` parses `data:<mime>;base64,<payload>` → `Buffer` (lines 14-33).
  - `INLINE_RENDERABLE_MIMES` allow-list (pdf/jpeg/jpg/png) (lines 38-43).
  - `serveAttachment()` streams bytes with `X-Content-Type-Options: nosniff` and forces non-allowlisted MIME to download (lines 45-80). **Only the briefing/de-briefing routes use this** (`/briefing-…/:attUuid/raw`, `/debriefing-…/:attUuid/raw`).

**Inline / duplicated (not shared):**
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx` — own `FileReader` photo encode.
- `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx` — own `FileReader` photo encode.
- `client/src/lib/generateCrewInfoPDF.ts` & `client/src/lib/generateRecruitmentPDF.ts` — strip the `data:image/...;base64,` prefix to embed photos in generated PDFs.

---

## 4. Modules That Already Deviate From base64-in-DB

There is **no live deviation** — nothing currently persists to a filesystem path or external/object store. However, the schema is already prepared for one:

- **`file_path` column on all 26 attachment tables** (e.g. `shared/v2/crew-pool/schema.ts:209`, `shared/v2/recruitment/schema.ts:142`, `shared/v2/drugs-alcohol/schema.ts:99`, `shared/v2/vessel/schema.ts:58`). It is defined but unused on the write side: `crewDocumentsService.reconcileWithAttachments` writes `filePath: att.filePath || null` and in practice only `fileData` is supplied (`server/v2/crew-pool/services/crewDocumentsService.ts:218-227`).
- **The read side already prefers `file_path`**: `serveAttachment` reads `attachment.filePath || attachment.fileData` (`crewBriefingController.ts:54`), so the retrieval contract is **forward-compatible** with a switch to path/URL storage.
- **`FileAttachment` client type already carries `filePath` / `viewUrl` / `fileUrl`** fallbacks (`FileAttachmentDialog.tsx:179-187`), and saved attachments are already fetched via a server URL rather than inline data.

These three points are the natural seam to model a future migration on: populate `file_path` (object-store key/URL), keep `serveAttachment` as the read proxy, and stop writing `file_data`.

---

## 5. Risks (evidence-based)

Grounded only in observed code; no live row-count or table-size measurement was taken (DB not queried in this read-only audit).

- **Row / DB bloat.** 26 attachment tables plus 2 photo columns and 1 JSON-in-text column store full file bytes (base64) inline. Base64 inflates payloads by ~33% over raw bytes, and Postgres stores large `text` out-of-line via TOAST — every attachment up to the 5 MB limit can become a multi-MB TOASTed value. With 29 storage points across crew, recruitment, screening (B1–B8), D&A, and vessel planning, attachment bytes will dominate table size.
- **Backup / restore size.** Because every attachment lives in the per-tenant Postgres DB, logical backups (`pg_dump`) and restores carry the full base64 payload for all tenants. This is multiplied by the **separate-DB-per-tenant** architecture (one inflated DB per tenant), increasing backup duration and storage cost linearly with attachment volume.
- **Query performance.** `SELECT *`-style reads on attachment tables (or any join that returns `file_data`) pull large TOASTed values into memory; the service layer fetches attachments nested per crew record (`getAllWithAttachments`), so list/detail screens can transfer many MB. The `promo_checklist_progress_v2.attachments_data` JSON column is worse in shape — a single row read deserializes an entire array of base64 files.
- **Client/transport cost.** Inline `<img src="data:...">` rendering and data-URL handoff (`FileAttachmentDialog.tsx:370-375`) mean unsaved uploads sit fully in browser memory; large multi-file uploads are held as base64 strings before save.
- **Validation is client-side only.** The 5 MB limit and PDF/JPEG/PNG allow-list are enforced in the React components (`FileAttachmentDialog.tsx:40-41,64-72`); no server-side size/type guard was found on the write paths — flag as **needs verification** before relying on it as a bloat ceiling.

---

## 6. Items Flagged "Needs Verification"

1. `shared/v2/promotions/schema.ts:162` `attachments_data` — confirm whether it stores base64 file bytes or only attachment metadata/refs.
2. Server-side enforcement of the 5 MB / MIME allow-list on attachment write routes — not located; verify before treating it as a hard limit.
3. Per-resource RBAC on attachment read/write — routes are gated by global tenant + auth middleware (mounted in `server/index.ts`, all `/api/v2/*` routers in `server/routes.ts`); no fine-grained per-permission guard on attachment endpoints was found. Frontend has a `PermissionsContext`, but server-side authorization beyond tenant/auth needs verification.
