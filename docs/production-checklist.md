# Production checklist

For the parent developers. These are checks and outstanding work, not a declaration that production is ready; test counts refer to the closing verification on 20-Oct-2026, not a new run for this document.

## Parent identity, permissions and signing

1. **SAIL Admin category.** Supply the SAIL Admin role category from the parent, so category-based support authority replaces the interim role-name whitelist while preserving the agreed bootstrap/recovery scope. References: `server/v2/admin/services/accessControlManagement.ts`, `server/v2/admin/services/accessControlParentSync.ts`.

2. **User-to-role linkage.** Link users to roles by the parent role identifier, not a role name; replace the current name-based lookup rather than relying on matching labels. Reference: `server/v2/auth/roleResolutionService.ts`.

3. **Office designations.** Supply real job titles for office users, rather than using access-role names as designations, because these values print on signed documents. Reference: `server/v2/company-forms/documentPdfRenderer.ts`.

4. **Authentication bypasses.** Remove `AUTH_BYPASS` and `VITE_AUTH_BYPASS` from Configurations (`.replit`) and any published build/runtime configuration before publishing, since they must not reach the published app. Verify in production mode that login is enforced and unauthenticated requests cannot access protected screens or APIs.

5. **Seafarer self-signing.** Provide trusted account-to-seafarer linkage before enabling self-signing; a browser-supplied seafarer identifier is not proof of identity. Reference: `server/v2/company-forms/trustedPrincipalService.ts`; tracked as #353.

## Parent master data and synchronisation

6. **Vessel owner and flag.** Supply owner and flag as master data before making them selectable rule dimensions; until then they remain “not yet available”. Reference: `docs/company-forms/applicability-dimensions.md`.

7. **Vessel feed and sync operation.** Every vessel batch must include vessel identifiers, a refused batch must raise an actionable alert rather than only a log, and synchronisation must have an automated schedule. Reference: #370 for the related identity-validation work.

8. **User vessel membership.** Establish and state the maximum delay between a parent membership change and its enforcement in SAIL, including removal of access.

9. **Vessel sync identity validation.** Complete the draft validation and audit of missing vessel identifiers and user vessel references before relying on the feed for access scope. Reference: #370, “Reject missing vessel IDs and audit user vessel references”.

10. **New-client onboarding order.** Import company sea service history first, then the crew list, then re-run the verified first-service backfill so the initial crew's facts reflect the available history. Reference: `docs/company-forms/crew-import-first-service-completion.md`; the re-run never changes sign-on captures or facts already frozen into requirements.

## Email, document storage and private data

11. **Email service and domain.** Implement the parent-owned email specification using a transactional service that supports attachments and delivery status, with sending-domain authorisation in place. Reference: `docs/company-forms/email-specification.md`.

12. **Production PDF storage.** Define and verify backup, restore and retention rules for stored form PDFs and their evidence, including original and void-notice copies. Reference: `docs/company-forms/pdf-archive-storage.md`.

13. **Private database backups.** Private backups under `generated-artifacts/` contain personal data; keep them outside Git and delete them when no longer needed.

## User-facing correctness and performance

14. **Admin performance.** Measure Admin screen load times on a production build, rather than treating development-preview timings as production evidence. Reference: `client/src/modules/admin/AdminModule.tsx`.

15. **Promotions for vessel users.** Fix the Promotions screen's use of Admin endpoints, which prevents vessel users from loading it, without granting those users Admin access. Reference: `client/src/modules/promotions/PromotionReviewForm.tsx`.

16. **Recruitment audit identity.** Remove acceptance of the browser-supplied `submittedByUuid` as the submitting identity and derive it from the authenticated actor on the server.

17. **Promotion form selection.** Make promotion form choice deterministic when two forms share a creation time, instead of relying on whichever is returned first. Reference: #331; `client/src/modules/promotions/PromotionReviewForm.tsx`.

18. **Shared HTTP client.** Replace raw `fetch()` calls that bypass the shared client so authentication and error handling are consistent. References: `client/src/lib/queryClient.ts`, `client/src/modules/admin/AdminModule.tsx`.

## Automated verification

19. **Pending workflow tests.** Resolve the fixtures blocking the 67 pending wage, contract and vessel-workflow tests after the assignment guards; do not remove the guards or weaken assertions to make them run. Reference: `docs/testing-isolation.md`.

20. **Failing test baseline.** Investigate and resolve the 162 failing tests, mostly involving dead legacy endpoints, rather than treating the accepted baseline as a clean suite. The last verified full-suite result was 1,281 passed, 162 failed and 67 pending.
