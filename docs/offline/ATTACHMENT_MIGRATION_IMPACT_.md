# Attachment Migration Impact Analysis — base64→Filesystem
  
> **Type:** Pre-implementation impact analysis (read-only — no code changes made)  
> **Date:** 25-Jun-2026  
> **Target design:** `.private/{domainname}/{modulename}/{timestamp}_{attachmentname}`  
> **Backward compat rule:** Dual-read — if `file_data` has data, serve from base64; else read from `file_path`  
> **Exclusion:** Profile photos (`uploaded_photo`) remain base64-in-DB  
  
---
  
## 1. Executive Summary
  
| Metric | Value |
|---|---|
| **Attachment tables in scope** | **26** dedicated attachment tables + **1** JSON-in-text column (promotions) = **27 storage points** |
| **Profile photo columns excluded** | **2** (`crew_members_v2.uploaded_photo`, `recruitment_candidates_v2.uploaded_photo`) |
| **Modules affected** | **6** (Crew Pool, Recruitment, Screening B1-B8, Drugs & Alcohol, Vessel Planning, Promotions) |
| **Total estimated effort** | **8–12 developer-weeks** (including shared infrastructure, per-module work, and testing) |
  
### Top 3 Risks
  
1. **🔴 Ship/Shore Sync Break (Critical):** Today, attachment bytes travel as DB column values during `pg_dump`-based backup/sync. Once attachments live on the filesystem, DB sync alone cannot transfer files. A separate file-transfer mechanism is required — this is currently **completely absent** from the codebase. See §5.
  
2. **🟠 Promotions `attachments_data` JSON Column (High):** The `promo_checklist_progress_v2.attachments_data` column is a serialized JSON `text` field that may embed base64 file bytes inline. There is no `file_path` column on this table. This module requires a fundamentally different migration strategy — restructuring from embedded-JSON to a separate attachment table or a JSON-with-path-refs pattern. See §6.
  
3. **🟡 Timestamp Collision Under Concurrency (Medium):** `Date.now()` millisecond timestamps can collide during bulk import or multi-user concurrent uploads of identically-named files. A random suffix is recommended. See §3.
  
---
  
## 2. Per-Module Impact Table
  
### Module Overview
  
| Module | Tables | Read Paths | Write Paths | Complexity | Dependency Notes |
|---|---:|---|---|---|---|
| **Crew Pool — Documents** | 1 | `crewDocumentsService.getAllWithAttachments` (L240-278), `crewDocumentsService.getAll` (L34-37), `FileAttachmentDialog.tsx` inline `<img>` (L370-375) | `crewDocumentsService.reconcileWithAttachments` (L142-234), `crewDocumentsService.addAttachment` (L114-125) | **Medium** | Depends on shared `FileAttachmentDialog.tsx`; shares pattern with all crew-pool sub-modules |
| **Crew Pool — Visas** | 1 | Same pattern as Documents via `crewVisasService` | `crewVisasService` reconcile + addAttachment | **Low** | Same shape as Documents |
| **Crew Pool — Education** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Crew Pool — Licenses** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Crew Pool — Training** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Crew Pool — Sea Service** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Crew Pool — Medical** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Crew Pool — Doctor Visits** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Crew Pool — Briefing** | 1 | `serveAttachment` in `crewBriefingController.ts` (L45-80), already reads `filePath \|\| fileData` (L54) | `addBriefingAttachment` (L150-176), writes `filePath` field already | **Low** | ✅ **Most forward-compatible** — already has dual-read in `serveAttachment`. Ideal pilot module. |
| **Crew Pool — De-briefing** | 1 | Same `serveAttachment` pattern (L308-320) | `addDebriefingAttachment` (L270-296) | **Low** | Same as Briefing |
| **Recruitment — Documents** | 1 | `documentsService.getDocuments` (L67-104) JOINs and returns full `att` objects | `documentsService.createDocumentAttachment` (L133-141) | **Medium** | Shares pattern with all recruitment sub-modules |
| **Recruitment — Visas** | 1 | Same JOIN pattern | Same create pattern | **Low** | Same shape |
| **Recruitment — Education** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Recruitment — Licenses** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Recruitment — Training** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Recruitment — Sea Service** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Recruitment — Additional Info** | 1 | Same pattern | Same pattern | **Low** | Same shape |
| **Screening B1** | 1 | Via `screeningB1Service.getAttachments` | `screeningB1Service.createAttachment` | **Low** | Independent per B-stage |
| **Screening B2** | 1 | Same pattern | Same pattern | **Low** | Independent |
| **Screening B3** | 1 | Same pattern | Same pattern | **Low** | Independent |
| **Screening B4** | 1 | Same pattern | Same pattern | **Low** | Independent |
| **Screening B5** | 1 | Same pattern | Same pattern | **Low** | Independent |
| **Screening B6** | 1 | Same pattern | Same pattern | **Low** | Independent |
| **Screening B8** | 1 | Same pattern | Same pattern | **Low** | Independent |
| **Drugs & Alcohol** | 1 | `attachmentsController.getByTestRecord` (L7-33): returns `data: a.fileData` in response; `testRecordsService` maps `data: a.fileData` (L77) | `attachmentsController.create` (L36-78): writes `fileData: data` (L56); `testRecordsService._upsertChildren` (L780-828): writes `fileData: item.data` | **Medium** | Different column names (`filename` vs `fileName`); reads return `fileData` directly in response body as `data` field |
| **Vessel Planning** | 1 | `vesselPlanningController.getAttachments` (L105-124): returns `fileData: att.fileData` (L114) directly in API response | `vesselPlanningService.addAttachment` (L1161-1167): passes through full data | **Medium** | Returns `fileData` in API response — frontend depends on this |
| **Promotions (JSON)** | 1 (JSON column) | `promotionReviewsService` (L281): `JSON.parse(cp.attachmentsData)` → deserialized as `attachments` array | `promotionReviewsService` (L1715): `JSON.stringify(point.attachments)` → serialized back into `attachments_data` | **High** | ⚠️ No separate attachment table; no `file_path` column; requires restructuring |
  
---
  
## 3. Naming & Collision Analysis
  
### Convention: `{timestamp}_{attachmentname}`
  
**Stress-test results:**
  
| Scenario | Risk | Assessment |
|---|---|---|
| **Single user, sequential uploads** | None | `Date.now()` increments between calls |
| **Single user, multi-file upload** | **Medium** | `FileAttachmentDialog.tsx` (L77-96) uses `Promise.all(validFiles.map(readFile))` — all files read concurrently; if written to disk in parallel, two files with the same name in the same millisecond will collide |
| **Multiple users, same filename** | **Medium** | Concurrent API requests from different users for the same module could generate identical `Date.now()` values for identically-named files |
| **Bulk import** | **High** | A batch of records with attachments could generate many same-millisecond writes |
  
> [!WARNING]
> **Recommendation:** Add a random suffix to the filename pattern.  
> Proposed: `{timestamp}_{random8}_{sanitized_attachmentname}`  
> Example: `1719300000000_x7kF9m2p_resume_abc.pdf`  
> `random8` = 8-char random hex or base36 string via `crypto.randomBytes(4).toString('hex')`
  
### Filename Sanitization Requirements
  
The current codebase does **no filename sanitization** on the server side. Filenames from `FileAttachmentDialog.tsx` are whatever the browser provides from `file.name`.
  
| Risk | Example | Impact |
|---|---|---|
| **Path traversal** | `../../etc/passwd` | Could write outside `.private/` if path is naively joined |
| **Special characters** | `résumé (final v2).pdf`, `file name.pdf` | Spaces and unicode in filesystem paths |
| **OS-reserved names** | `CON`, `PRN`, `NUL` (Windows) | File creation failures on Windows servers |
| **Length** | Filenames > 255 chars | Filesystem rejection |
  
> [!IMPORTANT]
> **Required:** Server-side sanitization function that:  
> 1. Strips/replaces path separators (`/`, `\`)  
> 2. Replaces spaces → underscores  
> 3. Removes or replaces non-ASCII characters  
> 4. Truncates to 200 chars (reserving room for timestamp prefix)  
> 5. Rejects or renames OS-reserved names  
  
---
  
## 4. Security & Serving Mechanism
  
### 4a. `.private/` Directory Placement
  
**Confirmed safe:** The nginx configuration in [nginx.conf.example](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/deploy/nginx.conf.example ) serves only:
- `/crewing/assets/` → `dist/public/assets/` (L39-44)
- `/figmaAssets/` → `dist/public/figmaAssets/` (L49-54)
- `/crewing/` → `dist/public/` (L59-76)
- `/api/` → proxied to Node.js backend (L15-34)
  
A `.private/` directory at the project root (e.g., `C:/GitHub/crewing_upgraded_build/.private/`) would be **completely outside all nginx-served paths**. Direct HTTP access to files in `.private/` is not possible through the current nginx config.
  
### 4b. Required Serving Mechanism
  
Files must be served through **authenticated API routes** on the Node.js backend:
  
- **Existing pattern:** `crewBriefingController.ts` already has `serveAttachment()` (L45-80) that serves binary content with proper `Content-Type`, `Content-Disposition`, `X-Content-Type-Options: nosniff`, and `Cache-Control` headers.
- **What's needed:** A new `serveFromFilePath()` function (or enhancement of existing `serveAttachment`) that:
  1. Reads `attachment.filePath` as a relative path
  2. Resolves against the `.private/` root (with path-traversal guard!)
  3. Streams the file from disk using `fs.createReadStream()`
  4. Sets the same security headers as the current `serveAttachment`
  5. Falls back to the existing `decodeStoredFile()` if `filePath` is empty but `fileData` exists (dual-read pattern)
  
**Currently only briefing/de-briefing routes** have `serveAttachment` (`/briefing-attachments/:attUuid/raw`, `/debriefing-attachments/:attUuid/raw`). All other modules (Crew Pool, Recruitment, D&A, Vessel Planning) return raw `fileData` base64 in the JSON response body — they have **no binary-streaming route**. New `/raw` routes would need to be added for each module.
  
### 4c. Directory Auto-Creation
  
Each upload must ensure the directory tree exists:
```
.private/{domainname}/{modulename}/
```
  
Use `fs.mkdirSync(dirPath, { recursive: true })` or `fs.promises.mkdir(dirPath, { recursive: true })`.
  
### 4d. Multi-Tenant Domain Resolution
  
The `{domainname}` segment requires the tenant domain to be available in the request context. Currently:
- `tenantMiddleware` (applied in [server/index.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/index.ts ) L74) resolves the tenant from the `x-tenant-id` header
- The resolved tenant info is available on the request object
- The tenant domain string must be sanitized for use as a directory name (no `/`, `\`, `..`)
  
### 4e. File Permissions
  
On Windows production (per `nginx.conf.example` paths: `C:/GitHub/crewing_upgraded_build/`):
- The PM2 process (`sail-crewing-api`, [ecosystem.config.cjs](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/ecosystem.config.cjs ) L4-6) runs as the Windows service account
- `.private/` directory must be readable/writable by this account
- No additional nginx permissions needed since nginx doesn't serve `.private/`
  
---
  
## 5. Ship/Shore Sync Risk Section
  
> [!CAUTION]
> **This is the highest-risk area of the migration. No existing mechanism handles file-based sync.**
  
### 5a. Current Sync Architecture
  
Based on codebase analysis:
  
1. **Backup mechanism:** [server/backup-database.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/backup-database.ts ) uses `pg_dump` to create SQL backups of the entire database (L31). Since attachments are stored as base64 in `file_data` text columns, **they are included in the pg_dump output**. Restore is via `psql < backupfile.sql` (L74).
  
2. **Multi-tenant architecture:** Each tenant has a separate database ([tenantConnectionManager.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/utils/tenantConnectionManager.ts )). Vessel-side data (medical, D&A, sea service, briefing, de-briefing) syncs to shore through the database — either via full DB backup/restore or row-level replication.
  
3. **No file sync mechanism exists.** There is no code in the codebase for:
   - rsync or SCP-based file transfer
   - File manifest generation or diff-based sync
   - Upload queue for offline/connectivity-limited vessel scenarios
  
### 5b. What Breaks Post-Migration
  
| Scenario | Current (base64) | Post-Migration (filesystem) | Impact |
|---|---|---|---|
| **Vessel→Shore pg_dump sync** | `file_data` column carries full attachment bytes | `file_data` is NULL; `file_path` contains a relative path | ⛔ **Shore receives empty attachments** — only the path string, no file bytes |
| **Shore→Vessel restore** | All attachments come with the DB dump | Same as above | ⛔ **Vessel receives no attachment files** |
| **New attachment on vessel** | Saved to vessel DB | Saved to vessel filesystem + `file_path` in DB | On sync, `file_path` row syncs but **the file on vessel filesystem is not transferred** |
| **Concurrent edit** | Both sides have data in DB column | Filesystem state diverges; no merge strategy | ⛔ **Silent data loss** on next full sync |
  
### 5c. Required New Mechanism
  
A file-sync layer must be built alongside (or before) this migration:
  
1. **File manifest table:** Track `file_path`, `checksum`, `last_modified` per attachment for delta sync
2. **Transfer protocol:** rsync, SCP, or HTTP-based file push/pull between vessel and shore
3. **Conflict resolution:** Last-write-wins or version-based merge for files modified on both sides
4. **Bandwidth considerations:** Vessel connectivity is typically limited; large file transfers must be resumable and bandwidth-throttled
5. **Offline queue:** Attachments created on vessel while offline must queue for transfer
  
### 5d. Modules with Vessel-Side Data (Highest Sync Risk)
  
These modules have `vessel_uuid` in their data model, indicating they may originate on vessels:
  
| Module | Evidence |
|---|---|
| **Crew Pool — Medical** | `crew_pre_joining_medicals` has `vesselUuid` column |
| **Crew Pool — Briefing** | `crew_briefings` has `vesselUuid` column |
| **Crew Pool — De-briefing** | `crew_debriefings` has `vesselUuid` column |
| **Drugs & Alcohol** | `da_test_records_v2` is vessel-scoped |
| **Vessel Planning** | `vessel_planning_v2` is vessel-scoped |
  
> [!IMPORTANT]
> **Recommendation:** Do NOT migrate vessel-side modules (Medical, Briefing, De-briefing, D&A, Vessel Planning) until a file-sync mechanism is in place. Start migration with shore-only modules (Recruitment, Screening).
  
---
  
## 6. Detailed Read & Write Path Impact Per Module
  
### 6a. Crew Pool Sub-Modules (Documents, Visas, Education, Licenses, Training, Sea Service, Medical, Doctor Visits)
  
**Read Paths:**
  
| Read Location | File | Lines | Current Behavior | Migration Impact |
|---|---|---|---|---|
| `getAllWithAttachments()` | [crewDocumentsService.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/services/crewDocumentsService.ts ) | 240-278 | `SELECT *` from attachment table → returns full `fileData` in JSON | Must add conditional: if `filePath` present, return `viewUrl` instead of `fileData` to avoid sending file bytes in JSON |
| `getAll()` (via repository) | Various service files | Pattern repeated | Returns attachment objects with `fileData` | Same as above |
| Frontend thumbnail | [FileAttachmentDialog.tsx](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/components/FileAttachmentDialog.tsx ) | 370-375 | `<img src={getFileContent(attachment)}>` where `getFileContent` returns `data \|\| fileData \|\| filePath` | `filePath` is a relative path, not a data URL — would render as broken image. Must change to use `viewUrl` for saved attachments. |
| Frontend view/download | [FileAttachmentDialog.tsx](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/components/FileAttachmentDialog.tsx ) | 219-277, 280-310 | `handleView` checks `viewUrl` first (L224), then falls back to `fileData` | ✅ Already forward-compatible if `viewUrl` is populated in the response |
| PDF generation | [generateCrewInfoPDF.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/lib/generateCrewInfoPDF.ts ) | 631, 673-676 | Uses `uploadedPhoto` (base64) for crew photo only | ✅ Not affected — profile photos excluded from migration |
  
**Write Paths:**
  
| Write Location | File | Lines | Current Behavior | Migration Impact |
|---|---|---|---|---|
| `reconcileWithAttachments()` | [crewDocumentsService.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/services/crewDocumentsService.ts ) | 142-234 | Receives `filePath` or `fileData` from frontend (L218); inserts both to DB (L222-224) | Must intercept: if `fileData` present, write to filesystem, compute `filePath`, save `filePath` to DB, set `fileData` to null |
| `addAttachment()` | [crewDocumentsService.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/services/crewDocumentsService.ts ) | 114-125 | Requires `fileName` and `filePath` (L120-121) | Currently only accepts `filePath` (not `fileData`); would need to also accept raw file data for write-to-disk |
| Frontend upload encoder | [FileAttachmentDialog.tsx](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/components/FileAttachmentDialog.tsx ) | 77-96 | `FileReader.readAsDataURL()` → base64 string held in memory | **Two approaches:** (a) Continue sending base64 to server, let server decode+write (simpler), or (b) Switch to `multipart/form-data` upload (better for large files, avoids 33% base64 inflation over the wire) |
  
**Files to touch per crew-pool sub-module:**
  
| Layer | Files |
|---|---|
| Schema | No change needed — `file_path` column already exists |
| Service | `server/v2/crew-pool/services/crew{Module}Service.ts` — add filesystem write + dual-read logic |
| Controller | Controller files in `server/v2/crew-pool/controllers/` — add `/raw` binary-serve route |
| Routes | [server/v2/crew-pool/routes.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/routes.ts ) — add `GET` raw attachment routes |
| Frontend | [FileAttachmentDialog.tsx](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/components/FileAttachmentDialog.tsx ) — fix `getFileContent()` for `filePath` |
  
### 6b. Crew Pool — Briefing & De-briefing (Already Forward-Compatible)
  
**Special status:** These are the **most migration-ready** modules.
  
- `serveAttachment()` at [crewBriefingController.ts:45-80](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/controllers/crewBriefingController.ts#L45-L80 ) already reads `attachment.filePath || attachment.fileData` (L54)
- Binary-serve routes already exist: `/briefing-attachments/:attUuid/raw` (L183), `/debriefing-attachments/:attUuid/raw` (L194)
- Frontend already uses `viewUrl` via `fetchAsObjectUrl()` to load saved attachments
  
**Remaining work:** 
- Modify `addBriefingAttachment` (L150-176) to write incoming data to filesystem instead of DB
- Enhance `serveAttachment()` to read from filesystem when `filePath` is a relative disk path rather than a data URL
- **Sync risk:** Has `vesselUuid` — defer until sync mechanism exists
  
### 6c. Recruitment Sub-Modules (Documents, Visas, Education, Licenses, Training, Sea Service, Additional Info)
  
**Read Paths:**
  
| Read Location | File | Lines | Current Behavior |
|---|---|---|---|
| `getDocuments()` | [documentsService.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/recruitment/services/documentsService.ts ) | 67-104 | JOIN query returns full `att` object including `fileData` |
| All `get{Category}()` methods | Same file | Pattern repeated for visas, education, etc. | Same JOIN + full object return |
| API response shape | [recruitment routes](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/routes/v2/recruitment.ts ) | Varies | Returns attachment objects directly as-is from service |
  
**Write Paths:**
  
| Write Location | File | Lines | Current Behavior |
|---|---|---|---|
| `createDocumentAttachment()` | [documentsService.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/recruitment/services/documentsService.ts ) | 133-141 | Passes through `data` to repository; repository inserts full row |
| All `create{Category}Attachment()` | Same file | Pattern repeated | Same pass-through pattern |
  
**Files to touch per recruitment sub-module:**
  
| Layer | Files |
|---|---|
| Schema | No change — `file_path` already exists |
| Service | `server/v2/recruitment/services/documentsService.ts` — add filesystem write + dual-read |
| Controller | `server/v2/recruitment/controllers/` — add `/raw` serve routes |
| Routes | `server/routes/v2/recruitment.ts` — add raw attachment routes |
| Frontend | Shared `FileAttachmentDialog.tsx` + `RecruitmentApplicationForm_v2.tsx` |
  
### 6d. Screening B1–B8
  
All screening stages follow an identical pattern:
- `getAttachments()` returns full attachment rows
- `createAttachment()` passes data through to repository
- No binary-serve routes exist
  
Screening is **shore-only** (no `vessel_uuid`), making it a safe early migration candidate.
  
### 6e. Drugs & Alcohol
  
**Read Paths — Discrepancy Found:**
  
The D&A module uses **different column naming** from the standard pattern:
- Column is `filename` (not `file_name`) at [schema.ts:94](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/drugs-alcohol/schema.ts#L94 )
- `attachmentsController.getByTestRecord()` at [attachmentsController.ts:17-26](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/drugs-alcohol/controllers/attachmentsController.ts#L17-L26 ) returns `data: a.fileData || ""` — the response body uses a `data` field, not `fileData`
- The frontend expects `data` field in responses
  
**Write Paths:**
  
| Write Location | File | Lines | Current Behavior |
|---|---|---|---|
| `attachmentsController.create()` | [attachmentsController.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/drugs-alcohol/controllers/attachmentsController.ts ) | 36-78 | Receives `data` in request body (L43), writes as `fileData: data` (L56), returns `data: attachment.fileData` (L71) |
| `testRecordsService._insertChildren()` | [testRecordsService.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/drugs-alcohol/services/testRecordsService.ts ) | 585-613 | Parses JSON `attachmentFile`, writes `fileData: item.data` (L597) |
| `testRecordsService._upsertChildren()` | [testRecordsService.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/drugs-alcohol/services/testRecordsService.ts ) | 780-828 | Upsert pattern: updates `fileData: item.data` (L797), creates with `fileData: item.data` (L813) |
  
**Migration complexity: Medium** — non-standard field names require D&A-specific adapter code. Also vessel-scoped (sync risk).
  
### 6f. Vessel Planning
  
**Read Paths:**
  
`vesselPlanningController.getAttachments()` at [vesselPlanningController.ts:105-124](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/vessel/controllers/vesselPlanningController.ts#L105-L124 ) returns `fileData: att.fileData` directly in the response body (L114). The frontend depends on this field for rendering.
  
**Write Paths:**
  
`vesselPlanningService.addAttachment()` at [vesselPlanningService.ts:1161-1167](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/vessel/services/vesselPlanningService.ts#L1161-L1167 ) passes through the full data object to the repository. The repository creates the row with whatever fields are provided.
  
**Migration complexity: Medium** — vessel-scoped (sync risk), returns `fileData` directly in API response.
  
### 6g. Promotions — `attachments_data` JSON Column
  
**This is the most complex migration target.**
  
- **No separate attachment table.** Attachments are embedded as serialized JSON in `promo_checklist_progress_v2.attachments_data` (text column) at [schema.ts:162](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/shared/v2/promotions/schema.ts#L162 )
- **No `file_path` column** exists on this table
- **Read:** `promotionReviewsService` (L281) does `JSON.parse(cp.attachmentsData)` to reconstruct an attachments array
- **Write:** (L1715) does `JSON.stringify(point.attachments)` to serialize the array back
  
**Options:**
1. **Create a new `promo_checklist_attachments` table** (like all other modules) and migrate the JSON blobs into rows — **Recommended but high effort**
2. **Store path references in the JSON** (replace `fileData` key with `filePath` in the JSON object) — Lower effort but inconsistent with the rest of the app
  
> [!IMPORTANT]
> **Needs verification:** Confirm whether `attachments_data` actually stores base64 file bytes or just metadata/references. The audit flagged this as unverified. If it only stores metadata, no migration is needed.
  
---
  
## 7. Profile Photo Exclusion Rationale
  
### Explicit Exclusion: `crew_members_v2.uploaded_photo` and `recruitment_candidates_v2.uploaded_photo`
  
**Why it's safe to leave as base64:**
  
| Factor | Assessment |
|---|---|
| **File size** | Profile photos are bounded by the client-side 5 MB limit (same as all attachments), but in practice passport-style photos are typically 50–500 KB |
| **Volume** | One photo per crew member/candidate — not a high-volume storage concern |
| **Access pattern** | Photos are loaded on every crew detail/list view; they're part of the main `crew_members_v2` row which is already fetched. Moving to filesystem would require an additional HTTP round-trip per photo |
| **Rendering** | Embedded directly as `<img src={uploadedPhoto}>` in [CrewInfoForm_v2.tsx:2802](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/modules/crew-pool/CrewInfoForm_v2.tsx#L2802 ) and [RecruitmentApplicationForm_v2.tsx:4130](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx#L4130 ) — base64 data URLs work directly with `<img>` tags |
| **PDF generation** | [generateCrewInfoPDF.ts:673-676](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/lib/generateCrewInfoPDF.ts#L673-L676 ) and [generateRecruitmentPDF.ts:755-756](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/lib/generateRecruitmentPDF.ts#L755-L756 ) embed photo data directly into PDFs — they need the raw base64 data available client-side |
| **Sync compatibility** | Photos sync with the main crew record via DB backup — no separate file-sync needed |
  
**Risk of inconsistency:** Low. Photos are a distinct data type (one per entity, small size, always needed for display) compared to document attachments (many per entity, larger size, on-demand viewing). The separation is architecturally logical.
  
**Future consideration:** If photo sizes grow or if the crew list view performance degrades due to base64 photo payloads, a separate optimization pass can move photos to filesystem with a dedicated thumbnail/full-size serving route. This is independent of the attachment migration.
  
---
  
## 8. Rollback Considerations
  
### Dual-Read Pattern Rollback Safety
  
The proposed dual-read pattern (`file_data` present → serve base64; else → serve from `file_path`) is inherently rollback-safe:
  
| Scenario | Rollback Safety |
|---|---|
| **Old rows (pre-migration)** | ✅ `file_data` still populated; `file_path` null/empty. Old code reads `file_data` as before |
| **New rows (post-migration)** | ⚠️ `file_data` is null; `file_path` has value. Rolling back code means the old code path would see no `file_data` and have no `file_path` reader → **attachment appears empty** |
| **Rollback of code only (keep DB changes)** | ⚠️ New rows created during the migration-active period would lose attachment access until code is re-deployed |
| **Rollback of code + delete new files** | ❌ Data loss for attachments created during migration window |
  
### Per-Module Rollback Risk
  
| Module | Rollback Risk | Notes |
|---|---|---|
| **Briefing/De-briefing** | **Low** | `serveAttachment` already has `filePath \|\| fileData` fallback — old code can already read both patterns |
| **All other Crew Pool + Recruitment** | **Low** | Old rows untouched; new rows would need `file_data` backfilled if rolling back |
| **Drugs & Alcohol** | **Low** | Same pattern |
| **Vessel Planning** | **Low** | Same pattern |
| **Promotions (JSON)** | **Medium** | If the JSON structure changes (e.g., `fileData` → `filePath` inside JSON), rollback requires re-serializing old format |
  
> [!TIP]
> **Recommendation:** During migration, consider keeping `file_data` populated for a grace period (write to BOTH filesystem AND DB) to enable zero-risk rollback. Remove `file_data` population in a second phase after the migration is proven stable. This doubles storage temporarily but eliminates rollback risk.
  
---
  
## 9. Recommended Migration Order
  
### Phase 0: Shared Infrastructure (Week 1-2)
  
Build the foundation before touching any module:
  
1. **File storage service** — `server/v2/shared/fileStorageService.ts`
   - `writeAttachment(domain, module, fileName, buffer)` → returns relative `filePath`
   - `readAttachment(filePath)` → returns `{ buffer, mime }`
   - Handles directory auto-creation, path sanitization, collision-safe naming
2. **Shared `serveAttachmentFromFilesystem()` helper** — extend existing `serveAttachment` in `crewBriefingController.ts` into a shared utility
3. **Server-side file size/MIME validation** (not currently present — audit §6 item 2)
4. **.gitignore update** — add `.private/` to `.gitignore`
  
### Phase 1: Pilot — Briefing & De-briefing (Week 2-3)
  
**Why first:** Already has `serveAttachment` with `filePath || fileData` dual-read. Lowest risk, fastest validation.
  
- Modify write path to save to filesystem
- Verify dual-read works for old rows (base64) and new rows (filesystem)
- No sync risk for initial shore-side testing
  
### Phase 2: Recruitment + Screening B1-B8 (Week 3-5)
  
**Why second:** Shore-only modules (no vessel UUID). 7 recruitment sub-modules + 7 screening stages = 14 tables, but all follow identical patterns.
  
- Apply the shared infrastructure to recruitment document service
- Add `/raw` serve routes for each sub-module
- Template the changes across all 14 tables
  
### Phase 3: Crew Pool (Documents through Sea Service) (Week 5-7)
  
**Why third:** 6 sub-modules with identical schema shape. Some (Medical, Briefing, De-briefing) have vessel-side data.
  
- Migrate shore-safe sub-modules first (Documents, Visas, Education, Licenses)
- Defer vessel-scoped modules (Medical, Doctor Visits) until sync is ready
  
### Phase 4: Drugs & Alcohol + Vessel Planning (Week 7-9)
  
**Why fourth:** Different column naming (D&A), vessel-scoped, sync-dependent.
  
- Requires file-sync mechanism to be in place
- D&A needs adapter code for non-standard field names
  
### Phase 5: Promotions (Week 9-10)
  
**Why last:** Requires architectural decision on JSON column restructuring. Highest complexity, most isolated (doesn't block other modules).
  
### Phase 6: Cleanup (Week 10-12)
  
- Stop writing to `file_data` (remove dual-write if implemented)
- Optional: Backfill migration script to convert old base64 rows to filesystem
- Performance testing with large attachment volumes
  
---
  
## 10. Audit Discrepancies Found
  
During this analysis, the following discrepancies with the ATTACHMENT_AUDIT.md were identified:
  
| # | Audit Claim | Actual Finding |
|---|---|---|
| 1 | Audit says `crewDocumentsService.reconcileWithAttachments` writes `filePath: att.filePath \|\| null` (§4) | ✅ Confirmed at [crewDocumentsService.ts:223](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/services/crewDocumentsService.ts#L223 ) |
| 2 | Audit says `serveAttachment` reads `attachment.filePath \|\| attachment.fileData` | ✅ Confirmed at [crewBriefingController.ts:54](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/controllers/crewBriefingController.ts#L54 ) — however, current code passes this to `decodeStoredFile()` which expects a `data:...` URL. A filesystem path would return `null` from `decodeStoredFile()` — the dual-read is **not yet functional** for disk paths. |
| 3 | Audit says `FileAttachment` client type carries `filePath / viewUrl / fileUrl` | ✅ Confirmed: `getFileContent()` at [FileAttachmentDialog.tsx:179-182](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/components/FileAttachmentDialog.tsx#L179-L182 ) does read `data \|\| fileData \|\| filePath \|\| fileUrl` — but `filePath` as a raw disk path would break `<img src={...}>` rendering |
| 4 | Audit says `addBriefingAttachment` writes to `filePath` | ✅ Confirmed at [crewBriefingController.ts:167](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/controllers/crewBriefingController.ts#L167 ) — but note: the briefing controller stores the incoming `filePath` or `fileUrl` value (which is currently a data URL from the client) into the `filePath` column. So `filePath` currently holds data URLs, not filesystem paths. |
| 5 | D&A schema uses `filename` (not `file_name`) | Audit says `da_attachments_v2.file_data` but doesn't note the `filename` naming difference. The column naming diverges from the standard `file_name` used in all 26 other attachment tables. |
| 6 | Recruitment `documentsService` write paths | Audit doesn't document the recruitment write path in detail — the service uses a generic repository pass-through pattern without explicit `fileData` references in the service layer (the data is passed through opaquely via `...data` spread) |
  
---
  
## Appendix: Complete File Inventory Per Module
  
### Shared / Cross-Cutting Files
  
| File | Role | Must Change |
|---|---|---|
| [FileAttachmentDialog.tsx](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/client/src/components/FileAttachmentDialog.tsx ) | Shared upload/view/download component | Yes — `getFileContent()`, thumbnail rendering |
| [crewBriefingController.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/v2/crew-pool/controllers/crewBriefingController.ts ) | Contains `serveAttachment()` + `decodeStoredFile()` | Yes — extract to shared, add filesystem reading |
| [server/index.ts](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/server/index.ts ) | Express body parser limit `10mb` (L13) | Review — if switching to multipart uploads |
| [nginx.conf.example](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/deploy/nginx.conf.example ) | Nginx config | No change needed — `.private/` is already outside served paths |
| [.gitignore](file:///C:/Users/Datta%20Khade/Desktop/SAIL/SAIL_Replit/crewdevnov12/.gitignore ) | Git ignore rules | Yes — add `.private/` |
  
### Per Crew Pool Sub-Module (×10)
  
| File Pattern | Example |
|---|---|
| `server/v2/crew-pool/services/crew{Module}Service.ts` | `crewDocumentsService.ts`, `crewVisasService.ts`, etc. |
| `server/v2/crew-pool/controllers/crew{Module}Controller.ts` | `crewDocumentsController.ts`, etc. |
| `server/v2/crew-pool/routes.ts` | Single file — add raw serve routes |
  
### Per Recruitment Sub-Module (×7 + ×7 Screening)
  
| File Pattern | Example |
|---|---|
| `server/v2/recruitment/services/documentsService.ts` | Single file handles all 7 document types |
| `server/v2/recruitment/services/screeningService.ts` | Handles B1–B8 screening |
| `server/v2/recruitment/controllers/` | Document + screening controllers |
| `server/routes/v2/recruitment.ts` | Route definitions |
  
### D&A
  
| File |
|---|
| `server/v2/drugs-alcohol/controllers/attachmentsController.ts` |
| `server/v2/drugs-alcohol/services/testRecordsService.ts` |
| `server/v2/drugs-alcohol/routes.ts` |
  
### Vessel Planning
  
| File |
|---|
| `server/v2/vessel/controllers/vesselPlanningController.ts` |
| `server/v2/vessel/services/vesselPlanningService.ts` |
| `server/v2/vessel/routes.ts` |
  
### Promotions
  
| File |
|---|
| `server/v2/promotions/services/promotionReviewsService.ts` |
| `server/v2/promotions/repositories/checklistProgressRepository.ts` |
| `shared/v2/promotions/schema.ts` (if adding new attachment table) |
  