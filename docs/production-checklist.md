# Company Form unfinished-draft migration rollback

Migration `0266_company_form_unfinished_drafts.sql` allows incomplete Company Form
drafts while retaining database completeness protection for released versions.
Once unfinished drafts exist, this migration cannot be rolled back until those
drafts are completed or removed through an authorised workflow. The rollback in
`migrations/rollback/0266_company_form_unfinished_drafts.sql` must refuse rather
than alter drafts: it validates the original constraints in one transaction
before removing any new guard. It never repairs, fills or deletes data.

# Production checklist

For the parent developers. These are checks and outstanding work, not a declaration that production is ready. Test counts below refer to the last code verification on 23-Oct-2026 at `963354b290912081f797cd0868740aca13e8600b`, not a new suite run for this documentation-only update. No item below is implemented or enabled by adding it here.

## Parent identity, permissions and signing

1. **SAIL Admin category.** Supply the SAIL Admin role category from the parent, so category-based support authority replaces the interim role-name whitelist while preserving the agreed bootstrap/recovery scope. References: `server/v2/admin/services/accessControlManagement.ts`, `server/v2/admin/services/accessControlParentSync.ts`.

2. **User-to-role linkage.** Link users to roles by the parent role identifier, not a role name; replace the current name-based lookup rather than relying on matching labels. Reference: `server/v2/auth/roleResolutionService.ts`.

3. **Office designations.** Supply real job titles for office users, rather than using access-role names as designations, because these values print on signed documents. Reference: `server/v2/company-forms/documentPdfRenderer.ts`.

4. **Authentication bypasses and normal parent sign-in.** Remove `AUTH_BYPASS` and `VITE_AUTH_BYPASS` from Configurations (`.replit`) and any published build/runtime configuration before publishing, since they must not reach the published app. Configure and verify the normal parent login/handoff with an ordinary Office crew-manager account and a vessel account whose parent-provided membership includes a fixture vessel. Verify signed-in attachment display through the screens, own-vessel access and a plain-language other-vessel refusal. Development personas are UI-only evidence, not evidence of authentication or parent tenant binding. Verify in production mode that login is enforced and unauthenticated requests cannot access protected screens or APIs. This proves the parent identity and tenant/vessel scope actually reach the guards; skipping it risks either exposing private files or refusing legitimate users.

5. **Seafarer self-signing.** Provide trusted account-to-seafarer linkage before enabling self-signing; a browser-supplied seafarer identifier is not proof of identity. Reference: `server/v2/company-forms/trustedPrincipalService.ts`; tracked as #353.

- **Deploy attachment security and provision the necessary grants.** Deploy the attachment guards together with a review of the View grants each Office and vessel role needs. Verify every attachment family, including signatures and stored PDFs. Without the guards private files may be exposed; without the grants users who should see them may be locked out. Do not solve display failures by broadening edit, override or management rights.

- **Default vessel-role access to crew documents and medical records.** Confirm parent-provisioned vessel roles receive the minimum View rights needed to reach their own vessel's documents and medical attachments through the screens, while other-vessel access remains refused. Fixture-only role grants do not establish production defaults. If skipped, officers may be unable to open records needed aboard, even when attachment storage is working.

- **Decide Training Needs Create rights for crewing managers.** Explicitly decide which parent roles receive the existing Training Needs Create permission, then verify that those users can confirm pre-joining compliance suggestions. Suggestions do not grant authority themselves; without the right, managers may see gaps but be unable to turn them into actionable needs.

## Parent master data and synchronisation

6. **Vessel owner and flag.** Supply owner and flag as master data before making them selectable rule dimensions; until then they remain “not yet available”. Reference: `docs/company-forms/applicability-dimensions.md`.

7. **Vessel feed and sync operation.** Every vessel batch must include vessel identifiers, a refused batch must raise an actionable alert rather than only a log, and synchronisation must have an automated schedule. Reference: #370 for the related identity-validation work.

8. **User vessel membership.** Establish and state the maximum delay between a parent membership change and its enforcement in SAIL, including removal of access.

9. **Vessel sync identity validation.** Complete the draft validation and audit of missing vessel identifiers and user vessel references before relying on the feed for access scope. Reference: #370, “Reject missing vessel IDs and audit user vessel references”.

10. **New-client onboarding order.** Import company sea service history first, then the crew list, then re-run the verified first-service backfill so the initial crew's facts reflect the available history. Reference: `docs/company-forms/crew-import-first-service-completion.md`; the re-run never changes sign-on captures or facts already frozen into requirements.

### Training compliance inputs

- **Review “Certificate expires” for every course, per client, before enabling blocking.** Have the client's administrator review each value in Admin against the actual certificate policy; do not assume development defaults are correct. A wrong value can create false gaps, block a valid seafarer or overlook an expired qualification.

- **Deploy must refuse an unresolved captured contract rank.** Rank capture is called unconditionally at `server/v2/rotation/services/rotationDeployService.ts:189`, but `server/v2/company-forms/subjects/crewAssignmentRuleContext.ts:3–22` can still store a null rank when identifiers do not resolve uniquely. Add a plain refusal before an assignment is deployed without its contract rank; never substitute present rank or a name match. The matrix now shows an amber hollow indicator for these cases, but no training requirement can be checked without rank. If skipped, deployment can leave compliance uncheckable rather than proving readiness. This remains outstanding work, not a change made here.

- **Verify the 67 unrecognised certificate course identifiers on the testing server.** The development investigation found 67 of 388 active certificates with identifiers matching no course: 10 `TRN-…` and 57 `SC…`. This is believed to be development configuration, not proof of a production defect; check the testing server independently. An unrecognised course currently contributes no recognised certificate and appears as “Not held”, indistinguishable from holding nothing. Decide whether and where to surface that mismatch. If skipped, held certificates may be overlooked and misleading gaps reported. Do not map or repair these records without a separate reviewed decision.

## Email, document storage and private data

11. **Email service and domain.** Implement the parent-owned email specification using a transactional service that supports attachments and delivery status, with sending-domain authorisation in place. Reference: `docs/company-forms/email-specification.md`.

12. **Production PDF storage.** Define and verify backup, restore and retention rules for stored form PDFs and their evidence, including original and void-notice copies. Reference: `docs/company-forms/pdf-archive-storage.md`.

13. **Private database backups.** Private backups under `generated-artifacts/` contain personal data; keep them outside Git and delete them when no longer needed.

### Training evidence and record integrity

- **No independent all-time checklist acceptance ledger.** Current frozen snapshots have passed integrity checks, but they are not a complete record of every historical checklist acceptance. Decide and deliver the retention/history needed before promising “every acceptance ever made” for a long-established client. If skipped, that request cannot be answered reliably from current records alone.

- **Certificate ownership and course references have no database foreign keys.** Review database enforcement for `crew_training_courses.crew_uuid` and `course_id`. Application updates now guard ownership, but direct SQL or another writer can still insert a certificate for a non-existent seafarer; course references also lack database-enforced validity. Decide canonical identifiers and any compatibility/data review before introducing constraints. If skipped, orphaned or unrecognised records can persist despite the application guard. No schema or data changes are authorised by this note.

- **Certificate course-reference changes have no retained before/after history.** `courseId` remains editable and the previous value is overwritten. Decide whether an audit history is required, including trusted actor, time and the old/new references. Last-modified metadata is not that history. If skipped, an auditor cannot establish which course a certificate was previously linked to or why it changed. See the read-only assessment below and `docs/training-matrix/profile-record-ownership-guards.md`.

## User-facing correctness and performance

14. **Admin performance.** Measure Admin screen load times on a production build, rather than treating development-preview timings as production evidence. Reference: `client/src/modules/admin/AdminModule.tsx`.

15. **Promotions for vessel users.** Fix the Promotions screen's use of Admin endpoints, which prevents vessel users from loading it, without granting those users Admin access. Reference: `client/src/modules/promotions/PromotionReviewForm.tsx`.

16. **Recruitment audit identity.** Remove acceptance of the browser-supplied `submittedByUuid` as the submitting identity and derive it from the authenticated actor on the server.

17. **Promotion form selection.** Make promotion form choice deterministic when two forms share a creation time, instead of relying on whichever is returned first. Reference: #331; `client/src/modules/promotions/PromotionReviewForm.tsx`.

18. **Shared HTTP client.** Replace raw `fetch()` calls that bypass the shared client so authentication and error handling are consistent. References: `client/src/lib/queryClient.ts`, `client/src/modules/admin/AdminModule.tsx`.

- **Signed-in screen checks after the ownership guards.** Verify normal editing/creation and a refused owner change through the screens for all seven guarded families: training certificates, travel documents, visas, licences, medical records, doctor visits and recruitment training. Confirm each 409 is shown as a plain sentence explaining delete-and-recreate, never raw JSON/error text or a broken screen. Server integration tests prove refusal, not signed-in screen presentation; skipping this can leave users facing an unexplained failure. Handler/service/repository references: `docs/training-matrix/profile-record-ownership-guards.md` and `docs/training-matrix/certificate-ownership-update-guard.md`.

## Automated verification

19. **Pending workflow tests.** Resolve the fixtures blocking the 67 pending wage, contract and vessel-workflow tests after the assignment guards; do not remove the guards or weaken assertions to make them run. Reference: `docs/testing-isolation.md`.

20. **Failing test baseline.** Investigate and resolve the 162 failing tests, mostly involving dead legacy endpoints, rather than treating the accepted baseline as a clean suite. The last verified full-suite result was **1,753 passed, 162 failed and 67 pending**. Company Forms: **661 passed across 97 suites, zero skipped**. TypeScript: **222 diagnostics**. These are the unchanged-code gates from the verification identified at the top, not fresh results produced by editing this checklist.

- **Mid-lifecycle fixtures are not evidence of a broken Deploy flow.** Several provisioning scripts insert assignments directly as `OnBoard`, bypassing Deploy and leaving captured contract ranks and published matrix context absent. This has caused three separate false-alarm investigations. Check fixture provenance and canonical context before diagnosing a product regression; otherwise repeated investigations test an impossible lifecycle rather than the real flow. The warning and preparation guidance are recorded under “Lifecycle of provisioned fixtures” in `docs/company-form-regression-fixtures.md`. No provisioning script is changed by this documentation task.

## Existing audit mechanisms — read-only assessment

**There is no general, automatic cross-application field-change ledger. There are existing scoped mechanisms whose before/after patterns could support one, but none currently records certificate course edits.** Reuse would require an explicit design, trusted actor propagation, retention and permissions; this checklist does not add that capability.

| What exists | Source and limits |
|---|---|
| Forms Engine created/updated timestamps and user UUIDs | `shared/v2/forms-engine/schema.ts:8–16`. These are last-write metadata, not the previous field values or a list of all edits. The common stamp helper is `server/v2/admin/utils/auditUser.ts:12–23`; its actor comes from the supplied transient `auditUserUuid`, so it is not by itself proof of server-derived identity. |
| Company Form requirement before/after history | `migrations/0247_requirement_recheck_audit.sql:3–15` defines `frm_requirement_audit()`, which writes old/new requirement rows as JSON, actor, reason and resolution run to `frm_requirement_history`. `server/v2/company-forms/requirementsRepository.ts:121–122` reads that history. This demonstrates row-level change evidence in the Forms work, but is scoped to requirements, not arbitrary table fields or certificate edits. |
| Released Company Form content/applicability comparison and snapshots | `server/v2/admin/services/versionChanges.ts:89–115` compares with the previous release and stores `content_changed`, `applicability_changed`, detail and content/policy snapshots in `frm_version_release_changes`. It is release history, not every draft-field edit. |
| Access Control before/after audit | `server/v2/admin/services/accessControlManagement.ts:64–79` derives an authenticated actor and appends resource/action, affected role, before/after JSON and details. `migrations/0236_access_control_management.sql:27–31` makes that audit append-only. It is tied to grant-management events, not a general certificate audit service. |
| Training-matrix equivalents and Training Needs suggestion histories | `server/v2/admin/services/trainingMatrixEquivalents.ts:86–92` records actor and before/after equivalent links. `server/v2/training-needs/complianceSuggestions.ts:16–22` records suggestion events, before/after, actor, reason and closing certificate. These are domain-specific logs; neither captures changes to a certificate's `courseId`. |
