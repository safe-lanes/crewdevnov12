# Crew-portal entries: office verification gate + alert on submission

Plan: `C:\Users\datta\.claude\plans\1-entries-done-by-crew-luminous-raven.md`

## Checklist
- [x] Schema: `app_crew_pending_changes`, `app_crew_app_settings` (`shared/v2/crew-app/schema.ts`, `types.ts`)
- [x] Migrations 0214–0217 (pending-changes table, settings table, alert policy seed, review menu)
- [x] Extract shared adapters (`server/v2/crew-app/crew-information/adapters.ts`) — reused by both the crew-app write path and the office "apply" step
- [x] `pendingChangesRepository.ts` + `pendingChangesService.ts` (stage / apply / approve / reject / auto-apply toggle / alert emission)
- [x] Rewire `crew-information/controller.ts` (`updateSection`, `collectionHandler`, `getInformation`) to stage instead of write-through, overlay pending status, surface `recentSubmissions`
- [x] Rewire `attachmentController.ts` to stage attachments on a still-pending 'create' (canonical-record attachments stay live — documented scope decision)
- [x] New office review module `server/v2/crew-app-review/` (`routes.ts`, `controller.ts`), mounted at `/api/v2/crew-app-review`, gated by `requirePermission("Crew Portal Submissions", ...)`
- [x] Mobile UI: pending/awaiting-review badges (`CrewCollectionScreen.tsx`, `CrewProfileScreen.tsx`), "Recent submissions" card, `recentSubmissions` added to the client-side schema
- [x] Web UI: `CrewPortalSubmissionsPage.tsx` + hooks/api, wired into `CrewPoolModule_v2.tsx` / `CrewPoolSideBar.tsx`
- [x] `npm run check` (backend) and `mobile: npm run typecheck` — 0 new errors in touched files
- [x] Fixed a real bug found during review: `eq(targetUuid, null)` doesn't match `IS NULL` in Postgres — switched to `isNull()`, otherwise the "amend an already-pending edit instead of stacking a duplicate" dedup would have silently never worked for singleton sections / creates

## Explicit scope decisions (stated to user)
- Staging-queue approach (not in-place status flags) — canonical crew-pool tables are only touched by the approve step; every other module (crew-pool grid, reports, vessel planning) is unaffected.
- Gate applies to everything crew can submit: profile singletons + all 7 collections (incl. children).
- Attachment add/remove on an **already-canonical (previously approved) record** stays live/immediate, not gated — only a brand-new record's attachments are staged (alongside its pending 'create'). Documented trade-off to bound scope; flagged to the user.
- Rejected entries are not re-injected into the live collection list (would risk a stale rejection shadowing a fresh resubmission on the same record) — surfaced instead via a separate `recentSubmissions` readout.
- No new server-side RBAC primitive was invented for the review screen — reused the **existing** `requirePermission` middleware (`server/middleware/requirePermission.ts`), which CLAUDE.md's "known gap" section claims doesn't exist. Flagged as a doc correction.

## Bug found in manual testing (fixed)
- The alert's "View Details" link used a nested path (`/crew-pool/portal-submissions?pending=...`) that doesn't exist — `/crew-pool` is a single registered route (`App.tsx`) that switches its internal page via a query param, not nested routes (confirmed from the existing `crew`/`section`/`doc`/`visa` deep-link pattern already in `CrewPoolModule_v2.tsx`). First fix: pointed it at `/crew-pool?page=portal-submissions&pending=<uuid>` with a matching deep-link effect that opens the Portal Submissions tab and highlights the card — kept as a still-reachable path via the sidebar.
- Follow-up (per user): there's no per-record crew-pool route today (unlike `/recruitment/:recCanUuid`) — CrewInfoForm_v2 is a modal driven by internal state, not a URL. Scope confirmed as "fix the deep-link only" (not a routing refactor), so the alert `link` now reuses the *existing* `crew`/`section`/`doc`/`visa` query-param convention (same one the dashboard's crew drill-down already uses) to open straight into that crew member's record at the matching Section A–G, instead of landing on the review queue. Mapping: particulars/personal/contact/family/next-of-kin/vessel-types/children → B, documents/visas → C (+ `doc`/`visa` highlight when the change targets an existing record), education/licenses/training → D, sea-service → E.
- **Known limitation, not built**: CrewInfoForm_v2 shows the crew record's *current* (pre-approval) data — it has no "pending review" indicator or inline approve/reject for entries awaiting review. A reviewer following the alert link sees the record in context but still needs the Portal Submissions tab (sidebar) to actually approve/reject. Flagged rather than silently built around; would need touching CrewInfoForm_v2 itself if wanted later.

## Verification performed
- `npm run check` (root): 229 errors / 42 files both before and after all changes — confirms 0 new errors in any touched file (touched files: none appear in the error list).
- `mobile: npm run typecheck`: clean (one error surfaced and fixed — missing `recentSubmissions` in the client-side zod schema).
- Not run (no DB available in this environment): actual migration execution against a tenant DB, and an end-to-end manual pass (submit on mobile → alert appears → approve → appears in Crew Database grid → reject → reason shown on mobile). Recommended before merge: `npm run dev:all`, then the manual pass described in the plan's Verification section.
