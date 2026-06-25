# Offline Branch — Attachment Migration Gap Analysis

> **Branch:** `upgraded_crewing_architecture_v2_offline`
> **Scope:** READ-ONLY analysis. No source code was modified. This report inventories what was actually built for the base64→filesystem attachment migration, measures it against `ATTACHMENT_MIGRATION_STANDARD.md` and `ATTACHMENT_MIGRATION_PLAN.md`, identifies root causes of broken behaviour, and recommends prioritized next changes.
> **Method:** Static code reading + grep across `server/v2/**`, `shared/v2/**`, `client/src/**`, `deploy/**`. Where runtime behaviour could not be confirmed from code alone, the finding is flagged **[needs verification]**.

---

## 1. Executive Summary

### What is actually working
- **Shared Phase-0 infrastructure exists and is largely compliant.** `server/v2/shared/fileStorageService.ts` (write/read/sanitize) and `server/v2/shared/serveAttachmentHelper.ts` (dual-read + security headers) match the standard's contract closely. `.private/` is gitignored (`.gitignore:32`) and the nginx example only aliases `dist/public` (`deploy/nginx.conf.example:39-60`), so `.private/` is not directly web-served.
- **Promotions is the only end-to-end migrated module.** It writes files to disk on save via `fileStorageService.writeAttachment`, stores rows in a new `promo_checklist_attachments_v2` table **without** a `file_data` column (`shared/v2/promotions/schema.ts:167-172`), exposes a `/raw` route through the shared helper (`server/v2/promotions/routes.ts:17`, `server/v2/promotions/controllers/promotionReviewsController.ts:148-182`), and emits a `viewUrl` to the frontend (`server/v2/promotions/services/promotionReviewsService.ts:298`).

### What is broken
- **The Briefing / De-briefing "pilot" (Plan Phase 1) does not actually use the filesystem.** Its controller re-implements a *private* `serveAttachment`/`decodeStoredFile` (`server/v2/crew-pool/controllers/crewBriefingController.ts:14-80`) that **only decodes `data:` base64 URLs and never calls `readAttachment`**. The add endpoints (`:150-176`, `:270-296`) store the client-provided value straight into `file_path`/`file_data` — `writeAttachment` is never invoked. Any record whose `file_path` holds a real disk-relative path is unservable (returns 404). This is a structural defect, not a config issue.
- **Frontend image thumbnails break for any filesystem-migrated image.** The dialog renders `<img src={getFileContent(attachment)}>` (`client/src/components/FileAttachmentDialog.tsx:372`), and `getFileContent` returns the raw `filePath` string when no base64 `data` is present (`:179-182`). A relative disk path is not a usable image source, so thumbnails for migrated images render broken.

### What is incomplete (active legacy base64 flows — NOT migrated to filesystem)
- **Crew Pool sub-modules, Recruitment sub-modules, Screening B1–B8, Drugs & Alcohol, and Vessel Planning have fully-working attachment CRUD endpoints that still store base64 — they were never migrated to the filesystem.** These are *not* empty scaffolds: they have live controllers/services/routes (e.g. `server/v2/drugs-alcohol/controllers/attachmentsController.ts`, `server/v2/recruitment/controllers/screeningController.ts`, `server/v2/vessel/routes.ts` planning-attachment routes, `server/v2/crew-pool/services/crewDocumentsService.ts`). What is missing is the migration: **none of these services call `writeAttachment`** (the only callers are Promotions and the backfill script), **none expose a `/raw` disk-serving route**, and they persist base64 into `file_data` (e.g. `crewDocumentsService.ts:218-224`). The 18 `/raw` routes enumerated in the standard (§7) do not exist.
- **Server-side size/MIME validation is missing** (Standard §4). Only the React dialog enforces the 5 MB / PDF-JPG-PNG limits (`client/src/components/FileAttachmentDialog.tsx:40-41,64-72`); no server route validates size or file signature before write.

---

## 2. Per-Module Compliance Table

| Module | Path Format OK? | Dual-Read OK? | Shared Infra Used? | Status | Notes |
|---|---|---|---|---|---|
| **Promotions** | ✅ Yes | ✅ N/A (new table, no `file_data`, serves disk via shared helper) | ✅ Yes | **Working / fully migrated** | New `promo_checklist_attachments_v2` (no `file_data`) ✔ standard §1. `writeAttachment` on save; `/raw` via `serveAttachmentFromFilePath`. This is **Plan Phase 6** — done out of order. |
| **Briefing (G1)** | ⚠️ N/A — never writes to disk | ❌ No — private decoder ignores disk | ❌ No — duplicate private `serveAttachment` | **Broken** | `crewBriefingController.ts:45-80` decodes only base64; `:150-176` stores client value, no `writeAttachment`. `/raw` route exists (`routes.ts:183`) but cannot serve disk files. Vessel-scoped (see §4). |
| **De-briefing (G2)** | ⚠️ N/A | ❌ No | ❌ No | **Broken** | Same defect via `:308-321`, route `routes.ts:194`. Vessel-scoped. |
| **Crew Pool — Documents/Visas/Education/Licenses/Training/Sea Service** | ❌ Not implemented | ❌ Stores base64 only | ❌ No | **Legacy base64 (not migrated)** | Live CRUD; services write `fileData` (`crewDocumentsService.ts:218-224`). No `/raw`, no `writeAttachment`. |
| **Crew Pool — Medical / Doctor Visits** | ❌ | ❌ | ❌ | **Legacy base64 (not migrated) + blocked** | Live CRUD; vessel-scoped per plan. |
| **Recruitment — Docs/Visas/Education/Licenses/Training/Sea Service/Additional Info** | ❌ | ❌ Base64 only | ❌ No | **Legacy base64 (not migrated)** | Live CRUD (`server/v2/recruitment/controllers/`); columns `shared/v2/recruitment/schema.ts:139-457`. No write/serve-to-disk logic. |
| **Screening B1–B8** | ❌ | ❌ | ❌ | **Legacy base64 (not migrated)** | Live CRUD via `server/v2/recruitment/controllers/screeningController.ts`. No `/raw`, no `writeAttachment`. |
| **Drugs & Alcohol** | ❌ | ❌ | ❌ | **Legacy base64 (not migrated) + blocked** | Live CRUD via `server/v2/drugs-alcohol/controllers/attachmentsController.ts`. Schema **already renamed** `filename`→`file_name` (`shared/v2/drugs-alcohol/schema.ts:94`) plus `file_path`/`file_data` (`:99-100`) — ahead of Plan Phase 5, but no code writes to disk. Vessel-scoped. |
| **Vessel Planning** | ❌ | ❌ | ❌ | **Legacy base64 (not migrated) + blocked** | Live CRUD via `server/v2/vessel/routes.ts` planning-attachment routes; columns + `upload_date` (`shared/v2/vessel/schema.ts:51-61`). Vessel-scoped. |

Legend: ✅ compliant · ⚠️ partial/ambiguous · ❌ not done.

---

## 3. Root-Cause Findings (with citations)

### 3.1 Briefing/De-briefing cannot serve disk-stored files — **broken**
- **Root cause:** `server/v2/crew-pool/controllers/crewBriefingController.ts:45-59` — `serveAttachment` computes `const stored = attachment.filePath || attachment.fileData;` then passes `stored` to a private `decodeStoredFile` (`:14-33`) that returns `null` unless the string `startsWith("data:")`. A relative disk path (e.g. `rsms/briefing/175..._ab12cd34_doc.pdf`) is therefore decoded to `null`, yielding `404 File content not available` (`:57-58`).
- **Compounding cause:** `addBriefingAttachment` (`:150-176`) and `addDebriefingAttachment` (`:270-296`) never call `fileStorageService.writeAttachment`; they store the raw request value into `file_path`/`file_data`. Service repository writes confirm base64 persistence (`server/v2/crew-pool/services/crewBriefingService.ts:285-291,373-379`).
- **Fallback defect:** Because `stored = attachment.filePath || attachment.fileData` (`:54`), a non-empty `file_path` short-circuits the `file_data` fallback. If a record is ever migrated so `file_path` holds a disk path *and* `file_data` is retained for dual-read, the disk path wins, the decoder returns `null`, and the still-present base64 is never tried — i.e. the dual-read contract is inverted into a hard failure.
- **Net effect:** The "pilot" is effectively still base64-in-DB with a *fragmented* serve path. It works only because nothing actually writes a disk path; the moment a disk path is written (e.g. by a backfill), serving 404s.

### 3.2 Shared serving contract is re-fragmented — **compliance break**
- Standard §6 mandates a single `serveAttachmentFromFilePath`. The correct shared helper exists (`server/v2/shared/serveAttachmentHelper.ts:45-112`) and is used by Promotions, but Briefing/De-briefing ship a **duplicate** `serveAttachment` + `decodeStoredFile` (`crewBriefingController.ts:14-80`). A third copy of `decodeStoredFile` lives in the backfill script (`server/utils/backfillAttachments.ts:25-45`). This is exactly the fragmentation the plan set out to eliminate.

### 3.3 Frontend thumbnail uses a non-URL path — **broken preview**
- `client/src/components/FileAttachmentDialog.tsx:372` sets `<img src={getFileContent(attachment)}>`; `getFileContent` (`:179-182`) returns `data || fileData || filePath || fileUrl`. For a filesystem-migrated image with no inline `data`, this yields the relative `filePath`, which the browser cannot render. View/Download paths correctly prefer `viewUrl` (`:219-247`, `:280-310`), but the thumbnail does not.

### 3.4 No server-side size/MIME validation — **compliance gap**
- Standard §4 requires server enforcement of a 5 MB ceiling and a MIME-signature allow-list. `fileStorageService.writeAttachment` (`server/v2/shared/fileStorageService.ts:52-76`) performs neither; client-only checks exist (`FileAttachmentDialog.tsx:40-41,64-72`). "Double guards" are not satisfied.

### 3.5 Path-traversal guard uses a prefix match — **hardening / [needs verification]**
- `server/v2/shared/fileStorageService.ts:86` guards with `resolvedPath.startsWith(PRIVATE_ROOT)`. `path.resolve(PRIVATE_ROOT, "../x")` is correctly rejected, but a *prefix* check would also accept a sibling directory whose name begins with the root string (classic `/.private` vs `/.private-evil`). Given inputs are DB-stored relative paths, exploitability is low, but the check should compare path segments (e.g. `path.relative` with no leading `..`). **[needs verification]** of whether any caller can supply attacker-controlled `file_path`.

### 3.6 Filename length cap diverges from the standard — **minor**
- Standard §2.5 says limit the sanitized portion to 200 chars; the implementation caps the base at 100 (`fileStorageService.ts:42-44`). Functionally safe (total stays < 255) but documents and code disagree.

### 3.7 Serving config / directory auto-creation
- **Nginx:** `deploy/nginx.conf.example` only aliases public build dirs (`:39-60`); there is no rule exposing `.private/`, and `.gitignore:32` ignores it. Direct access is implicitly blocked. There is **no explicit `deny` rule** for `.private/` — acceptable but worth adding defensively. **[needs verification]** against the production nginx (the example references Windows `C:/GitHub/...` paths, so it is illustrative, not the deployed config).
- **Directory auto-creation:** `writeAttachment` calls `fs.mkdir(targetDir, { recursive: true })` before write (`fileStorageService.ts:69`) — first-write does not fail. ✔

---

## 4. Offline-Readiness Risk Findings

1. **Disk writes are local and synchronous — safe offline.** `writeAttachment` performs no network I/O (`fileStorageService.ts:52-76`), so the write path itself works in a disconnected ship-side environment.
2. **Filesystem files do not sync ship↔shore.** The Plan (§5, and the Phase-2/4 caution) is explicit that no file-sync transport exists. Promotions already writes real files to `.private/` — those files will **not** replicate to vessels via the existing DB-level sync. On a vessel, a synced Promotions row would point at a `file_path` whose bytes never arrived → broken attachment. **This is the central offline risk.**
3. **Vessel-scoped modules have already been touched ahead of the sync layer.** The plan blocks Medical, Briefing, De-briefing, Drugs & Alcohol, and Vessel Planning until Phase 4. On this branch:
   - Briefing/De-briefing received the (mis-implemented) pilot — **violates the shore-only constraint** for vessel-scoped data.
   - Drugs & Alcohol schema was renamed (`file_name`) and `file_path` added — a Phase-5 action performed early.
   - Vessel Planning and Crew Medical received `file_path` columns.
   Schema-only changes are low-risk while no code writes disk paths, but they pre-stage a sync hazard.
4. **`syncConfig` must carry `file_path`.** Plan §5.1 requires `file_path` in the DB sync configuration so the path string replicates. **[needs verification]** — confirm `shared/syncConfig.ts` includes the new column for every migrated table; if it does not, even path strings will desync.
5. **No "pending sync" UX.** Plan §5.2 calls for a "File is transferring from shore…" overlay; the dialog has no such state (`FileAttachmentDialog.tsx`), so ship users would see broken previews rather than a pending indicator.

---

## 5. Plan-Sequencing Deviations & Risk

| Deviation | Evidence | Risk |
|---|---|---|
| **Phase 6 (Promotions) completed before Phases 1–3** | Promotions fully migrated; Recruitment/Crew Pool not | Low correctness risk in isolation, but Promotions writes real disk files with no sync layer (Phase 4) in place — premature for any vessel deployment. |
| **Phase 1 pilot (Briefing/De-briefing) implemented incorrectly** | `crewBriefingController.ts:14-80,150-176` | The validation goal of the pilot (prove disk write + dual-read) was not met; it neither writes to disk nor reads from it. |
| **Phase 5 schema work (D&A rename) done early** | `shared/v2/drugs-alcohol/schema.ts:94` | Column renamed with no code consuming it; harmless now but undocumented drift. |
| **Backfill script scoped only to Promotions** | `server/utils/backfillAttachments.ts:67-74` queries only `promo_checklist_progress_v2.deprecated_attachments_data` | Plan §3 describes backfilling all 26 tables; the script covers one. Misleading if treated as the general migrator. |
| **`attachments_data` already renamed to `deprecated_attachments_data`** | `shared/v2/promotions/schema.ts:162`; backfill `:69` | Plan/standard still reference `attachments_data`; docs are stale. |

---

## 6. Documentation Contradictions to Reconcile (docs need a follow-up revision)

1. **Briefing/De-briefing classification conflict:** Plan §2 Phase 1 calls them a *shore-only* pilot, but the §2 CAUTION block lists *Briefing* and *De-briefing* among the **vessel-scoped, sync-blocked** modules. These cannot both be true — clarify whether the pilot was ever permissible.
2. **`attachments_data` vs `deprecated_attachments_data`:** code already uses the `deprecated_` name; the plan/standard do not.
3. **D&A `filename`:** Plan §1a says the column "Uses `filename`… Action Needed: rename"; the schema is **already** `file_name`. The action is done; the doc is stale.
4. **Filename length:** Standard §2.5 says 200; code uses 100 (§3.6 above).

---

## 7. Recommended Next Changes (prioritized — NOT implemented)

### (a) Fixes required to make currently-broken functionality work
1. **Repair Briefing/De-briefing serving.** Replace the private `serveAttachment`/`decodeStoredFile` in `crewBriefingController.ts` with the shared `serveAttachmentFromFilePath`, and make `addBriefing/DebriefingAttachment` call `fileStorageService.writeAttachment` (parsing the incoming base64 into a buffer) so `file_path` holds a real disk path. Until fixed, do not run any backfill that writes disk paths for these tables.
2. **Fix frontend image thumbnails.** Prefer `viewUrl` for the `<img src>` (`FileAttachmentDialog.tsx:370-378`); fall back to inline `data` only for unsaved uploads. Otherwise migrated image attachments show broken thumbnails.

### (b) Compliance fixes to align with the standard
3. **Add server-side validation** (5 MB cap + MIME-signature allow-list) in the write path (`fileStorageService.writeAttachment` or the calling controllers) per Standard §4.
4. **Consolidate duplicated serve/decoder logic** into `serveAttachmentHelper.ts`; remove the private copies in `crewBriefingController.ts` and the standalone `decodeStoredFile` in `backfillAttachments.ts`.
5. **Implement the missing `/raw` routes + `writeAttachment` write paths** for Phase-2/3 shore-only modules (Recruitment + Screening, then Crew Pool shore sub-modules) *before* declaring them migrated; keep base64 dual-read active throughout.
6. **Harden the traversal guard** (`fileStorageService.ts:86`) to a segment-aware check, and reconcile the 100/200 length cap with the standard.

### (c) Nice-to-have hardening
7. **Add an explicit nginx `deny` for `.private/`** in the deployed config (not just reliance on alias scoping), and verify the production nginx (the example uses placeholder Windows paths).
8. **Do not migrate vessel-scoped modules (Medical, Doctor Visits, D&A, Vessel Planning, Briefing/De-briefing) to disk until the Phase-4 file-sync transport exists.** Confirm `shared/syncConfig.ts` carries `file_path`, and add the "Pending Sync" UI state before any vessel rollout.
9. **Update the docs** to fix the contradictions in §6 (briefing classification, column renames, length cap, single-table backfill scope).

---

## 8. Appendix — Key Files Referenced

- Shared infra: `server/v2/shared/fileStorageService.ts`, `server/v2/shared/serveAttachmentHelper.ts`
- Backfill: `server/utils/backfillAttachments.ts`
- Promotions: `server/v2/promotions/routes.ts`, `server/v2/promotions/controllers/promotionReviewsController.ts`, `server/v2/promotions/services/promotionReviewsService.ts`, `shared/v2/promotions/schema.ts`
- Briefing/De-briefing: `server/v2/crew-pool/routes.ts`, `server/v2/crew-pool/controllers/crewBriefingController.ts`, `server/v2/crew-pool/services/crewBriefingService.ts`
- Crew Pool / Recruitment / D&A / Vessel schemas: `shared/v2/crew-pool/schema.ts`, `shared/v2/recruitment/schema.ts`, `shared/v2/drugs-alcohol/schema.ts`, `shared/v2/vessel/schema.ts`
- Crew Pool services (base64 persistence): `server/v2/crew-pool/services/crewDocumentsService.ts`
- Frontend: `client/src/components/FileAttachmentDialog.tsx`
- Route mounting: `server/routes.ts:75,99`
- Serving/config: `deploy/nginx.conf.example`, `.gitignore:32`
