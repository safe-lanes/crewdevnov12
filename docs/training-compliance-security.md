# Training compliance: attachment access

Slice 1 precedes training compliance. Attachment reads require a resolved,
active parent role with the relevant explicit View grant. Ship/Vessel actors
also require complete server-resolved vessel membership and a current onboard
assignment for crew-level records. Recruitment evidence remains Office-only.
Deleted attachments, deleted parents/subjects and orphaned references are denied.
UUID possession and browser-supplied vessel claims never confer authority.

Private file reads additionally require the current tenant's storage prefix.
Legacy inline-file collection responses require the same subject access.

Later compliance slices use a separate **Override training compliance**
permission, default off for every parent role. **Override checklist** never
overrides training gaps. Training override records server identity, timestamp,
written reason and the overridden results. Existing Company Forms restrictions
on outstanding/started mandatory forms remain unchanged.

## Route inventory and grants

All paths below are relative to `/api/v2`. All families require normal JWT
authentication and tenant binding before their resource authorization.

| Family | Byte-serving routes | Explicit View authority |
| --- | --- | --- |
| Crew | `/crew-pool/{documents,visas,education,licenses,training,sea-service,medical,doctor-visits}/attachments/:attUuid/raw` (8); `/crew-pool/{briefing,debriefing}-attachments/:attUuid/raw` (2) | Crew Database |
| Recruitment | `/recruitment/{documents,visas,education,licenses,training,sea-service,additional-info}/attachments/:attUuid/raw` (7); `/recruitment/screening/{b1,b2,b3,b4,b5,b6,b8}/attachments/:attUuid/raw` (7) | Recruitment; Office only |
| Planning | `/vessel/planning/attachments/:attUuid/raw` (1) | Planning |
| D&A | `/drugs-alcohol/attachments/:attUuid/raw` (1) | Drugs Alcohol |
| Promotion | `/promotions/attachments/:attUuid/raw` (1) | Promotions |
| Standard Forms | `/{briefings,debriefings,interviews}/signatures/:sigAttUuid/raw` (3) | Crew Database for Briefing/Debriefing; Recruitment, Office only for Interview |
| Company Forms | `/company-form-submissions/:submissionUuid/attachments/:assetUuid/raw`; `/company-form-submissions/:submissionUuid/pdf` (2) | Company Forms View, using the existing subject adapter and stage/vessel scope |

Total: **32 byte-serving routes** from the proposal. No additional standalone
seafarer-attachment byte-serving route was found in the server route/stream scan.
Excel import/export templates are not seafarer attachments.

The additional attachment-bearing paths found beyond that byte-route inventory:

- Crew `/crew/:crewUuid/profile`, direct crew/by-employee reads and crew aggregate
  lists; per-crew document, visa, education, licence, training, sea-service,
  medical, doctor-visit and legacy Briefing/Debriefing collections.
- Recruitment candidate evidence collections; per-parent attachment collections;
  screening details and attachment collections.
- Planning `/planning/:planUuid/attachments`.
- D&A `/attachments/:testRecordUuid` and test-record detail/list/vessel-list
  responses, including JSON-encoded `attachmentFile`.
- Promotion review detail/list/crew/rank responses, including JSON-encoded
  `checklistProgressData` and `deprecatedAttachmentsData`.
- Standard Form submission detail responses exposing signature metadata.

JSON responses no longer expose private filesystem paths or legacy embedded
attachment bytes. Existing canonical `viewUrl`/raw URLs remain the route for
opening files. Crew profile/evidence reads authorize the exact seafarer;
attachment-bearing aggregate responses are narrowed for vessel actors.
Recruitment evidence never becomes Ship-readable through a collection endpoint.
Case variants and percent-encoded identifiers receive the same checks as the
Express routes; HEAD cannot bypass GET authorization.

## Ownership details

- Planning and D&A ownership is the active parent record's vessel, checked
  against active master vessels and complete persisted user vessel membership.
- Crew ownership requires an active crew record and a non-deleted, current,
  unsigned-off `OnBoard` assignment on the actor's vessel.
- Promotion traverses attachment → active checklist progress → active review →
  exact employee number → active crew record. Employee number is an identifier,
  not a rank/name fallback. Every intermediate link must exist and be active.
- Standard signatures traverse attachment → active signature → active section
  state → active pinned submission → active crew/candidate. Briefing additionally
  checks its recorded vessel. Debriefing has no captured vessel column and uses
  current onboard crew membership; no historical vessel is invented.
- Company Forms keep the existing pinned part/version ownership checks and
  independent permission model. Deleted/orphaned assignment and crew subjects
  cannot authorize asset or PDF reads. Cancellation is not treated as deletion.
- Private file reads enforce both lexical and real (symlink-resolved) tenant
  storage boundaries.

## Repeatable verification

Run `npm test -- tests/integration/api/attachment-security.test.ts`.

The suite uses real PostgreSQL tables in two disposable schemas of the
identity-verified test database, without a public search-path fallback. Only the
database connection provider is substituted to select those isolated schemas.
Production JWT verification, role/grant resolution, ownership queries,
controllers and byte-serving code execute normally. `AUTH_BYPASS` is disabled
before importing authentication; identities are persisted synthetic Office and
Ship users with signed test JWTs. No request user or permission outcome is mocked.

Each of the 32 routes is tested for authorized office reads; own-vessel reads
where the family permits vessel access; denied other vessel/tenant, missing
office/ship grant, unauthenticated/forged JWT, case aliases, deleted owners and
orphaned parents. Recruitment and Interview intentionally refuse even an
own-vessel Ship actor. Archived PDFs are immutable and have no soft-delete flag;
their deletion cases are deleted submissions and deleted assignment/crew owners.
Additional tests cover the secondary JSON response paths.

Synthetic attachment files and both schemas are removed by normal automated
teardown. No main-preview fixture is created or changed by these tests.
