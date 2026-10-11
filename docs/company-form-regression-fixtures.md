# Retained Company Form regression fixtures

## Standing fixture retention rule

Test fixtures stay in place and are registered in this document. They are never
hard-deleted, including temporary crew and assignment fixtures. Retain their
linked Planning, sea-service, submission, signature and audit context too.
Use distinct clearly labelled fixtures for new mutation tests; do not reset or
delete protected fixtures to repeat an acceptance check.

The applicability preview collector registers its crew/assignment pair even on
failure. The shared Vitest retention guard disables SQL DELETE, TRUNCATE and
DROP teardown in test cleanup/finally blocks and records the affected context
identifiers below. Negative database-refusal tests remain real database checks;
they must not remove a persisted fixture.

Step 0 tooling audit: the direct-delete helper in
scripts/verify-company-form-applicability.mjs was replaced with retained
registration. Other integration-test cleanup DELETE/ORM calls are disabled by
tests/helpers/fixture-retention.ts at the Pool and Client entry points.
The assignment deletion in company-form-stage-persistence.test.ts is an
expected foreign-key rejection, not a cleanup deletion. Do not disable or
count that refusal as a successful deletion.

Review closing uses existing vessel 03. Its multi-position AB and OS ranks
must use the actual configured role labels **AB_1** and **OS_1**. The newly
inserted test-owned rows `bd612319-89be-45ca-b370-578984e37284` and
`76185f39-38cf-4ccc-b957-a8f991e7b014` initially carried their parent rank
names; the supported Planning update corrects only those exact rows after
verifying crew/assignment ownership and no other Planning row at those role
positions. No existing occupant, master rank or vessel revision is altered.

These are retained development fixtures, not disposable test data. Do not delete them during cleanup or use them as production records.

## Readability and void-audit follow-up

The separate retained fixture and evidence are registered in
[Readable submission verification](company-forms/readable-submission-verification.md).
Only its new declaration `da1cba4e-76b7-44a0-b03c-19b881dfdaae` was signed,
completed and voided during that follow-up.

At the follow-up's starting capture on 2026-10-03, the original protected
submission `026068b1-a083-4f86-9bf0-166df6ba6f6a` was already voided and replaced.
The historical acceptance below describes its earlier completed state, not its
current lifecycle. The follow-up preserves that starting-state row and all
existing frozen values exactly, including its R017 snapshot.

## Joining declaration regression

Completed on 2026-10-02 for the Planning entry point. Under the revised limits, normal Rotation deployed the seafarer into a new Planning row on existing vessel 02. Real-browser signing, whole-form snapshot, automatic completion and source-change/reload acceptance passed.

| Record | Name or purpose | UUID |
| --- | --- | --- |
| Existing vessel | vessel 02; configured Pumpman rank R017; no synthetic vessel was created | `743feb08-841a-11ed-aa7c-7003bca91a86` |
| Synthetic seafarer | Name at signing: TEST ONLY JOINING DECLARATION REGRESSION; employee number `TEST-JOINING-DECL-REGRESSION` | `424584fc-dc59-4f85-aa14-30781eb8477e` |
| Synthetic Office actor | TEST ONLY JOINING DECLARATION CREWING ACTOR; master user ID 99 | `fe6a15d7-489f-4b53-8f3e-12e95915cfb3` |
| Synthetic role | TEST ONLY Joining Declaration Crewing | `95a1aff2-c823-4e08-b991-97072e4ae2a0` |
| Assignment | Planned assignment created by normal Rotation | `10df4ffb-db61-46a9-ac7a-cc5e290b7376` |
| Planning | New row; no existing Planning row modified | `accc9d51-ea2a-4a8c-8371-91902e377d5c` |
| Rotation draft | Retained deployment fixture | `432e8d30-fde4-4bdd-bc31-a13a19087faa` |
| Rotation entry | Deployed Pumpman fixture | `c9278073-8ac3-42d0-9a1b-724adf73ebf4` |
| Submission | Completed declaration, created and signed through the actual Planning UI | `026068b1-a083-4f86-9bf0-166df6ba6f6a` |
| Existing released form | Pre-Employment Declaration | `1b9daec7-87f9-498d-8f0f-9f7d72e49206` |
| Existing released version | Version 02; definition unchanged | `1fcd2e8d-1f88-489b-a7cc-cf48b18a712d` |

### Scope and retention

- Leave every fixture record in place, including the actor, custom role and grants.
- **Sync All may remove the synthetic actor and/or its custom role and grants.** Check their continued existence before reusing this fixture.
- The seafarer was created through the Crew Pool API. No assignment or Planning record was inserted directly.
- Deployment must use normal Rotation. First choose a configured rank with no Planning row on any existing vessel. Only if no such rank exists anywhere may one vessel 04 row without a current reliever be reused, with raw SQL before/after evidence. Do not invent a rank variant, create a synthetic vessel, alter vessel rank configuration, or replace a current operational reliever.
- Only this synthetic seafarer's source fields may be changed for the signing snapshot test. His first name was changed from `TEST ONLY` to `TEST ONLY SOURCE CHANGED` after completion; all other business fields stayed unchanged. The current name remains unmistakably synthetic.
- No released form definition may be modified. The preferred deployment path modifies no existing Planning row; the narrowly approved vessel 04 fallback was not needed.

### Actor permissions and read-only verification

No existing crewing Office account qualified with Crew Database view/create/edit and no Forms authoring grants, so the explicitly approved synthetic actor was created.

The synthetic role has Crew Database view/create/edit, Vessel view, and Vessel Database and Officer Matrix view/edit. The existing UI requires the latter edit permissions to enter vessel details and open the reliever popup. All delete permissions and all Forms permissions remain false. No existing actor's role or grants were changed.

At 2026-10-02 15:28:01 UTC, a real browser using actor 99 opened vessel 04's actual Planning reliever popup and manually selected released version 02. Association verification, eligible forms and history returned HTTP 200 as actor 99. All were GET requests. No declaration was started on the operational assignment used for this read-only check. The Forms authoring endpoint independently returned HTTP 403.

Evidence:

- `.local/verification/joining-declaration-retained-fixtures.json`
- `.local/verification/joining-no-authoring-picker.json`
- `.local/verification/joining-no-authoring-picker.png`

### Preferred deployment and completed acceptance

The search covered existing vessel masters and their configured ranks. Vessel 02's configured Pumpman rank R017 had no Planning row, including archived/deleted rows. Normal Rotation created the retained assignment and a new Planning row. Fingerprints of all 84 pre-existing Planning rows were identical before and after deployment. No vessel 04 fallback was used.

Deployment evidence: `.local/verification/joining-vessel-slot-search.json` and `.local/verification/joining-rotation-deployment.json`.

The real browser used the retained Office actor without Forms authoring access and performed:

1. Start/resume through the actual vessel 02 Planning reliever popup, selecting released version 02 manually.
2. A witnessed seafarer signature in General, with the seafarer-present checkbox checked and ink drawn using browser pointer actions.
3. Immediately after that first signature, before any section Submit, verification that all three pinned system fields were frozen:

   | Field | Frozen value | Authoritative comparison |
   | --- | --- | --- |
   | Seafarer name | TEST ONLY JOINING DECLARATION REGRESSION | Joined first/middle/family name from the synthetic seafarer record |
   | Rank | R017 | Synthetic seafarer's stored present rank |
   | Vessel to join | vessel 02 | Existing vessel master reached through the exact deployed assignment |

   The persisted snapshot event was `signature`, with three system-question snapshot rows. No section had a submission timestamp at this point.
4. A witnessed seafarer signature in Drug & Alcohol Policy, and Company Representative signatures in both policy sections. All four signatures were drawn and saved through the browser, not inserted through SQL or a signature API fixture. Persisted witness/representative identity is actor UUID `fe6a15d7-489f-4b53-8f3e-12e95915cfb3`.
5. Both policy sections submitted through their normal browser confirmation dialogs. The declaration automatically became `completed`, without a separate completion action. Basic Information stayed informational.
6. Only the synthetic seafarer's first name changed at 2026-10-02 15:48:27.278 UTC. The only changed database columns were `first_name` and the normal `updated_at`/`updated_by_uuid` audit fields.
7. Fresh browser reload and reopening of the existing completed declaration. All four signatures and frozen values remained, and the exact notice was visible:

   > The record has changed since signing began. This declaration shows the values at the time of first signature.

All 13 tracked pre-existing operational, identity, permission and definition table fingerprints remained identical, excluding only the explicitly retained new fixture identities. Forms authoring still returned HTTP 403. No released definition, existing Planning row, existing assignment, existing seafarer, existing actor or existing role/grant was changed.

### Evidence and restart chronology

Versioned evidence is retained under `docs/verification/joining-forms/`:

- `joining-rotation-deployment.json`: the empty slot before deployment, newly inserted Planning row and identical fingerprints of all 84 pre-existing Planning rows.
- `joining-authoritative-source-before-signature.json`: synthetic seafarer, exact assignment, Planning and existing vessel records used for comparison.
- `joining-first-signature-freeze.json`: whole-form snapshot immediately after the first signature, before section Submit.
- `joining-completed-before-source-change.json`: automatic completion, submitted sections and four persisted signature identities/methods.
- `joining-synthetic-source-change.json`: before/after of the synthetic seafarer only.
- `joining-verified-reload.json` and `joining-verified-reload.png`: completed declaration, frozen values and changed-record notice in the real browser.

The signing journey was checked against commit `df27c6cb9ccb0ac37395fd6e3d1afc35b56b2236` (2026-10-02 15:40:20 UTC), with the main backend restarted later and serving at 15:40:38 UTC. The final closing check is also run after this completion-document commit and a fresh backend restart. Its generated record is `.local/verification/joining-final-closing-reload.json`; it records the then-latest HEAD, commit time, actual backend PID/start, browser request actor identities and check time. The harness rejects a backend older than HEAD or a changing HEAD/PID during the journey.
### Retained sign-off fixture: role office

{
  "roleUuid": "8e955a2c-833e-44a0-9e13-5dc09359abfb",
  "role": "TEST ONLY SIGNOFF OFFICE"
}

UUIDs: `8e955a2c-833e-44a0-9e13-5dc09359abfb`

### Retained sign-off fixture: operational grant office

{
  "grantUuid": "285cf75a-25e5-4b4c-aa33-7291c31d3da0",
  "roleUuid": "8e955a2c-833e-44a0-9e13-5dc09359abfb",
  "menuUuid": "2dcbfb8e-8cf8-499e-ab9d-d21f9b635eb2",
  "menu": "Crew Pool"
}

UUIDs: `285cf75a-25e5-4b4c-aa33-7291c31d3da0`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `2dcbfb8e-8cf8-499e-ab9d-d21f9b635eb2`

### Retained sign-off fixture: operational grant office

{
  "grantUuid": "8d517029-d2a3-4179-8053-bfe5956fe095",
  "roleUuid": "8e955a2c-833e-44a0-9e13-5dc09359abfb",
  "menuUuid": "4128151d-7d76-43d9-aed5-779db86c0868",
  "menu": "Vessel"
}

UUIDs: `8d517029-d2a3-4179-8053-bfe5956fe095`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `4128151d-7d76-43d9-aed5-779db86c0868`

### Retained sign-off fixture: operational grant office

{
  "grantUuid": "0bb1e13a-b366-4828-945c-1c550892e694",
  "roleUuid": "8e955a2c-833e-44a0-9e13-5dc09359abfb",
  "menuUuid": "d48de98a-e18f-470d-abdb-f5cfa4d76f4a",
  "menu": "Rotation"
}

UUIDs: `0bb1e13a-b366-4828-945c-1c550892e694`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `d48de98a-e18f-470d-abdb-f5cfa4d76f4a`

### Retained sign-off fixture: operational grant office

{
  "grantUuid": "5c8aaa09-c7e5-4352-b27f-a0e993862626",
  "roleUuid": "8e955a2c-833e-44a0-9e13-5dc09359abfb",
  "menuUuid": "8e526cf4-d5ab-4e81-9736-bad10a722108",
  "menu": "Crew Database"
}

UUIDs: `5c8aaa09-c7e5-4352-b27f-a0e993862626`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `8e526cf4-d5ab-4e81-9736-bad10a722108`

### Retained sign-off fixture: operational grant office

{
  "grantUuid": "b2dc7bd9-11a8-4fc8-91f9-8440bf0b88de",
  "roleUuid": "8e955a2c-833e-44a0-9e13-5dc09359abfb",
  "menuUuid": "93f59ee0-e961-44bd-abed-d929c8c28e28",
  "menu": "Vessel Database"
}

UUIDs: `b2dc7bd9-11a8-4fc8-91f9-8440bf0b88de`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `93f59ee0-e961-44bd-abed-d929c8c28e28`

### Retained sign-off fixture: actor office

{
  "id": 290,
  "userUuid": "6552f03a-0b1b-4552-ad2c-dc5a9133f1bb",
  "roleUuid": "8e955a2c-833e-44a0-9e13-5dc09359abfb",
  "role": "TEST ONLY SIGNOFF OFFICE",
  "userType": "Office",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86"
}

UUIDs: `6552f03a-0b1b-4552-ad2c-dc5a9133f1bb`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: role master

{
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "role": "TEST ONLY SIGNOFF MASTER"
}

UUIDs: `95253478-3009-473d-afe7-b2b0f8498910`

### Retained sign-off fixture: operational grant master

{
  "grantUuid": "d61c2740-32f2-4875-8fc8-7a2596565897",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "menuUuid": "2dcbfb8e-8cf8-499e-ab9d-d21f9b635eb2",
  "menu": "Crew Pool"
}

UUIDs: `d61c2740-32f2-4875-8fc8-7a2596565897`, `95253478-3009-473d-afe7-b2b0f8498910`, `2dcbfb8e-8cf8-499e-ab9d-d21f9b635eb2`

### Retained sign-off fixture: operational grant master

{
  "grantUuid": "b3a0d430-34fd-4cd8-ab34-ec97ce1866e7",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "menuUuid": "4128151d-7d76-43d9-aed5-779db86c0868",
  "menu": "Vessel"
}

UUIDs: `b3a0d430-34fd-4cd8-ab34-ec97ce1866e7`, `95253478-3009-473d-afe7-b2b0f8498910`, `4128151d-7d76-43d9-aed5-779db86c0868`

### Retained sign-off fixture: operational grant master

{
  "grantUuid": "547d2be0-a266-4f16-a683-09726ff991da",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "menuUuid": "8e526cf4-d5ab-4e81-9736-bad10a722108",
  "menu": "Crew Database"
}

UUIDs: `547d2be0-a266-4f16-a683-09726ff991da`, `95253478-3009-473d-afe7-b2b0f8498910`, `8e526cf4-d5ab-4e81-9736-bad10a722108`

### Retained sign-off fixture: operational grant master

{
  "grantUuid": "8fe4a856-4c12-405a-add7-74a2459f0140",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "menuUuid": "93f59ee0-e961-44bd-abed-d929c8c28e28",
  "menu": "Vessel Database"
}

UUIDs: `8fe4a856-4c12-405a-add7-74a2459f0140`, `95253478-3009-473d-afe7-b2b0f8498910`, `93f59ee0-e961-44bd-abed-d929c8c28e28`

### Retained sign-off fixture: operational grant master

{
  "grantUuid": "c537fa07-f92f-4904-8687-752d4a9f876e",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "menuUuid": "88d90575-d77d-48e0-a25c-c6d9c6018297",
  "menu": "Officer Matrix"
}

UUIDs: `c537fa07-f92f-4904-8687-752d4a9f876e`, `95253478-3009-473d-afe7-b2b0f8498910`, `88d90575-d77d-48e0-a25c-c6d9c6018297`

### Retained sign-off fixture: actor master

{
  "id": 291,
  "userUuid": "184352f3-6cd9-4424-88b1-e6fde777f5e9",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "role": "TEST ONLY SIGNOFF MASTER",
  "userType": "Ship",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86"
}

UUIDs: `184352f3-6cd9-4424-88b1-e6fde777f5e9`, `95253478-3009-473d-afe7-b2b0f8498910`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: actor masterTwo

{
  "id": 292,
  "userUuid": "71c653aa-56cc-44ca-9dee-6c464eefbbb4",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "role": "TEST ONLY SIGNOFF MASTER",
  "userType": "Ship",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86"
}

UUIDs: `71c653aa-56cc-44ca-9dee-6c464eefbbb4`, `95253478-3009-473d-afe7-b2b0f8498910`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: actor wrongVessel

{
  "id": 293,
  "userUuid": "77e0603f-adf7-42ab-99e0-5088b07d2e2c",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "role": "TEST ONLY SIGNOFF MASTER",
  "userType": "Ship",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86"
}

UUIDs: `77e0603f-adf7-42ab-99e0-5088b07d2e2c`, `95253478-3009-473d-afe7-b2b0f8498910`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: actor unprovisioned

{
  "id": 294,
  "userUuid": "b6b86e86-f153-404e-ab00-62e823c63d01",
  "roleUuid": "95253478-3009-473d-afe7-b2b0f8498910",
  "role": "TEST ONLY SIGNOFF MASTER",
  "userType": "Ship",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86"
}

UUIDs: `b6b86e86-f153-404e-ab00-62e823c63d01`, `95253478-3009-473d-afe7-b2b0f8498910`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: role wrongRole

{
  "roleUuid": "55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9",
  "role": "TEST ONLY SIGNOFF WRONGROLE"
}

UUIDs: `55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9`

### Retained sign-off fixture: operational grant wrongRole

{
  "grantUuid": "925477c1-18db-4a39-80ba-cda14558451f",
  "roleUuid": "55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9",
  "menuUuid": "2dcbfb8e-8cf8-499e-ab9d-d21f9b635eb2",
  "menu": "Crew Pool"
}

UUIDs: `925477c1-18db-4a39-80ba-cda14558451f`, `55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9`, `2dcbfb8e-8cf8-499e-ab9d-d21f9b635eb2`

### Retained sign-off fixture: operational grant wrongRole

{
  "grantUuid": "ea9f7848-255c-4bfc-8d50-ef2a58e1ccdf",
  "roleUuid": "55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9",
  "menuUuid": "4128151d-7d76-43d9-aed5-779db86c0868",
  "menu": "Vessel"
}

UUIDs: `ea9f7848-255c-4bfc-8d50-ef2a58e1ccdf`, `55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9`, `4128151d-7d76-43d9-aed5-779db86c0868`

### Retained sign-off fixture: operational grant wrongRole

{
  "grantUuid": "f3214bb8-4a3e-4d79-8465-6999f28432ef",
  "roleUuid": "55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9",
  "menuUuid": "8e526cf4-d5ab-4e81-9736-bad10a722108",
  "menu": "Crew Database"
}

UUIDs: `f3214bb8-4a3e-4d79-8465-6999f28432ef`, `55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9`, `8e526cf4-d5ab-4e81-9736-bad10a722108`

### Retained sign-off fixture: operational grant wrongRole

{
  "grantUuid": "443cf303-68b5-4f7c-8ad7-a9e04b72cad4",
  "roleUuid": "55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9",
  "menuUuid": "93f59ee0-e961-44bd-abed-d929c8c28e28",
  "menu": "Vessel Database"
}

UUIDs: `443cf303-68b5-4f7c-8ad7-a9e04b72cad4`, `55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9`, `93f59ee0-e961-44bd-abed-d929c8c28e28`

### Retained sign-off fixture: operational grant wrongRole

{
  "grantUuid": "dc66dc4c-8d74-4d59-b3a3-1861ca848e57",
  "roleUuid": "55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9",
  "menuUuid": "88d90575-d77d-48e0-a25c-c6d9c6018297",
  "menu": "Officer Matrix"
}

UUIDs: `dc66dc4c-8d74-4d59-b3a3-1861ca848e57`, `55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9`, `88d90575-d77d-48e0-a25c-c6d9c6018297`

### Retained sign-off fixture: actor wrongRole

{
  "id": 295,
  "userUuid": "9bc47c6c-785a-4b4f-8764-45481f07a460",
  "roleUuid": "55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9",
  "role": "TEST ONLY SIGNOFF WRONGROLE",
  "userType": "Ship",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86"
}

UUIDs: `9bc47c6c-785a-4b4f-8764-45481f07a460`, `55bf68e0-d9e7-4f22-b1b8-dbd6c92d02e9`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: crew and Rotation original

{
  "key": "original",
  "crewUuid": "40c99db4-e080-44a3-8874-b43ec8d945ec",
  "draftUuid": "327f3c53-04a6-4169-a130-95293e0a649b",
  "entryUuid": "0d7f3717-eccd-48de-8897-d6b2d67d0067",
  "rankId": "R001",
  "rank": "Master",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF ORIGINAL SEAFARER"
}

UUIDs: `40c99db4-e080-44a3-8874-b43ec8d945ec`, `327f3c53-04a6-4169-a130-95293e0a649b`, `0d7f3717-eccd-48de-8897-d6b2d67d0067`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment original

{
  "key": "original",
  "crewUuid": "40c99db4-e080-44a3-8874-b43ec8d945ec",
  "draftUuid": "327f3c53-04a6-4169-a130-95293e0a649b",
  "entryUuid": "0d7f3717-eccd-48de-8897-d6b2d67d0067",
  "rankId": "R001",
  "rank": "Master",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF ORIGINAL SEAFARER",
  "planUuid": "e34e2da2-bcef-4a0e-8344-a106f8505136",
  "assignmentUuid": "8d529a30-8a45-4b5f-89fd-d923796a3cb1"
}

UUIDs: `40c99db4-e080-44a3-8874-b43ec8d945ec`, `327f3c53-04a6-4169-a130-95293e0a649b`, `0d7f3717-eccd-48de-8897-d6b2d67d0067`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `e34e2da2-bcef-4a0e-8344-a106f8505136`, `8d529a30-8a45-4b5f-89fd-d923796a3cb1`

### Retained sign-off fixture: crew and Rotation unfinished

{
  "key": "unfinished",
  "crewUuid": "c9a6b2a4-8879-4963-ba29-abd4b6127615",
  "draftUuid": "969763c4-adb4-40f6-aa50-837b572704ee",
  "entryUuid": "1e1e52dc-4eb7-4e1e-bfd1-6e4703532ae7",
  "rankId": "R002",
  "rank": "Chief Officer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF UNFINISHED SEAFARER"
}

UUIDs: `c9a6b2a4-8879-4963-ba29-abd4b6127615`, `969763c4-adb4-40f6-aa50-837b572704ee`, `1e1e52dc-4eb7-4e1e-bfd1-6e4703532ae7`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment unfinished

{
  "key": "unfinished",
  "crewUuid": "c9a6b2a4-8879-4963-ba29-abd4b6127615",
  "draftUuid": "969763c4-adb4-40f6-aa50-837b572704ee",
  "entryUuid": "1e1e52dc-4eb7-4e1e-bfd1-6e4703532ae7",
  "rankId": "R002",
  "rank": "Chief Officer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF UNFINISHED SEAFARER",
  "planUuid": "12ab57cb-f652-4306-a73a-4a3a366c9d32",
  "assignmentUuid": "337781b3-c623-4d1b-b4d1-cf2c54f36e7d"
}

UUIDs: `c9a6b2a4-8879-4963-ba29-abd4b6127615`, `969763c4-adb4-40f6-aa50-837b572704ee`, `1e1e52dc-4eb7-4e1e-bfd1-6e4703532ae7`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `12ab57cb-f652-4306-a73a-4a3a366c9d32`, `337781b3-c623-4d1b-b4d1-cf2c54f36e7d`

### Retained sign-off fixture: crew and Rotation dualOffice

{
  "key": "dualOffice",
  "crewUuid": "b64745eb-e056-49dd-82a5-907d0914e4a6",
  "draftUuid": "d0d143a3-98c3-4444-96e6-24d63fbab77c",
  "entryUuid": "f687c1d0-1ba5-44b5-ba76-abb338d1478f",
  "rankId": "R003",
  "rank": "2nd Officer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF DUALOFFICE SEAFARER"
}

UUIDs: `b64745eb-e056-49dd-82a5-907d0914e4a6`, `d0d143a3-98c3-4444-96e6-24d63fbab77c`, `f687c1d0-1ba5-44b5-ba76-abb338d1478f`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment dualOffice

{
  "key": "dualOffice",
  "crewUuid": "b64745eb-e056-49dd-82a5-907d0914e4a6",
  "draftUuid": "d0d143a3-98c3-4444-96e6-24d63fbab77c",
  "entryUuid": "f687c1d0-1ba5-44b5-ba76-abb338d1478f",
  "rankId": "R003",
  "rank": "2nd Officer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF DUALOFFICE SEAFARER",
  "planUuid": "de9c523e-ce24-4f2b-9756-2059be2f5485",
  "assignmentUuid": "5e4ba81b-81bb-4c3d-bbee-5633acd84d8e"
}

UUIDs: `b64745eb-e056-49dd-82a5-907d0914e4a6`, `d0d143a3-98c3-4444-96e6-24d63fbab77c`, `f687c1d0-1ba5-44b5-ba76-abb338d1478f`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `de9c523e-ce24-4f2b-9756-2059be2f5485`, `5e4ba81b-81bb-4c3d-bbee-5633acd84d8e`

### Retained sign-off fixture: crew and Rotation late

{
  "key": "late",
  "crewUuid": "143c938c-1ed3-4578-ab59-83402bac08e2",
  "draftUuid": "413d2635-ba29-4fa5-aa93-74324cdd0e62",
  "entryUuid": "b7cf0237-b55f-49ed-a298-e7abcbb8b401",
  "rankId": "R005",
  "rank": "Chief Engineer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF LATE SEAFARER"
}

UUIDs: `143c938c-1ed3-4578-ab59-83402bac08e2`, `413d2635-ba29-4fa5-aa93-74324cdd0e62`, `b7cf0237-b55f-49ed-a298-e7abcbb8b401`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment late

{
  "key": "late",
  "crewUuid": "143c938c-1ed3-4578-ab59-83402bac08e2",
  "draftUuid": "413d2635-ba29-4fa5-aa93-74324cdd0e62",
  "entryUuid": "b7cf0237-b55f-49ed-a298-e7abcbb8b401",
  "rankId": "R005",
  "rank": "Chief Engineer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF LATE SEAFARER",
  "planUuid": "d85d9d9a-bd84-4fde-a89d-fed0a1e9cb91",
  "assignmentUuid": "78f0db50-3045-486d-bdd3-6903d6b455f0"
}

UUIDs: `143c938c-1ed3-4578-ab59-83402bac08e2`, `413d2635-ba29-4fa5-aa93-74324cdd0e62`, `b7cf0237-b55f-49ed-a298-e7abcbb8b401`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `d85d9d9a-bd84-4fde-a89d-fed0a1e9cb91`, `78f0db50-3045-486d-bdd3-6903d6b455f0`

### Retained sign-off fixture: crew and Rotation viewers

{
  "key": "viewers",
  "crewUuid": "a867b6f9-c252-4a11-a722-1b678293a164",
  "draftUuid": "35f468aa-07de-4909-b6b3-535e9e291626",
  "entryUuid": "42c45a37-e02c-4e4e-a7a8-0dc7cca1c044",
  "rankId": "R006",
  "rank": "2nd Engineer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF VIEWERS SEAFARER"
}

UUIDs: `a867b6f9-c252-4a11-a722-1b678293a164`, `35f468aa-07de-4909-b6b3-535e9e291626`, `42c45a37-e02c-4e4e-a7a8-0dc7cca1c044`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment viewers

{
  "key": "viewers",
  "crewUuid": "a867b6f9-c252-4a11-a722-1b678293a164",
  "draftUuid": "35f468aa-07de-4909-b6b3-535e9e291626",
  "entryUuid": "42c45a37-e02c-4e4e-a7a8-0dc7cca1c044",
  "rankId": "R006",
  "rank": "2nd Engineer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF VIEWERS SEAFARER",
  "planUuid": "ade8413f-3cd3-4146-a6b3-f8677f266cfe",
  "assignmentUuid": "79edce12-9fcd-47f9-aca4-e527d7e46226"
}

UUIDs: `a867b6f9-c252-4a11-a722-1b678293a164`, `35f468aa-07de-4909-b6b3-535e9e291626`, `42c45a37-e02c-4e4e-a7a8-0dc7cca1c044`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `ade8413f-3cd3-4146-a6b3-f8677f266cfe`, `79edce12-9fcd-47f9-aca4-e527d7e46226`

### Retained sign-off fixture: definition aboard

{
  "key": "aboard",
  "formId": 1251,
  "formUuid": "e3165578-865a-444f-8399-ccc665bc585c",
  "versionId": 1877,
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c",
  "partUuid": "88ce766c-5d42-4bc3-85f7-3f0e19ad509b",
  "sectionUuid": "e8b60035-1a9f-438e-b091-d0c8944372ae",
  "questionUuids": [
    "a722fed9-ef5d-42f1-a5a5-6a576c2b2e01",
    "d1d64e7a-1914-40d4-8cdb-adf04e1f2049",
    "4c85d70a-4f92-4b48-ba46-412c492e1576",
    "6e093b7c-630d-4b8d-b188-125c2fd2d36d",
    "68f4b75b-9f76-46a5-956e-274dddc62ea1"
  ],
  "name": "TEST ONLY SIGNOFF ABOARD 2026-10-04T09:03:11.071Z",
  "stage": "at_sign_off"
}

UUIDs: `e3165578-865a-444f-8399-ccc665bc585c`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`, `88ce766c-5d42-4bc3-85f7-3f0e19ad509b`, `e8b60035-1a9f-438e-b091-d0c8944372ae`, `a722fed9-ef5d-42f1-a5a5-6a576c2b2e01`, `d1d64e7a-1914-40d4-8cdb-adf04e1f2049`, `4c85d70a-4f92-4b48-ba46-412c492e1576`, `6e093b7c-630d-4b8d-b188-125c2fd2d36d`, `68f4b75b-9f76-46a5-956e-274dddc62ea1`

### Retained sign-off fixture: persisted definition aboard

{
  "key": "aboard",
  "formId": 1251,
  "formUuid": "e3165578-865a-444f-8399-ccc665bc585c",
  "versionId": 1877,
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c",
  "partUuid": "88ce766c-5d42-4bc3-85f7-3f0e19ad509b",
  "sectionUuid": "c909aa25-95bc-4369-9473-5ab1597a6e11",
  "questionUuids": [
    "8052e960-c152-4687-abaa-597c076a0629",
    "0fdba70d-cdfd-4e12-8dad-b1f72f6b1be4",
    "09e8cdc0-b4c3-414c-a688-77ce876352fa",
    "b962f6ee-a139-4594-945c-ba3f6fd8d840",
    "34be4a19-d6e7-49da-8f61-533f3b24b205"
  ],
  "name": "TEST ONLY SIGNOFF ABOARD 2026-10-04T09:03:11.071Z",
  "stage": "at_sign_off"
}

UUIDs: `e3165578-865a-444f-8399-ccc665bc585c`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`, `88ce766c-5d42-4bc3-85f7-3f0e19ad509b`, `c909aa25-95bc-4369-9473-5ab1597a6e11`, `8052e960-c152-4687-abaa-597c076a0629`, `0fdba70d-cdfd-4e12-8dad-b1f72f6b1be4`, `09e8cdc0-b4c3-414c-a688-77ce876352fa`, `b962f6ee-a139-4594-945c-ba3f6fd8d840`, `34be4a19-d6e7-49da-8f61-533f3b24b205`

### Retained sign-off fixture: definition ashore

{
  "key": "ashore",
  "formId": 1252,
  "formUuid": "ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93",
  "versionId": 1878,
  "versionUuid": "7c1dac2c-5704-4127-9b90-42d0aae5de72",
  "partUuid": "b001b261-4a69-4a81-b56d-ce9685190528",
  "name": "TEST ONLY SIGNOFF ASHORE 2026-10-04T09:03:11.071Z",
  "stage": "at_sign_off"
}

UUIDs: `ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93`, `7c1dac2c-5704-4127-9b90-42d0aae5de72`, `b001b261-4a69-4a81-b56d-ce9685190528`

### Retained sign-off fixture: persisted definition ashore

{
  "key": "ashore",
  "formId": 1252,
  "formUuid": "ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93",
  "versionId": 1878,
  "versionUuid": "7c1dac2c-5704-4127-9b90-42d0aae5de72",
  "partUuid": "b001b261-4a69-4a81-b56d-ce9685190528",
  "name": "TEST ONLY SIGNOFF ASHORE 2026-10-04T09:03:11.071Z",
  "stage": "at_sign_off",
  "sectionUuid": "7574e16a-eb7c-4ecf-9ec9-b7d97cf85b5e",
  "questionUuids": [
    "6987ec14-dc39-4813-924b-dcc573056bff",
    "1730bf01-09b8-4702-9723-a529cc5e6bf8",
    "d0def786-1824-4107-a6e9-d4c9988c328f",
    "f69bb65a-3699-4dbb-9b32-15b5634838e6",
    "e2583f32-2394-4205-8c61-51b745eac925"
  ]
}

UUIDs: `ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93`, `7c1dac2c-5704-4127-9b90-42d0aae5de72`, `b001b261-4a69-4a81-b56d-ce9685190528`, `7574e16a-eb7c-4ecf-9ec9-b7d97cf85b5e`, `6987ec14-dc39-4813-924b-dcc573056bff`, `1730bf01-09b8-4702-9723-a529cc5e6bf8`, `d0def786-1824-4107-a6e9-d4c9988c328f`, `f69bb65a-3699-4dbb-9b32-15b5634838e6`, `e2583f32-2394-4205-8c61-51b745eac925`

### Retained sign-off fixture: definition dual

{
  "key": "dual",
  "formId": 1253,
  "formUuid": "65687d4f-634d-43c3-ade4-a0fdac84067a",
  "versionId": 1879,
  "versionUuid": "4d2faafb-108d-4d42-9b0d-99d049ef1092",
  "partUuid": "25968d4f-f713-43f6-a9c2-33f7c8626ebc",
  "name": "TEST ONLY SIGNOFF DUAL 2026-10-04T09:03:11.071Z",
  "stage": "at_sign_off"
}

UUIDs: `65687d4f-634d-43c3-ade4-a0fdac84067a`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`, `25968d4f-f713-43f6-a9c2-33f7c8626ebc`

### Retained sign-off fixture: persisted definition dual

{
  "key": "dual",
  "formId": 1253,
  "formUuid": "65687d4f-634d-43c3-ade4-a0fdac84067a",
  "versionId": 1879,
  "versionUuid": "4d2faafb-108d-4d42-9b0d-99d049ef1092",
  "partUuid": "25968d4f-f713-43f6-a9c2-33f7c8626ebc",
  "name": "TEST ONLY SIGNOFF DUAL 2026-10-04T09:03:11.071Z",
  "stage": "at_sign_off",
  "sectionUuid": "ad35bf8c-68db-4965-89a1-1864b9a1ca7a",
  "questionUuids": [
    "e36bfdf0-048c-4578-b67d-00ec8d8c3869",
    "845db391-d0cb-41ef-a1b9-ac0fc66b3ff8",
    "16ab1775-57c4-4ff2-9f20-2c228735b6f5",
    "60ba079a-a060-45ca-b79b-44b3a3c04b1b",
    "4b712731-1f5b-4f1a-bb0b-b410b8aea9c9"
  ]
}

UUIDs: `65687d4f-634d-43c3-ade4-a0fdac84067a`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`, `25968d4f-f713-43f6-a9c2-33f7c8626ebc`, `ad35bf8c-68db-4965-89a1-1864b9a1ca7a`, `e36bfdf0-048c-4578-b67d-00ec8d8c3869`, `845db391-d0cb-41ef-a1b9-ac0fc66b3ff8`, `16ab1775-57c4-4ff2-9f20-2c228735b6f5`, `60ba079a-a060-45ca-b79b-44b3a3c04b1b`, `4b712731-1f5b-4f1a-bb0b-b410b8aea9c9`

### Retained sign-off fixture: definition joining

{
  "key": "joining",
  "formId": 1254,
  "formUuid": "76bba5ce-5d99-41ee-9e26-f4062dd5f334",
  "versionId": 1880,
  "versionUuid": "fc0d0b19-4596-400a-86a8-29b7f54045d5",
  "partUuid": "7c63d4f1-59f4-4251-947f-6b6fd4bd2b81",
  "name": "TEST ONLY SIGNOFF JOINING 2026-10-04T09:03:11.071Z",
  "stage": "before_joining"
}

UUIDs: `76bba5ce-5d99-41ee-9e26-f4062dd5f334`, `fc0d0b19-4596-400a-86a8-29b7f54045d5`, `7c63d4f1-59f4-4251-947f-6b6fd4bd2b81`

### Retained sign-off fixture: persisted definition joining

{
  "key": "joining",
  "formId": 1254,
  "formUuid": "76bba5ce-5d99-41ee-9e26-f4062dd5f334",
  "versionId": 1880,
  "versionUuid": "fc0d0b19-4596-400a-86a8-29b7f54045d5",
  "partUuid": "7c63d4f1-59f4-4251-947f-6b6fd4bd2b81",
  "name": "TEST ONLY SIGNOFF JOINING 2026-10-04T09:03:11.071Z",
  "stage": "before_joining",
  "sectionUuid": "47d80a1c-12f9-4cdf-828a-09ae762e90e9",
  "questionUuids": [
    "9445309d-66c8-4475-bca0-aaf164df6c6b",
    "0377e158-c238-435b-89fc-5fb23941b2f4",
    "775ad0e3-9e1d-4698-962a-f379e90e331d",
    "f473e68e-59c7-43b0-83da-29418d1a09a2",
    "6e6a1015-c236-4e2a-9bbd-cdd43ec5477f"
  ]
}

UUIDs: `76bba5ce-5d99-41ee-9e26-f4062dd5f334`, `fc0d0b19-4596-400a-86a8-29b7f54045d5`, `7c63d4f1-59f4-4251-947f-6b6fd4bd2b81`, `47d80a1c-12f9-4cdf-828a-09ae762e90e9`, `9445309d-66c8-4475-bca0-aaf164df6c6b`, `0377e158-c238-435b-89fc-5fb23941b2f4`, `775ad0e3-9e1d-4698-962a-f379e90e331d`, `f473e68e-59c7-43b0-83da-29418d1a09a2`, `6e6a1015-c236-4e2a-9bbd-cdd43ec5477f`

### Retained sign-off fixture: definition onboard

{
  "key": "onboard",
  "formId": 1255,
  "formUuid": "88d2f57b-47e1-4319-925c-f3028102346a",
  "versionId": 1881,
  "versionUuid": "d0675224-a7dc-4ded-bb2b-d293a2bc7c70",
  "partUuid": "ca7f7034-85e9-402b-93fe-351bcb21e8ce",
  "name": "TEST ONLY SIGNOFF ONBOARD 2026-10-04T09:03:11.071Z",
  "stage": "on_board"
}

UUIDs: `88d2f57b-47e1-4319-925c-f3028102346a`, `d0675224-a7dc-4ded-bb2b-d293a2bc7c70`, `ca7f7034-85e9-402b-93fe-351bcb21e8ce`

### Retained sign-off fixture: persisted definition onboard

{
  "key": "onboard",
  "formId": 1255,
  "formUuid": "88d2f57b-47e1-4319-925c-f3028102346a",
  "versionId": 1881,
  "versionUuid": "d0675224-a7dc-4ded-bb2b-d293a2bc7c70",
  "partUuid": "ca7f7034-85e9-402b-93fe-351bcb21e8ce",
  "name": "TEST ONLY SIGNOFF ONBOARD 2026-10-04T09:03:11.071Z",
  "stage": "on_board",
  "sectionUuid": "43fc3903-3a50-4f9b-8496-346010142923",
  "questionUuids": [
    "d42108bf-170a-430a-be36-ce16d11f1ac5",
    "459844a9-9d24-42cc-af4c-cad1012977b6",
    "82bd9f3f-6440-4d65-9fef-13fcc9a73d43",
    "94144288-33b6-453a-942f-b4cd796b4962",
    "6d8ec913-ee2a-45c7-9ec4-c36618119795"
  ]
}

UUIDs: `88d2f57b-47e1-4319-925c-f3028102346a`, `d0675224-a7dc-4ded-bb2b-d293a2bc7c70`, `ca7f7034-85e9-402b-93fe-351bcb21e8ce`, `43fc3903-3a50-4f9b-8496-346010142923`, `d42108bf-170a-430a-be36-ce16d11f1ac5`, `459844a9-9d24-42cc-af4c-cad1012977b6`, `82bd9f3f-6440-4d65-9fef-13fcc9a73d43`, `94144288-33b6-453a-942f-b4cd796b4962`, `6d8ec913-ee2a-45c7-9ec4-c36618119795`

### Retained sign-off fixture: crew and Rotation reliever

{
  "key": "reliever",
  "crewUuid": "de36ff3d-aacd-4b8d-9d78-52c3c62f94e8",
  "draftUuid": "cab127df-df4c-44bc-9050-29ef54087cc5",
  "entryUuid": "120d99c4-0c5c-4add-a7a1-4584b42697e2",
  "rankId": "R008",
  "rank": "4th Engineer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF RELIEVER SEAFARER"
}

UUIDs: `de36ff3d-aacd-4b8d-9d78-52c3c62f94e8`, `cab127df-df4c-44bc-9050-29ef54087cc5`, `120d99c4-0c5c-4add-a7a1-4584b42697e2`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reliever

{
  "key": "reliever",
  "crewUuid": "de36ff3d-aacd-4b8d-9d78-52c3c62f94e8",
  "draftUuid": "cab127df-df4c-44bc-9050-29ef54087cc5",
  "entryUuid": "120d99c4-0c5c-4add-a7a1-4584b42697e2",
  "rankId": "R008",
  "rank": "4th Engineer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF RELIEVER SEAFARER",
  "planUuid": "ddb28fae-7d7d-4263-9b8f-98b8d76f4e31",
  "assignmentUuid": "a73c8208-96f6-41ce-847c-1d457a14b498"
}

UUIDs: `de36ff3d-aacd-4b8d-9d78-52c3c62f94e8`, `cab127df-df4c-44bc-9050-29ef54087cc5`, `120d99c4-0c5c-4add-a7a1-4584b42697e2`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `ddb28fae-7d7d-4263-9b8f-98b8d76f4e31`, `a73c8208-96f6-41ce-847c-1d457a14b498`

### Retained sign-off fixture: declaration original/aboard

{
  "crewUuid": "40c99db4-e080-44a3-8874-b43ec8d945ec",
  "assignmentUuid": "8d529a30-8a45-4b5f-89fd-d923796a3cb1",
  "submissionUuid": "fc849c20-cc2c-4d8b-898d-2e053e449221",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `40c99db4-e080-44a3-8874-b43ec8d945ec`, `8d529a30-8a45-4b5f-89fd-d923796a3cb1`, `fc849c20-cc2c-4d8b-898d-2e053e449221`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: crew and Rotation originalRetry

{
  "key": "originalRetry",
  "crewUuid": "1f8e587c-30e2-4e92-b63e-4f20d5dd97dd",
  "draftUuid": "0652584f-ba35-4829-9987-98a2aa82f85c",
  "entryUuid": "80c289a7-850b-4fad-8dab-ca63793ab3f3",
  "rankId": "R007",
  "rank": "3rd Engineer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF ORIGINALRETRY SEAFARER"
}

UUIDs: `1f8e587c-30e2-4e92-b63e-4f20d5dd97dd`, `0652584f-ba35-4829-9987-98a2aa82f85c`, `80c289a7-850b-4fad-8dab-ca63793ab3f3`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment originalRetry

{
  "key": "originalRetry",
  "crewUuid": "1f8e587c-30e2-4e92-b63e-4f20d5dd97dd",
  "draftUuid": "0652584f-ba35-4829-9987-98a2aa82f85c",
  "entryUuid": "80c289a7-850b-4fad-8dab-ca63793ab3f3",
  "rankId": "R007",
  "rank": "3rd Engineer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF ORIGINALRETRY SEAFARER",
  "planUuid": "9c45d796-34ec-43a0-b200-a668e892a9c7",
  "assignmentUuid": "9cae0acc-2fc0-442a-aa31-6d5501890281"
}

UUIDs: `1f8e587c-30e2-4e92-b63e-4f20d5dd97dd`, `0652584f-ba35-4829-9987-98a2aa82f85c`, `80c289a7-850b-4fad-8dab-ca63793ab3f3`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `9c45d796-34ec-43a0-b200-a668e892a9c7`, `9cae0acc-2fc0-442a-aa31-6d5501890281`

### Retained sign-off fixture: declaration originalRetry/aboard

{
  "crewUuid": "1f8e587c-30e2-4e92-b63e-4f20d5dd97dd",
  "assignmentUuid": "9cae0acc-2fc0-442a-aa31-6d5501890281",
  "submissionUuid": "82a712b8-3aca-4da7-bf79-ef2f02a92f75",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `1f8e587c-30e2-4e92-b63e-4f20d5dd97dd`, `9cae0acc-2fc0-442a-aa31-6d5501890281`, `82a712b8-3aca-4da7-bf79-ef2f02a92f75`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: declaration originalRetry/aboard

{
  "crewUuid": "1f8e587c-30e2-4e92-b63e-4f20d5dd97dd",
  "assignmentUuid": "9cae0acc-2fc0-442a-aa31-6d5501890281",
  "submissionUuid": "82a712b8-3aca-4da7-bf79-ef2f02a92f75",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `1f8e587c-30e2-4e92-b63e-4f20d5dd97dd`, `9cae0acc-2fc0-442a-aa31-6d5501890281`, `82a712b8-3aca-4da7-bf79-ef2f02a92f75`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: office post-sign-off declaration

{
  "submissionUuid": "03480ad7-4b5a-4102-9e98-afc55307865b",
  "assignmentUuid": "9cae0acc-2fc0-442a-aa31-6d5501890281",
  "versionUuid": "7c1dac2c-5704-4127-9b90-42d0aae5de72"
}

UUIDs: `03480ad7-4b5a-4102-9e98-afc55307865b`, `9cae0acc-2fc0-442a-aa31-6d5501890281`, `7c1dac2c-5704-4127-9b90-42d0aae5de72`

### Retained sign-off fixture: declaration unfinished/aboard

{
  "crewUuid": "c9a6b2a4-8879-4963-ba29-abd4b6127615",
  "assignmentUuid": "337781b3-c623-4d1b-b4d1-cf2c54f36e7d",
  "submissionUuid": "6f345b27-94cc-4be3-bd6b-0767cdc1968a",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `c9a6b2a4-8879-4963-ba29-abd4b6127615`, `337781b3-c623-4d1b-b4d1-cf2c54f36e7d`, `6f345b27-94cc-4be3-bd6b-0767cdc1968a`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: declaration late/dual

{
  "crewUuid": "143c938c-1ed3-4578-ab59-83402bac08e2",
  "assignmentUuid": "78f0db50-3045-486d-bdd3-6903d6b455f0",
  "submissionUuid": "f75e0a5f-893a-4c65-8f33-81262ec5ebb9",
  "versionUuid": "4d2faafb-108d-4d42-9b0d-99d049ef1092"
}

UUIDs: `143c938c-1ed3-4578-ab59-83402bac08e2`, `78f0db50-3045-486d-bdd3-6903d6b455f0`, `f75e0a5f-893a-4c65-8f33-81262ec5ebb9`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`

### Retained sign-off fixture: simultaneous late-signature declaration

{
  "assignmentUuid": "78f0db50-3045-486d-bdd3-6903d6b455f0",
  "submissionUuid": "79b89e39-0f95-487e-911a-c94eebc9ce23",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `78f0db50-3045-486d-bdd3-6903d6b455f0`, `79b89e39-0f95-487e-911a-c94eebc9ce23`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: declaration dualOffice/dual

{
  "crewUuid": "b64745eb-e056-49dd-82a5-907d0914e4a6",
  "assignmentUuid": "5e4ba81b-81bb-4c3d-bbee-5633acd84d8e",
  "submissionUuid": "0aebb0d8-6108-4c41-a3a1-72922eda606f",
  "versionUuid": "4d2faafb-108d-4d42-9b0d-99d049ef1092"
}

UUIDs: `b64745eb-e056-49dd-82a5-907d0914e4a6`, `5e4ba81b-81bb-4c3d-bbee-5633acd84d8e`, `0aebb0d8-6108-4c41-a3a1-72922eda606f`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`

### Retained sign-off fixture: sign-off/signature race declaration

{
  "assignmentUuid": "5e4ba81b-81bb-4c3d-bbee-5633acd84d8e",
  "submissionUuid": "5e163210-4eed-4217-907f-4005e995a81e"
}

UUIDs: `5e4ba81b-81bb-4c3d-bbee-5633acd84d8e`, `5e163210-4eed-4217-907f-4005e995a81e`

### Retained sign-off fixture: Crew List metadata declaration

{
  "submissionUuid": "cd29cf82-9f44-45d9-bf96-bd99aaec80e4",
  "assignmentUuid": "79edce12-9fcd-47f9-aca4-e527d7e46226",
  "versionUuid": "d0675224-a7dc-4ded-bb2b-d293a2bc7c70"
}

UUIDs: `cd29cf82-9f44-45d9-bf96-bd99aaec80e4`, `79edce12-9fcd-47f9-aca4-e527d7e46226`, `d0675224-a7dc-4ded-bb2b-d293a2bc7c70`

### Retained sign-off fixture: On Board Status metadata declaration

{
  "submissionUuid": "01ef546b-8138-46cf-9e07-90e94632fd8e",
  "assignmentUuid": "79edce12-9fcd-47f9-aca4-e527d7e46226",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `01ef546b-8138-46cf-9e07-90e94632fd8e`, `79edce12-9fcd-47f9-aca4-e527d7e46226`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: Reliever reciprocal metadata records

{
  "assignmentUuid": "a73c8208-96f6-41ce-847c-1d457a14b498",
  "originalUuid": "9e4d7f5a-9610-4a82-a580-978d5a84b8e1",
  "replacementUuid": "4a9f2955-6790-4be0-8d4a-d86a4a224fcd",
  "replacementVersionUuid": "8c0c5108-50c7-4ae6-ac8f-eea1746e41e8"
}

UUIDs: `a73c8208-96f6-41ce-847c-1d457a14b498`, `9e4d7f5a-9610-4a82-a580-978d5a84b8e1`, `4a9f2955-6790-4be0-8d4a-d86a4a224fcd`, `8c0c5108-50c7-4ae6-ac8f-eea1746e41e8`

### Retained sign-off fixture: persisted declaration, freeze, signature and attachment identities

{
  "uuids": [
    "e3165578-865a-444f-8399-ccc665bc585c",
    "8d529a30-8a45-4b5f-89fd-d923796a3cb1",
    "fc849c20-cc2c-4d8b-898d-2e053e449221",
    "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c",
    "c909aa25-95bc-4369-9473-5ab1597a6e11",
    "9cae0acc-2fc0-442a-aa31-6d5501890281",
    "82a712b8-3aca-4da7-bf79-ef2f02a92f75",
    "ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93",
    "03480ad7-4b5a-4102-9e98-afc55307865b",
    "7c1dac2c-5704-4127-9b90-42d0aae5de72",
    "7574e16a-eb7c-4ecf-9ec9-b7d97cf85b5e",
    "337781b3-c623-4d1b-b4d1-cf2c54f36e7d",
    "6f345b27-94cc-4be3-bd6b-0767cdc1968a",
    "65687d4f-634d-43c3-ade4-a0fdac84067a",
    "78f0db50-3045-486d-bdd3-6903d6b455f0",
    "f75e0a5f-893a-4c65-8f33-81262ec5ebb9",
    "4d2faafb-108d-4d42-9b0d-99d049ef1092",
    "ad35bf8c-68db-4965-89a1-1864b9a1ca7a",
    "79b89e39-0f95-487e-911a-c94eebc9ce23",
    "5e4ba81b-81bb-4c3d-bbee-5633acd84d8e",
    "0aebb0d8-6108-4c41-a3a1-72922eda606f",
    "5e163210-4eed-4217-907f-4005e995a81e",
    "88d2f57b-47e1-4319-925c-f3028102346a",
    "79edce12-9fcd-47f9-aca4-e527d7e46226",
    "cd29cf82-9f44-45d9-bf96-bd99aaec80e4",
    "d0675224-a7dc-4ded-bb2b-d293a2bc7c70",
    "01ef546b-8138-46cf-9e07-90e94632fd8e",
    "76bba5ce-5d99-41ee-9e26-f4062dd5f334",
    "a73c8208-96f6-41ce-847c-1d457a14b498",
    "9e4d7f5a-9610-4a82-a580-978d5a84b8e1",
    "fc0d0b19-4596-400a-86a8-29b7f54045d5",
    "4a9f2955-6790-4be0-8d4a-d86a4a224fcd",
    "8c0c5108-50c7-4ae6-ac8f-eea1746e41e8",
    "8052e960-c152-4687-abaa-597c076a0629",
    "2fc704f8-eb6e-4190-b350-6c090de1d011",
    "0fdba70d-cdfd-4e12-8dad-b1f72f6b1be4",
    "82ca4d46-b346-4a6f-8d25-09dd3f67f413",
    "09e8cdc0-b4c3-414c-a688-77ce876352fa",
    "cb8ce0e2-db2f-4c36-8623-402863e32747",
    "5292a31a-4078-49db-9452-e17ce90b78c7",
    "8e1ad158-c774-439a-8b34-d0ef612a2848",
    "f46487f3-cc37-48ec-87d2-ee907e67a53c",
    "6987ec14-dc39-4813-924b-dcc573056bff",
    "dabdf726-9f96-4986-b61c-e017242be92d",
    "1730bf01-09b8-4702-9723-a529cc5e6bf8",
    "46f3a74c-9b63-4641-8b14-39a1f080ce02",
    "d0def786-1824-4107-a6e9-d4c9988c328f",
    "e1ba5cda-75b6-4333-8b2c-cec67f839405",
    "e36bfdf0-048c-4578-b67d-00ec8d8c3869",
    "4ca33d84-b2e8-4229-b22b-87d9e42317d2",
    "845db391-d0cb-41ef-a1b9-ac0fc66b3ff8",
    "d3f14ee9-d3db-4337-803d-bc0275d825f4",
    "16ab1775-57c4-4ff2-9f20-2c228735b6f5",
    "d5a9feef-6f56-4eeb-8477-392968ca9701",
    "2558d822-e533-4de7-bc6d-366214155de0",
    "1883548f-1fb1-47e1-bfd8-e630bad0948f",
    "5351d4a3-f6c3-4a2e-934f-9ab1c8413b84",
    "a85aef19-701d-4a43-8a01-44371bb34957",
    "10f0ebea-e588-413d-b4d6-088d7d644615",
    "4f10910d-014d-4295-9e6a-ce7c720f3595",
    "ebeb48cd-6ac3-4e2d-8966-12fcaef1a0a5",
    "cfe9bb6c-a4de-4b92-818c-85b83a3377d7",
    "3279caa8-f407-4661-86b3-dbab35833462",
    "cafadb89-9ed7-41ce-90de-6711a7b709f4",
    "9296ff1e-ce90-45e8-b75d-344909a1beb0",
    "920fd6de-6364-4071-a24f-c084b1acbe19",
    "184352f3-6cd9-4424-88b1-e6fde777f5e9",
    "95253478-3009-473d-afe7-b2b0f8498910",
    "f22f778d-78b0-4aeb-83f4-2770a5ecf6a1",
    "40c99db4-e080-44a3-8874-b43ec8d945ec",
    "7440571a-841a-11ed-aa7c-7003bca91a86",
    "72ee3817-6dcd-4737-bfc3-7bdc78329b4e",
    "04863f76-9920-4e6f-a69b-ea09155dee66",
    "ae31d626-f537-48f7-98e2-1caa87f81eec",
    "95a95798-0dc2-4a75-b7d2-1fc9eb17bf6a",
    "1f8e587c-30e2-4e92-b63e-4f20d5dd97dd",
    "f9cc0516-0872-4cd0-9f86-786ddac35e61",
    "71e62af5-15ad-4170-9235-207e89c2d8e8",
    "0582286d-25ff-432d-8bda-2ed1d24e87c9",
    "6552f03a-0b1b-4552-ad2c-dc5a9133f1bb",
    "8e955a2c-833e-44a0-9e13-5dc09359abfb",
    "73a7631e-c084-4619-beae-eec03ce1a604",
    "a9b25172-ba2c-43a9-94c2-5ffef8989a20",
    "9c992aaa-3993-4701-93ef-90d0faf50c8f",
    "615d8091-48fd-46f3-aebc-740e9e30ae8a",
    "7d123c06-f464-41dd-b5fe-83b31167cb61",
    "143c938c-1ed3-4578-ab59-83402bac08e2",
    "aa138b71-f579-4df4-a6ec-e7de746b1582",
    "d293c4a2-6956-43ae-b5d0-1d8abfb46eed",
    "0744a6bb-de25-4d15-885d-4fc9dfd0b2db",
    "1779f213-4cd8-4826-b020-9595a54ad55b",
    "26a24ca0-e6d4-4afb-9e7d-327477a6f9ac",
    "1aee88ff-5f2a-4ec2-aa5a-5e81bf7f9894",
    "2a418b33-0fe5-4ca4-9f85-23886ebd77dc",
    "c00f1dbe-ead3-4a1b-807e-eefcc1ed6473",
    "b64745eb-e056-49dd-82a5-907d0914e4a6",
    "479f9f09-f734-4547-b7d3-0165cfa65e1f",
    "eac98a9c-a722-4ff0-a3c3-db47e801674c",
    "2d00a271-9e66-4517-b825-69368e0e7ce8"
  ]
}

UUIDs: `e3165578-865a-444f-8399-ccc665bc585c`, `8d529a30-8a45-4b5f-89fd-d923796a3cb1`, `fc849c20-cc2c-4d8b-898d-2e053e449221`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`, `c909aa25-95bc-4369-9473-5ab1597a6e11`, `9cae0acc-2fc0-442a-aa31-6d5501890281`, `82a712b8-3aca-4da7-bf79-ef2f02a92f75`, `ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93`, `03480ad7-4b5a-4102-9e98-afc55307865b`, `7c1dac2c-5704-4127-9b90-42d0aae5de72`, `7574e16a-eb7c-4ecf-9ec9-b7d97cf85b5e`, `337781b3-c623-4d1b-b4d1-cf2c54f36e7d`, `6f345b27-94cc-4be3-bd6b-0767cdc1968a`, `65687d4f-634d-43c3-ade4-a0fdac84067a`, `78f0db50-3045-486d-bdd3-6903d6b455f0`, `f75e0a5f-893a-4c65-8f33-81262ec5ebb9`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`, `ad35bf8c-68db-4965-89a1-1864b9a1ca7a`, `79b89e39-0f95-487e-911a-c94eebc9ce23`, `5e4ba81b-81bb-4c3d-bbee-5633acd84d8e`, `0aebb0d8-6108-4c41-a3a1-72922eda606f`, `5e163210-4eed-4217-907f-4005e995a81e`, `88d2f57b-47e1-4319-925c-f3028102346a`, `79edce12-9fcd-47f9-aca4-e527d7e46226`, `cd29cf82-9f44-45d9-bf96-bd99aaec80e4`, `d0675224-a7dc-4ded-bb2b-d293a2bc7c70`, `01ef546b-8138-46cf-9e07-90e94632fd8e`, `76bba5ce-5d99-41ee-9e26-f4062dd5f334`, `a73c8208-96f6-41ce-847c-1d457a14b498`, `9e4d7f5a-9610-4a82-a580-978d5a84b8e1`, `fc0d0b19-4596-400a-86a8-29b7f54045d5`, `4a9f2955-6790-4be0-8d4a-d86a4a224fcd`, `8c0c5108-50c7-4ae6-ac8f-eea1746e41e8`, `8052e960-c152-4687-abaa-597c076a0629`, `2fc704f8-eb6e-4190-b350-6c090de1d011`, `0fdba70d-cdfd-4e12-8dad-b1f72f6b1be4`, `82ca4d46-b346-4a6f-8d25-09dd3f67f413`, `09e8cdc0-b4c3-414c-a688-77ce876352fa`, `cb8ce0e2-db2f-4c36-8623-402863e32747`, `5292a31a-4078-49db-9452-e17ce90b78c7`, `8e1ad158-c774-439a-8b34-d0ef612a2848`, `f46487f3-cc37-48ec-87d2-ee907e67a53c`, `6987ec14-dc39-4813-924b-dcc573056bff`, `dabdf726-9f96-4986-b61c-e017242be92d`, `1730bf01-09b8-4702-9723-a529cc5e6bf8`, `46f3a74c-9b63-4641-8b14-39a1f080ce02`, `d0def786-1824-4107-a6e9-d4c9988c328f`, `e1ba5cda-75b6-4333-8b2c-cec67f839405`, `e36bfdf0-048c-4578-b67d-00ec8d8c3869`, `4ca33d84-b2e8-4229-b22b-87d9e42317d2`, `845db391-d0cb-41ef-a1b9-ac0fc66b3ff8`, `d3f14ee9-d3db-4337-803d-bc0275d825f4`, `16ab1775-57c4-4ff2-9f20-2c228735b6f5`, `d5a9feef-6f56-4eeb-8477-392968ca9701`, `2558d822-e533-4de7-bc6d-366214155de0`, `1883548f-1fb1-47e1-bfd8-e630bad0948f`, `5351d4a3-f6c3-4a2e-934f-9ab1c8413b84`, `a85aef19-701d-4a43-8a01-44371bb34957`, `10f0ebea-e588-413d-b4d6-088d7d644615`, `4f10910d-014d-4295-9e6a-ce7c720f3595`, `ebeb48cd-6ac3-4e2d-8966-12fcaef1a0a5`, `cfe9bb6c-a4de-4b92-818c-85b83a3377d7`, `3279caa8-f407-4661-86b3-dbab35833462`, `cafadb89-9ed7-41ce-90de-6711a7b709f4`, `9296ff1e-ce90-45e8-b75d-344909a1beb0`, `920fd6de-6364-4071-a24f-c084b1acbe19`, `184352f3-6cd9-4424-88b1-e6fde777f5e9`, `95253478-3009-473d-afe7-b2b0f8498910`, `f22f778d-78b0-4aeb-83f4-2770a5ecf6a1`, `40c99db4-e080-44a3-8874-b43ec8d945ec`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `72ee3817-6dcd-4737-bfc3-7bdc78329b4e`, `04863f76-9920-4e6f-a69b-ea09155dee66`, `ae31d626-f537-48f7-98e2-1caa87f81eec`, `95a95798-0dc2-4a75-b7d2-1fc9eb17bf6a`, `1f8e587c-30e2-4e92-b63e-4f20d5dd97dd`, `f9cc0516-0872-4cd0-9f86-786ddac35e61`, `71e62af5-15ad-4170-9235-207e89c2d8e8`, `0582286d-25ff-432d-8bda-2ed1d24e87c9`, `6552f03a-0b1b-4552-ad2c-dc5a9133f1bb`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `73a7631e-c084-4619-beae-eec03ce1a604`, `a9b25172-ba2c-43a9-94c2-5ffef8989a20`, `9c992aaa-3993-4701-93ef-90d0faf50c8f`, `615d8091-48fd-46f3-aebc-740e9e30ae8a`, `7d123c06-f464-41dd-b5fe-83b31167cb61`, `143c938c-1ed3-4578-ab59-83402bac08e2`, `aa138b71-f579-4df4-a6ec-e7de746b1582`, `d293c4a2-6956-43ae-b5d0-1d8abfb46eed`, `0744a6bb-de25-4d15-885d-4fc9dfd0b2db`, `1779f213-4cd8-4826-b020-9595a54ad55b`, `26a24ca0-e6d4-4afb-9e7d-327477a6f9ac`, `1aee88ff-5f2a-4ec2-aa5a-5e81bf7f9894`, `2a418b33-0fe5-4ca4-9f85-23886ebd77dc`, `c00f1dbe-ead3-4a1b-807e-eefcc1ed6473`, `b64745eb-e056-49dd-82a5-907d0914e4a6`, `479f9f09-f734-4547-b7d3-0165cfa65e1f`, `eac98a9c-a722-4ff0-a3c3-db47e801674c`, `2d00a271-9e66-4517-b825-69368e0e7ce8`

### Retained sign-off fixture: crew and Rotation reviewOriginal

{
  "key": "reviewOriginal",
  "crewUuid": "1078e8df-d82f-4f0a-89ea-d60695685ac6",
  "draftUuid": "bc78a4eb-1fd2-4e8c-800e-1b9bee4e8fc7",
  "entryUuid": "87523b90-a9fe-4c90-954e-6d8d314ceb0c",
  "rankId": "R010",
  "rank": "Electrical Officer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWORIGINAL SEAFARER"
}

UUIDs: `1078e8df-d82f-4f0a-89ea-d60695685ac6`, `bc78a4eb-1fd2-4e8c-800e-1b9bee4e8fc7`, `87523b90-a9fe-4c90-954e-6d8d314ceb0c`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reviewOriginal

{
  "key": "reviewOriginal",
  "crewUuid": "1078e8df-d82f-4f0a-89ea-d60695685ac6",
  "draftUuid": "bc78a4eb-1fd2-4e8c-800e-1b9bee4e8fc7",
  "entryUuid": "87523b90-a9fe-4c90-954e-6d8d314ceb0c",
  "rankId": "R010",
  "rank": "Electrical Officer",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWORIGINAL SEAFARER",
  "planUuid": "a36b1dda-391c-483f-bcfe-f4c74dedfcfe",
  "assignmentUuid": "e3ef921e-69d3-45b6-a098-208f160b3b3a"
}

UUIDs: `1078e8df-d82f-4f0a-89ea-d60695685ac6`, `bc78a4eb-1fd2-4e8c-800e-1b9bee4e8fc7`, `87523b90-a9fe-4c90-954e-6d8d314ceb0c`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `a36b1dda-391c-483f-bcfe-f4c74dedfcfe`, `e3ef921e-69d3-45b6-a098-208f160b3b3a`

### Retained sign-off fixture: crew and Rotation reviewUnfinished

{
  "key": "reviewUnfinished",
  "crewUuid": "ca0e1d0e-f087-4945-9a8c-0d91c8a234bf",
  "draftUuid": "43f85830-5a6d-48b0-9ad7-37b850043793",
  "entryUuid": "ae790b43-d4c7-4495-b3c7-c47f306ed2de",
  "rankId": "R012",
  "rank": "Deck Cadet",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWUNFINISHED SEAFARER"
}

UUIDs: `ca0e1d0e-f087-4945-9a8c-0d91c8a234bf`, `43f85830-5a6d-48b0-9ad7-37b850043793`, `ae790b43-d4c7-4495-b3c7-c47f306ed2de`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reviewUnfinished

{
  "key": "reviewUnfinished",
  "crewUuid": "ca0e1d0e-f087-4945-9a8c-0d91c8a234bf",
  "draftUuid": "43f85830-5a6d-48b0-9ad7-37b850043793",
  "entryUuid": "ae790b43-d4c7-4495-b3c7-c47f306ed2de",
  "rankId": "R012",
  "rank": "Deck Cadet",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWUNFINISHED SEAFARER",
  "planUuid": "93150289-cb59-4af4-a4a2-e1322ed7184d",
  "assignmentUuid": "508e268c-74fb-413b-a393-5c137590acc5"
}

UUIDs: `ca0e1d0e-f087-4945-9a8c-0d91c8a234bf`, `43f85830-5a6d-48b0-9ad7-37b850043793`, `ae790b43-d4c7-4495-b3c7-c47f306ed2de`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `93150289-cb59-4af4-a4a2-e1322ed7184d`, `508e268c-74fb-413b-a393-5c137590acc5`

### Retained sign-off fixture: crew and Rotation reviewOffice

{
  "key": "reviewOffice",
  "crewUuid": "5fc6484b-d841-45dc-87ec-57af18ba4b32",
  "draftUuid": "c8cdb707-82f5-4123-a6f4-fc6600d89752",
  "entryUuid": "05545d52-be9e-484a-8dac-0098c022dffe",
  "rankId": "R014",
  "rank": "Bosun",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWOFFICE SEAFARER"
}

UUIDs: `5fc6484b-d841-45dc-87ec-57af18ba4b32`, `c8cdb707-82f5-4123-a6f4-fc6600d89752`, `05545d52-be9e-484a-8dac-0098c022dffe`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reviewOffice

{
  "key": "reviewOffice",
  "crewUuid": "5fc6484b-d841-45dc-87ec-57af18ba4b32",
  "draftUuid": "c8cdb707-82f5-4123-a6f4-fc6600d89752",
  "entryUuid": "05545d52-be9e-484a-8dac-0098c022dffe",
  "rankId": "R014",
  "rank": "Bosun",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWOFFICE SEAFARER",
  "planUuid": "d6c98b69-4ef4-457a-aa89-06b99e7c96b5",
  "assignmentUuid": "de9e4a71-4263-4630-a406-03feb0175c28"
}

UUIDs: `5fc6484b-d841-45dc-87ec-57af18ba4b32`, `c8cdb707-82f5-4123-a6f4-fc6600d89752`, `05545d52-be9e-484a-8dac-0098c022dffe`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `d6c98b69-4ef4-457a-aa89-06b99e7c96b5`, `de9e4a71-4263-4630-a406-03feb0175c28`

### Retained sign-off fixture: crew and Rotation reviewLate

{
  "key": "reviewLate",
  "crewUuid": "3e2a1cf1-32a3-413e-b269-f1512d02467b",
  "draftUuid": "b11166c2-678d-4fe2-baf8-99a10bad3585",
  "entryUuid": "d7059109-183b-482c-a8cc-92072e81eaf0",
  "rankId": "R015",
  "rank": "AB",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWLATE SEAFARER"
}

UUIDs: `3e2a1cf1-32a3-413e-b269-f1512d02467b`, `b11166c2-678d-4fe2-baf8-99a10bad3585`, `d7059109-183b-482c-a8cc-92072e81eaf0`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reviewLate

{
  "key": "reviewLate",
  "crewUuid": "3e2a1cf1-32a3-413e-b269-f1512d02467b",
  "draftUuid": "b11166c2-678d-4fe2-baf8-99a10bad3585",
  "entryUuid": "d7059109-183b-482c-a8cc-92072e81eaf0",
  "rankId": "R015",
  "rank": "AB",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWLATE SEAFARER",
  "planUuid": "bd612319-89be-45ca-b370-578984e37284",
  "assignmentUuid": "23d48149-5cd4-4f56-9324-22441962d215"
}

UUIDs: `3e2a1cf1-32a3-413e-b269-f1512d02467b`, `b11166c2-678d-4fe2-baf8-99a10bad3585`, `d7059109-183b-482c-a8cc-92072e81eaf0`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `bd612319-89be-45ca-b370-578984e37284`, `23d48149-5cd4-4f56-9324-22441962d215`

### Retained sign-off fixture: crew and Rotation reviewReliever

{
  "key": "reviewReliever",
  "crewUuid": "41a40d02-e9b4-49fd-8ed7-fc2a487b3846",
  "draftUuid": "ba5f4b1c-c140-422d-93c9-c99c1022a086",
  "entryUuid": "9d595f82-552c-4be9-8a46-568782c69907",
  "rankId": "R016",
  "rank": "OS",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWRELIEVER SEAFARER"
}

UUIDs: `41a40d02-e9b4-49fd-8ed7-fc2a487b3846`, `ba5f4b1c-c140-422d-93c9-c99c1022a086`, `9d595f82-552c-4be9-8a46-568782c69907`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reviewReliever

{
  "key": "reviewReliever",
  "crewUuid": "41a40d02-e9b4-49fd-8ed7-fc2a487b3846",
  "draftUuid": "ba5f4b1c-c140-422d-93c9-c99c1022a086",
  "entryUuid": "9d595f82-552c-4be9-8a46-568782c69907",
  "rankId": "R016",
  "rank": "OS",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWRELIEVER SEAFARER",
  "planUuid": "76185f39-38cf-4ccc-b957-a8f991e7b014",
  "assignmentUuid": "44714849-14f0-494a-b1e7-efe121063e83"
}

UUIDs: `41a40d02-e9b4-49fd-8ed7-fc2a487b3846`, `ba5f4b1c-c140-422d-93c9-c99c1022a086`, `9d595f82-552c-4be9-8a46-568782c69907`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `76185f39-38cf-4ccc-b957-a8f991e7b014`, `44714849-14f0-494a-b1e7-efe121063e83`

### Retained sign-off fixture: definition joiningReview

{
  "key": "joiningReview",
  "formId": 1640,
  "formUuid": "007a3895-51cf-4d7c-9c52-303411382d76",
  "versionId": 2393,
  "versionUuid": "9472d907-cf37-402c-b768-9b5366e469e9",
  "partUuid": "6186e414-14ad-407c-8bdf-5a0c8b8f8c33",
  "name": "TEST ONLY SIGNOFF JOININGREVIEW 2026-10-04T09:03:11.071Z",
  "stage": "before_joining"
}

UUIDs: `007a3895-51cf-4d7c-9c52-303411382d76`, `9472d907-cf37-402c-b768-9b5366e469e9`, `6186e414-14ad-407c-8bdf-5a0c8b8f8c33`

### Retained sign-off fixture: persisted definition joiningReview

{
  "key": "joiningReview",
  "formId": 1640,
  "formUuid": "007a3895-51cf-4d7c-9c52-303411382d76",
  "versionId": 2393,
  "versionUuid": "9472d907-cf37-402c-b768-9b5366e469e9",
  "partUuid": "6186e414-14ad-407c-8bdf-5a0c8b8f8c33",
  "name": "TEST ONLY SIGNOFF JOININGREVIEW 2026-10-04T09:03:11.071Z",
  "stage": "before_joining",
  "sectionUuid": "9a6c5eec-0374-4231-920a-18b08e642c45",
  "questionUuids": [
    "ea5537c9-7960-4d60-b60d-2f3ad07cf189",
    "6ce6c240-1e13-4336-9b91-9efa6a2437d4",
    "a5536194-cc81-48d7-a113-7ea83dd388c2",
    "bd091977-56b7-4596-aeb7-ceb76814d7fd",
    "d7666012-860f-49c0-8a5d-172ad23004c1"
  ]
}

UUIDs: `007a3895-51cf-4d7c-9c52-303411382d76`, `9472d907-cf37-402c-b768-9b5366e469e9`, `6186e414-14ad-407c-8bdf-5a0c8b8f8c33`, `9a6c5eec-0374-4231-920a-18b08e642c45`, `ea5537c9-7960-4d60-b60d-2f3ad07cf189`, `6ce6c240-1e13-4336-9b91-9efa6a2437d4`, `a5536194-cc81-48d7-a113-7ea83dd388c2`, `bd091977-56b7-4596-aeb7-ceb76814d7fd`, `d7666012-860f-49c0-8a5d-172ad23004c1`

### Retained sign-off fixture: declaration reviewOriginal/aboard

{
  "crewUuid": "1078e8df-d82f-4f0a-89ea-d60695685ac6",
  "assignmentUuid": "e3ef921e-69d3-45b6-a098-208f160b3b3a",
  "submissionUuid": "bd17acfa-e893-4ea1-b650-e6f32f13b561",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `1078e8df-d82f-4f0a-89ea-d60695685ac6`, `e3ef921e-69d3-45b6-a098-208f160b3b3a`, `bd17acfa-e893-4ea1-b650-e6f32f13b561`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: office post-sign-off declaration

{
  "submissionUuid": "b4b8e0b9-5ff6-44ec-b379-50553848ed02",
  "assignmentUuid": "e3ef921e-69d3-45b6-a098-208f160b3b3a",
  "versionUuid": "7c1dac2c-5704-4127-9b90-42d0aae5de72"
}

UUIDs: `b4b8e0b9-5ff6-44ec-b379-50553848ed02`, `e3ef921e-69d3-45b6-a098-208f160b3b3a`, `7c1dac2c-5704-4127-9b90-42d0aae5de72`

### Retained sign-off fixture: declaration reviewUnfinished/aboard

{
  "crewUuid": "ca0e1d0e-f087-4945-9a8c-0d91c8a234bf",
  "assignmentUuid": "508e268c-74fb-413b-a393-5c137590acc5",
  "submissionUuid": "a0cbf790-57c2-4793-b60f-fb56323a0f40",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `ca0e1d0e-f087-4945-9a8c-0d91c8a234bf`, `508e268c-74fb-413b-a393-5c137590acc5`, `a0cbf790-57c2-4793-b60f-fb56323a0f40`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: declaration reviewLate/dual

{
  "crewUuid": "3e2a1cf1-32a3-413e-b269-f1512d02467b",
  "assignmentUuid": "23d48149-5cd4-4f56-9324-22441962d215",
  "submissionUuid": "c775eb7a-8d98-4398-8452-95735d8e5677",
  "versionUuid": "4d2faafb-108d-4d42-9b0d-99d049ef1092"
}

UUIDs: `3e2a1cf1-32a3-413e-b269-f1512d02467b`, `23d48149-5cd4-4f56-9324-22441962d215`, `c775eb7a-8d98-4398-8452-95735d8e5677`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`

### Retained sign-off fixture: simultaneous late-signature declaration

{
  "assignmentUuid": "23d48149-5cd4-4f56-9324-22441962d215",
  "submissionUuid": "a82b92a7-d134-4eec-b934-70b8b2eb36b9",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `23d48149-5cd4-4f56-9324-22441962d215`, `a82b92a7-d134-4eec-b934-70b8b2eb36b9`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: declaration reviewOffice/dual

{
  "crewUuid": "5fc6484b-d841-45dc-87ec-57af18ba4b32",
  "assignmentUuid": "de9e4a71-4263-4630-a406-03feb0175c28",
  "submissionUuid": "56224b44-17a5-4a2a-acc9-d8f99f9c72cf",
  "versionUuid": "4d2faafb-108d-4d42-9b0d-99d049ef1092"
}

UUIDs: `5fc6484b-d841-45dc-87ec-57af18ba4b32`, `de9e4a71-4263-4630-a406-03feb0175c28`, `56224b44-17a5-4a2a-acc9-d8f99f9c72cf`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`

### Retained sign-off fixture: sign-off/signature race declaration

{
  "assignmentUuid": "de9e4a71-4263-4630-a406-03feb0175c28",
  "submissionUuid": "2a2e277d-df2d-4a2f-a52a-0e044f516280"
}

UUIDs: `de9e4a71-4263-4630-a406-03feb0175c28`, `2a2e277d-df2d-4a2f-a52a-0e044f516280`

### Retained sign-off fixture: Reliever reciprocal metadata records

{
  "assignmentUuid": "44714849-14f0-494a-b1e7-efe121063e83",
  "originalUuid": "0800d9ac-da4b-4b5e-b857-2a1107860e48",
  "replacementUuid": "d973c64d-1590-468d-8859-da7d0112c24c",
  "replacementVersionUuid": "f6147dc5-d35e-4802-8d3b-f43090ecf8c6"
}

UUIDs: `44714849-14f0-494a-b1e7-efe121063e83`, `0800d9ac-da4b-4b5e-b857-2a1107860e48`, `d973c64d-1590-468d-8859-da7d0112c24c`, `f6147dc5-d35e-4802-8d3b-f43090ecf8c6`

### Retained sign-off fixture: persisted declaration, freeze, signature and attachment identities

{
  "uuids": [
    "e3165578-865a-444f-8399-ccc665bc585c",
    "8d529a30-8a45-4b5f-89fd-d923796a3cb1",
    "fc849c20-cc2c-4d8b-898d-2e053e449221",
    "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c",
    "c909aa25-95bc-4369-9473-5ab1597a6e11",
    "9cae0acc-2fc0-442a-aa31-6d5501890281",
    "82a712b8-3aca-4da7-bf79-ef2f02a92f75",
    "ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93",
    "03480ad7-4b5a-4102-9e98-afc55307865b",
    "7c1dac2c-5704-4127-9b90-42d0aae5de72",
    "7574e16a-eb7c-4ecf-9ec9-b7d97cf85b5e",
    "337781b3-c623-4d1b-b4d1-cf2c54f36e7d",
    "6f345b27-94cc-4be3-bd6b-0767cdc1968a",
    "65687d4f-634d-43c3-ade4-a0fdac84067a",
    "78f0db50-3045-486d-bdd3-6903d6b455f0",
    "f75e0a5f-893a-4c65-8f33-81262ec5ebb9",
    "4d2faafb-108d-4d42-9b0d-99d049ef1092",
    "ad35bf8c-68db-4965-89a1-1864b9a1ca7a",
    "79b89e39-0f95-487e-911a-c94eebc9ce23",
    "5e4ba81b-81bb-4c3d-bbee-5633acd84d8e",
    "0aebb0d8-6108-4c41-a3a1-72922eda606f",
    "5e163210-4eed-4217-907f-4005e995a81e",
    "88d2f57b-47e1-4319-925c-f3028102346a",
    "79edce12-9fcd-47f9-aca4-e527d7e46226",
    "cd29cf82-9f44-45d9-bf96-bd99aaec80e4",
    "d0675224-a7dc-4ded-bb2b-d293a2bc7c70",
    "01ef546b-8138-46cf-9e07-90e94632fd8e",
    "76bba5ce-5d99-41ee-9e26-f4062dd5f334",
    "a73c8208-96f6-41ce-847c-1d457a14b498",
    "9e4d7f5a-9610-4a82-a580-978d5a84b8e1",
    "fc0d0b19-4596-400a-86a8-29b7f54045d5",
    "4a9f2955-6790-4be0-8d4a-d86a4a224fcd",
    "8c0c5108-50c7-4ae6-ac8f-eea1746e41e8",
    "e3ef921e-69d3-45b6-a098-208f160b3b3a",
    "bd17acfa-e893-4ea1-b650-e6f32f13b561",
    "b4b8e0b9-5ff6-44ec-b379-50553848ed02",
    "508e268c-74fb-413b-a393-5c137590acc5",
    "a0cbf790-57c2-4793-b60f-fb56323a0f40",
    "23d48149-5cd4-4f56-9324-22441962d215",
    "c775eb7a-8d98-4398-8452-95735d8e5677",
    "a82b92a7-d134-4eec-b934-70b8b2eb36b9",
    "de9e4a71-4263-4630-a406-03feb0175c28",
    "56224b44-17a5-4a2a-acc9-d8f99f9c72cf",
    "2a2e277d-df2d-4a2f-a52a-0e044f516280",
    "007a3895-51cf-4d7c-9c52-303411382d76",
    "44714849-14f0-494a-b1e7-efe121063e83",
    "0800d9ac-da4b-4b5e-b857-2a1107860e48",
    "9472d907-cf37-402c-b768-9b5366e469e9",
    "d973c64d-1590-468d-8859-da7d0112c24c",
    "f6147dc5-d35e-4802-8d3b-f43090ecf8c6",
    "8052e960-c152-4687-abaa-597c076a0629",
    "2fc704f8-eb6e-4190-b350-6c090de1d011",
    "0fdba70d-cdfd-4e12-8dad-b1f72f6b1be4",
    "82ca4d46-b346-4a6f-8d25-09dd3f67f413",
    "09e8cdc0-b4c3-414c-a688-77ce876352fa",
    "cb8ce0e2-db2f-4c36-8623-402863e32747",
    "5292a31a-4078-49db-9452-e17ce90b78c7",
    "8e1ad158-c774-439a-8b34-d0ef612a2848",
    "f46487f3-cc37-48ec-87d2-ee907e67a53c",
    "6987ec14-dc39-4813-924b-dcc573056bff",
    "dabdf726-9f96-4986-b61c-e017242be92d",
    "1730bf01-09b8-4702-9723-a529cc5e6bf8",
    "46f3a74c-9b63-4641-8b14-39a1f080ce02",
    "d0def786-1824-4107-a6e9-d4c9988c328f",
    "e1ba5cda-75b6-4333-8b2c-cec67f839405",
    "e36bfdf0-048c-4578-b67d-00ec8d8c3869",
    "4ca33d84-b2e8-4229-b22b-87d9e42317d2",
    "845db391-d0cb-41ef-a1b9-ac0fc66b3ff8",
    "d3f14ee9-d3db-4337-803d-bc0275d825f4",
    "16ab1775-57c4-4ff2-9f20-2c228735b6f5",
    "d5a9feef-6f56-4eeb-8477-392968ca9701",
    "2558d822-e533-4de7-bc6d-366214155de0",
    "1883548f-1fb1-47e1-bfd8-e630bad0948f",
    "5351d4a3-f6c3-4a2e-934f-9ab1c8413b84",
    "a85aef19-701d-4a43-8a01-44371bb34957",
    "10f0ebea-e588-413d-b4d6-088d7d644615",
    "4f10910d-014d-4295-9e6a-ce7c720f3595",
    "2fcfa970-315b-4678-b68d-a7c187ee882d",
    "289c05a9-0396-4435-87b5-0be83bfb9830",
    "455008cb-6559-4d90-a559-a4c2ea073360",
    "d18769ea-3d72-4ad7-a642-518c181f55e2",
    "0e66d0cd-291a-4a78-9f32-b84c8a46ca73",
    "fb2331d7-1a1a-46c5-9b66-4aaf40183039",
    "44825006-6a7c-4527-8f69-22ac5b4cd2bb",
    "ca97536c-861f-4736-9b2d-3b662f811961",
    "6d42308c-4267-462d-aa26-639567f11f7d",
    "37da85ec-e760-4e77-84f9-9c9d3ec1b83a",
    "77a0e933-207c-4bc2-a905-f57a3dd7be79",
    "c53ac3a5-9ffd-406c-845a-1092669859c4",
    "6b487109-45ef-41b0-aa8d-4c06a5a68f1e",
    "abde03ca-e6e9-43b3-b7cc-e79a1025d4bd",
    "ba9f434c-7220-43eb-bf1d-b4ac8130740f",
    "ebeb48cd-6ac3-4e2d-8966-12fcaef1a0a5",
    "cfe9bb6c-a4de-4b92-818c-85b83a3377d7",
    "3279caa8-f407-4661-86b3-dbab35833462",
    "cafadb89-9ed7-41ce-90de-6711a7b709f4",
    "9296ff1e-ce90-45e8-b75d-344909a1beb0",
    "920fd6de-6364-4071-a24f-c084b1acbe19",
    "7feff2c6-be09-4f88-9e8b-8f9323e27644",
    "19306c5c-7ac3-4dd4-94e2-49ad0760ba91",
    "b9512ab9-7de4-40d8-aca7-a114778a2d2f",
    "784b2787-8834-452b-815d-6cead79d737f",
    "d68d3072-8f0c-4ba8-810a-0c9fa1aa1b80",
    "184352f3-6cd9-4424-88b1-e6fde777f5e9",
    "95253478-3009-473d-afe7-b2b0f8498910",
    "f22f778d-78b0-4aeb-83f4-2770a5ecf6a1",
    "40c99db4-e080-44a3-8874-b43ec8d945ec",
    "7440571a-841a-11ed-aa7c-7003bca91a86",
    "72ee3817-6dcd-4737-bfc3-7bdc78329b4e",
    "04863f76-9920-4e6f-a69b-ea09155dee66",
    "ae31d626-f537-48f7-98e2-1caa87f81eec",
    "95a95798-0dc2-4a75-b7d2-1fc9eb17bf6a",
    "1f8e587c-30e2-4e92-b63e-4f20d5dd97dd",
    "f9cc0516-0872-4cd0-9f86-786ddac35e61",
    "71e62af5-15ad-4170-9235-207e89c2d8e8",
    "0582286d-25ff-432d-8bda-2ed1d24e87c9",
    "6552f03a-0b1b-4552-ad2c-dc5a9133f1bb",
    "8e955a2c-833e-44a0-9e13-5dc09359abfb",
    "73a7631e-c084-4619-beae-eec03ce1a604",
    "a9b25172-ba2c-43a9-94c2-5ffef8989a20",
    "9c992aaa-3993-4701-93ef-90d0faf50c8f",
    "615d8091-48fd-46f3-aebc-740e9e30ae8a",
    "7d123c06-f464-41dd-b5fe-83b31167cb61",
    "143c938c-1ed3-4578-ab59-83402bac08e2",
    "aa138b71-f579-4df4-a6ec-e7de746b1582",
    "d293c4a2-6956-43ae-b5d0-1d8abfb46eed",
    "0744a6bb-de25-4d15-885d-4fc9dfd0b2db",
    "1779f213-4cd8-4826-b020-9595a54ad55b",
    "26a24ca0-e6d4-4afb-9e7d-327477a6f9ac",
    "1aee88ff-5f2a-4ec2-aa5a-5e81bf7f9894",
    "2a418b33-0fe5-4ca4-9f85-23886ebd77dc",
    "c00f1dbe-ead3-4a1b-807e-eefcc1ed6473",
    "b64745eb-e056-49dd-82a5-907d0914e4a6",
    "479f9f09-f734-4547-b7d3-0165cfa65e1f",
    "eac98a9c-a722-4ff0-a3c3-db47e801674c",
    "2d00a271-9e66-4517-b825-69368e0e7ce8",
    "69314bdc-658b-4e64-8d2b-33186a749bb4",
    "1078e8df-d82f-4f0a-89ea-d60695685ac6",
    "366e2d64-f6c2-47f2-b7c3-020ea2b9decc",
    "8639398b-d15d-49b3-bc1d-14969b24e43e",
    "1162282f-8cc0-4a36-b39d-f840dff53367",
    "7bcec69a-0727-4129-98a8-cc44bb537d44",
    "468fa4b2-b63d-4da7-b8d7-e73dca2a6ba0",
    "9ea5a58b-7a88-4399-8cb7-ca0ca58da52e",
    "782e9b4b-ae8d-47ef-b273-4f710ee73c79",
    "437a9ff3-e9fd-4ce8-9d7b-cf1bf93068d1",
    "3e2a1cf1-32a3-413e-b269-f1512d02467b",
    "0b89405c-18d5-4d2f-bb14-2bf96a67d6d3",
    "6fc595fd-fcc8-4187-83b8-821c02c7ed0d",
    "03abbb3a-4069-40fa-b754-1252b308b07d",
    "11864dc0-ee28-480b-851a-bf433679107d",
    "6bfb170b-8993-4132-a26d-8ec455614c70",
    "7fbda2ba-2eda-4c50-88d0-41d624cf511b",
    "6e0e3c3e-6dd2-4c13-bf49-c269a4e6fb89",
    "bd34062b-d47f-455f-a26e-d93895a4e06c",
    "5fc6484b-d841-45dc-87ec-57af18ba4b32",
    "d45019fe-712d-4717-973a-abe0a0570845",
    "61273508-52f1-4c83-a575-c648e2db6bca",
    "c2e093fe-4a2a-495c-9866-e7b173f85609"
  ]
}

UUIDs: `e3165578-865a-444f-8399-ccc665bc585c`, `8d529a30-8a45-4b5f-89fd-d923796a3cb1`, `fc849c20-cc2c-4d8b-898d-2e053e449221`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`, `c909aa25-95bc-4369-9473-5ab1597a6e11`, `9cae0acc-2fc0-442a-aa31-6d5501890281`, `82a712b8-3aca-4da7-bf79-ef2f02a92f75`, `ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93`, `03480ad7-4b5a-4102-9e98-afc55307865b`, `7c1dac2c-5704-4127-9b90-42d0aae5de72`, `7574e16a-eb7c-4ecf-9ec9-b7d97cf85b5e`, `337781b3-c623-4d1b-b4d1-cf2c54f36e7d`, `6f345b27-94cc-4be3-bd6b-0767cdc1968a`, `65687d4f-634d-43c3-ade4-a0fdac84067a`, `78f0db50-3045-486d-bdd3-6903d6b455f0`, `f75e0a5f-893a-4c65-8f33-81262ec5ebb9`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`, `ad35bf8c-68db-4965-89a1-1864b9a1ca7a`, `79b89e39-0f95-487e-911a-c94eebc9ce23`, `5e4ba81b-81bb-4c3d-bbee-5633acd84d8e`, `0aebb0d8-6108-4c41-a3a1-72922eda606f`, `5e163210-4eed-4217-907f-4005e995a81e`, `88d2f57b-47e1-4319-925c-f3028102346a`, `79edce12-9fcd-47f9-aca4-e527d7e46226`, `cd29cf82-9f44-45d9-bf96-bd99aaec80e4`, `d0675224-a7dc-4ded-bb2b-d293a2bc7c70`, `01ef546b-8138-46cf-9e07-90e94632fd8e`, `76bba5ce-5d99-41ee-9e26-f4062dd5f334`, `a73c8208-96f6-41ce-847c-1d457a14b498`, `9e4d7f5a-9610-4a82-a580-978d5a84b8e1`, `fc0d0b19-4596-400a-86a8-29b7f54045d5`, `4a9f2955-6790-4be0-8d4a-d86a4a224fcd`, `8c0c5108-50c7-4ae6-ac8f-eea1746e41e8`, `e3ef921e-69d3-45b6-a098-208f160b3b3a`, `bd17acfa-e893-4ea1-b650-e6f32f13b561`, `b4b8e0b9-5ff6-44ec-b379-50553848ed02`, `508e268c-74fb-413b-a393-5c137590acc5`, `a0cbf790-57c2-4793-b60f-fb56323a0f40`, `23d48149-5cd4-4f56-9324-22441962d215`, `c775eb7a-8d98-4398-8452-95735d8e5677`, `a82b92a7-d134-4eec-b934-70b8b2eb36b9`, `de9e4a71-4263-4630-a406-03feb0175c28`, `56224b44-17a5-4a2a-acc9-d8f99f9c72cf`, `2a2e277d-df2d-4a2f-a52a-0e044f516280`, `007a3895-51cf-4d7c-9c52-303411382d76`, `44714849-14f0-494a-b1e7-efe121063e83`, `0800d9ac-da4b-4b5e-b857-2a1107860e48`, `9472d907-cf37-402c-b768-9b5366e469e9`, `d973c64d-1590-468d-8859-da7d0112c24c`, `f6147dc5-d35e-4802-8d3b-f43090ecf8c6`, `8052e960-c152-4687-abaa-597c076a0629`, `2fc704f8-eb6e-4190-b350-6c090de1d011`, `0fdba70d-cdfd-4e12-8dad-b1f72f6b1be4`, `82ca4d46-b346-4a6f-8d25-09dd3f67f413`, `09e8cdc0-b4c3-414c-a688-77ce876352fa`, `cb8ce0e2-db2f-4c36-8623-402863e32747`, `5292a31a-4078-49db-9452-e17ce90b78c7`, `8e1ad158-c774-439a-8b34-d0ef612a2848`, `f46487f3-cc37-48ec-87d2-ee907e67a53c`, `6987ec14-dc39-4813-924b-dcc573056bff`, `dabdf726-9f96-4986-b61c-e017242be92d`, `1730bf01-09b8-4702-9723-a529cc5e6bf8`, `46f3a74c-9b63-4641-8b14-39a1f080ce02`, `d0def786-1824-4107-a6e9-d4c9988c328f`, `e1ba5cda-75b6-4333-8b2c-cec67f839405`, `e36bfdf0-048c-4578-b67d-00ec8d8c3869`, `4ca33d84-b2e8-4229-b22b-87d9e42317d2`, `845db391-d0cb-41ef-a1b9-ac0fc66b3ff8`, `d3f14ee9-d3db-4337-803d-bc0275d825f4`, `16ab1775-57c4-4ff2-9f20-2c228735b6f5`, `d5a9feef-6f56-4eeb-8477-392968ca9701`, `2558d822-e533-4de7-bc6d-366214155de0`, `1883548f-1fb1-47e1-bfd8-e630bad0948f`, `5351d4a3-f6c3-4a2e-934f-9ab1c8413b84`, `a85aef19-701d-4a43-8a01-44371bb34957`, `10f0ebea-e588-413d-b4d6-088d7d644615`, `4f10910d-014d-4295-9e6a-ce7c720f3595`, `2fcfa970-315b-4678-b68d-a7c187ee882d`, `289c05a9-0396-4435-87b5-0be83bfb9830`, `455008cb-6559-4d90-a559-a4c2ea073360`, `d18769ea-3d72-4ad7-a642-518c181f55e2`, `0e66d0cd-291a-4a78-9f32-b84c8a46ca73`, `fb2331d7-1a1a-46c5-9b66-4aaf40183039`, `44825006-6a7c-4527-8f69-22ac5b4cd2bb`, `ca97536c-861f-4736-9b2d-3b662f811961`, `6d42308c-4267-462d-aa26-639567f11f7d`, `37da85ec-e760-4e77-84f9-9c9d3ec1b83a`, `77a0e933-207c-4bc2-a905-f57a3dd7be79`, `c53ac3a5-9ffd-406c-845a-1092669859c4`, `6b487109-45ef-41b0-aa8d-4c06a5a68f1e`, `abde03ca-e6e9-43b3-b7cc-e79a1025d4bd`, `ba9f434c-7220-43eb-bf1d-b4ac8130740f`, `ebeb48cd-6ac3-4e2d-8966-12fcaef1a0a5`, `cfe9bb6c-a4de-4b92-818c-85b83a3377d7`, `3279caa8-f407-4661-86b3-dbab35833462`, `cafadb89-9ed7-41ce-90de-6711a7b709f4`, `9296ff1e-ce90-45e8-b75d-344909a1beb0`, `920fd6de-6364-4071-a24f-c084b1acbe19`, `7feff2c6-be09-4f88-9e8b-8f9323e27644`, `19306c5c-7ac3-4dd4-94e2-49ad0760ba91`, `b9512ab9-7de4-40d8-aca7-a114778a2d2f`, `784b2787-8834-452b-815d-6cead79d737f`, `d68d3072-8f0c-4ba8-810a-0c9fa1aa1b80`, `184352f3-6cd9-4424-88b1-e6fde777f5e9`, `95253478-3009-473d-afe7-b2b0f8498910`, `f22f778d-78b0-4aeb-83f4-2770a5ecf6a1`, `40c99db4-e080-44a3-8874-b43ec8d945ec`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `72ee3817-6dcd-4737-bfc3-7bdc78329b4e`, `04863f76-9920-4e6f-a69b-ea09155dee66`, `ae31d626-f537-48f7-98e2-1caa87f81eec`, `95a95798-0dc2-4a75-b7d2-1fc9eb17bf6a`, `1f8e587c-30e2-4e92-b63e-4f20d5dd97dd`, `f9cc0516-0872-4cd0-9f86-786ddac35e61`, `71e62af5-15ad-4170-9235-207e89c2d8e8`, `0582286d-25ff-432d-8bda-2ed1d24e87c9`, `6552f03a-0b1b-4552-ad2c-dc5a9133f1bb`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `73a7631e-c084-4619-beae-eec03ce1a604`, `a9b25172-ba2c-43a9-94c2-5ffef8989a20`, `9c992aaa-3993-4701-93ef-90d0faf50c8f`, `615d8091-48fd-46f3-aebc-740e9e30ae8a`, `7d123c06-f464-41dd-b5fe-83b31167cb61`, `143c938c-1ed3-4578-ab59-83402bac08e2`, `aa138b71-f579-4df4-a6ec-e7de746b1582`, `d293c4a2-6956-43ae-b5d0-1d8abfb46eed`, `0744a6bb-de25-4d15-885d-4fc9dfd0b2db`, `1779f213-4cd8-4826-b020-9595a54ad55b`, `26a24ca0-e6d4-4afb-9e7d-327477a6f9ac`, `1aee88ff-5f2a-4ec2-aa5a-5e81bf7f9894`, `2a418b33-0fe5-4ca4-9f85-23886ebd77dc`, `c00f1dbe-ead3-4a1b-807e-eefcc1ed6473`, `b64745eb-e056-49dd-82a5-907d0914e4a6`, `479f9f09-f734-4547-b7d3-0165cfa65e1f`, `eac98a9c-a722-4ff0-a3c3-db47e801674c`, `2d00a271-9e66-4517-b825-69368e0e7ce8`, `69314bdc-658b-4e64-8d2b-33186a749bb4`, `1078e8df-d82f-4f0a-89ea-d60695685ac6`, `366e2d64-f6c2-47f2-b7c3-020ea2b9decc`, `8639398b-d15d-49b3-bc1d-14969b24e43e`, `1162282f-8cc0-4a36-b39d-f840dff53367`, `7bcec69a-0727-4129-98a8-cc44bb537d44`, `468fa4b2-b63d-4da7-b8d7-e73dca2a6ba0`, `9ea5a58b-7a88-4399-8cb7-ca0ca58da52e`, `782e9b4b-ae8d-47ef-b273-4f710ee73c79`, `437a9ff3-e9fd-4ce8-9d7b-cf1bf93068d1`, `3e2a1cf1-32a3-413e-b269-f1512d02467b`, `0b89405c-18d5-4d2f-bb14-2bf96a67d6d3`, `6fc595fd-fcc8-4187-83b8-821c02c7ed0d`, `03abbb3a-4069-40fa-b754-1252b308b07d`, `11864dc0-ee28-480b-851a-bf433679107d`, `6bfb170b-8993-4132-a26d-8ec455614c70`, `7fbda2ba-2eda-4c50-88d0-41d624cf511b`, `6e0e3c3e-6dd2-4c13-bf49-c269a4e6fb89`, `bd34062b-d47f-455f-a26e-d93895a4e06c`, `5fc6484b-d841-45dc-87ec-57af18ba4b32`, `d45019fe-712d-4717-973a-abe0a0570845`, `61273508-52f1-4c83-a575-c648e2db6bca`, `c2e093fe-4a2a-495c-9866-e7b173f85609`

### Retained sign-off fixture: crew and Rotation reviewLateFinal

{
  "key": "reviewLateFinal",
  "crewUuid": "5c49b6cd-4107-484c-986d-3de1c8454fd5",
  "draftUuid": "cd8b0962-12d1-48bc-97b8-2274c6bfa4e5",
  "entryUuid": "7f19349d-a867-4e73-99d2-fb50143c248a",
  "rankId": "R015",
  "rank": "AB_2",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWLATEFINAL SEAFARER"
}

UUIDs: `5c49b6cd-4107-484c-986d-3de1c8454fd5`, `cd8b0962-12d1-48bc-97b8-2274c6bfa4e5`, `7f19349d-a867-4e73-99d2-fb50143c248a`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reviewLateFinal

{
  "key": "reviewLateFinal",
  "crewUuid": "5c49b6cd-4107-484c-986d-3de1c8454fd5",
  "draftUuid": "cd8b0962-12d1-48bc-97b8-2274c6bfa4e5",
  "entryUuid": "7f19349d-a867-4e73-99d2-fb50143c248a",
  "rankId": "R015",
  "rank": "AB_2",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWLATEFINAL SEAFARER",
  "planUuid": "f94ce33b-358a-4a27-a25e-518aff4449e3",
  "assignmentUuid": "34c6c6ba-5daf-4ea2-afc3-9d2855402735"
}

UUIDs: `5c49b6cd-4107-484c-986d-3de1c8454fd5`, `cd8b0962-12d1-48bc-97b8-2274c6bfa4e5`, `7f19349d-a867-4e73-99d2-fb50143c248a`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `f94ce33b-358a-4a27-a25e-518aff4449e3`, `34c6c6ba-5daf-4ea2-afc3-9d2855402735`

### Retained sign-off fixture: crew and Rotation reviewOfficeFinal

{
  "key": "reviewOfficeFinal",
  "crewUuid": "9397b528-3bfb-4671-8888-4a9ae87571aa",
  "draftUuid": "c5a04bca-b3a6-433f-a4be-69190a14e542",
  "entryUuid": "f09eb524-0c05-4214-83c8-a3f188698009",
  "rankId": "R015",
  "rank": "AB_3",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWOFFICEFINAL SEAFARER"
}

UUIDs: `9397b528-3bfb-4671-8888-4a9ae87571aa`, `c5a04bca-b3a6-433f-a4be-69190a14e542`, `f09eb524-0c05-4214-83c8-a3f188698009`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reviewOfficeFinal

{
  "key": "reviewOfficeFinal",
  "crewUuid": "9397b528-3bfb-4671-8888-4a9ae87571aa",
  "draftUuid": "c5a04bca-b3a6-433f-a4be-69190a14e542",
  "entryUuid": "f09eb524-0c05-4214-83c8-a3f188698009",
  "rankId": "R015",
  "rank": "AB_3",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWOFFICEFINAL SEAFARER",
  "planUuid": "69146ad6-95ff-480f-98a2-7a0ff967be6d",
  "assignmentUuid": "bb2cd2d6-08cd-4ae0-8a72-6eaddcd0bd10"
}

UUIDs: `9397b528-3bfb-4671-8888-4a9ae87571aa`, `c5a04bca-b3a6-433f-a4be-69190a14e542`, `f09eb524-0c05-4214-83c8-a3f188698009`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `69146ad6-95ff-480f-98a2-7a0ff967be6d`, `bb2cd2d6-08cd-4ae0-8a72-6eaddcd0bd10`

### Retained sign-off fixture: crew and Rotation reviewRelieverFinal

{
  "key": "reviewRelieverFinal",
  "crewUuid": "bd6ae0ad-f5a7-4d05-a778-96c5844c6355",
  "draftUuid": "184ec4b2-1528-496f-a2ef-d1332414c7a1",
  "entryUuid": "b3369039-c649-4622-a080-1f1ec974bc30",
  "rankId": "R016",
  "rank": "OS_2",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWRELIEVERFINAL SEAFARER"
}

UUIDs: `bd6ae0ad-f5a7-4d05-a778-96c5844c6355`, `184ec4b2-1528-496f-a2ef-d1332414c7a1`, `b3369039-c649-4622-a080-1f1ec974bc30`, `7440571a-841a-11ed-aa7c-7003bca91a86`

### Retained sign-off fixture: exact deployment reviewRelieverFinal

{
  "key": "reviewRelieverFinal",
  "crewUuid": "bd6ae0ad-f5a7-4d05-a778-96c5844c6355",
  "draftUuid": "184ec4b2-1528-496f-a2ef-d1332414c7a1",
  "entryUuid": "b3369039-c649-4622-a080-1f1ec974bc30",
  "rankId": "R016",
  "rank": "OS_2",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86",
  "vesselName": "vessel 03",
  "name": "TEST ONLY SIGNOFF REVIEWRELIEVERFINAL SEAFARER",
  "planUuid": "e5c4cfa2-eaa8-4509-936d-af19845211af",
  "assignmentUuid": "c6075b19-429f-4e53-8c40-a85f29774b3a"
}

UUIDs: `bd6ae0ad-f5a7-4d05-a778-96c5844c6355`, `184ec4b2-1528-496f-a2ef-d1332414c7a1`, `b3369039-c649-4622-a080-1f1ec974bc30`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `e5c4cfa2-eaa8-4509-936d-af19845211af`, `c6075b19-429f-4e53-8c40-a85f29774b3a`

### Retained sign-off fixture: definition joiningFinal

{
  "key": "joiningFinal",
  "formId": 1897,
  "formUuid": "4e228153-b243-42b4-a9e7-0f27a7e65f35",
  "versionId": 2735,
  "versionUuid": "ca131fbf-a1a6-46d0-bc5e-2d822ecfcfb0",
  "partUuid": "3a3da3c9-e2f1-4cd9-acd6-f8451add2bc1",
  "name": "TEST ONLY SIGNOFF JOININGFINAL 2026-10-04T09:03:11.071Z",
  "stage": "before_joining"
}

UUIDs: `4e228153-b243-42b4-a9e7-0f27a7e65f35`, `ca131fbf-a1a6-46d0-bc5e-2d822ecfcfb0`, `3a3da3c9-e2f1-4cd9-acd6-f8451add2bc1`

### Retained sign-off fixture: persisted definition joiningFinal

{
  "key": "joiningFinal",
  "formId": 1897,
  "formUuid": "4e228153-b243-42b4-a9e7-0f27a7e65f35",
  "versionId": 2735,
  "versionUuid": "ca131fbf-a1a6-46d0-bc5e-2d822ecfcfb0",
  "partUuid": "3a3da3c9-e2f1-4cd9-acd6-f8451add2bc1",
  "name": "TEST ONLY SIGNOFF JOININGFINAL 2026-10-04T09:03:11.071Z",
  "stage": "before_joining",
  "sectionUuid": "2bf8087c-1d96-466a-9fca-6fd7fae6f994",
  "questionUuids": [
    "26c6f516-50ae-40ba-a12b-9c60369f9fa8",
    "4ac11689-e336-4bbb-a313-5d26622e567d",
    "2811e072-ac4b-4463-8542-0b92ffd4d544",
    "116c8d03-f498-4bc3-9971-051378aa5aab",
    "266d9cbe-b91f-4ff7-9322-91da4703ec9e"
  ]
}

UUIDs: `4e228153-b243-42b4-a9e7-0f27a7e65f35`, `ca131fbf-a1a6-46d0-bc5e-2d822ecfcfb0`, `3a3da3c9-e2f1-4cd9-acd6-f8451add2bc1`, `2bf8087c-1d96-466a-9fca-6fd7fae6f994`, `26c6f516-50ae-40ba-a12b-9c60369f9fa8`, `4ac11689-e336-4bbb-a313-5d26622e567d`, `2811e072-ac4b-4463-8542-0b92ffd4d544`, `116c8d03-f498-4bc3-9971-051378aa5aab`, `266d9cbe-b91f-4ff7-9322-91da4703ec9e`

### Retained sign-off fixture: declaration reviewLateFinal/dual

{
  "crewUuid": "5c49b6cd-4107-484c-986d-3de1c8454fd5",
  "assignmentUuid": "34c6c6ba-5daf-4ea2-afc3-9d2855402735",
  "submissionUuid": "862678d9-1a02-448d-a4b7-4978f8ad391a",
  "versionUuid": "4d2faafb-108d-4d42-9b0d-99d049ef1092"
}

UUIDs: `5c49b6cd-4107-484c-986d-3de1c8454fd5`, `34c6c6ba-5daf-4ea2-afc3-9d2855402735`, `862678d9-1a02-448d-a4b7-4978f8ad391a`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`

### Retained sign-off fixture: simultaneous late-signature declaration

{
  "assignmentUuid": "34c6c6ba-5daf-4ea2-afc3-9d2855402735",
  "submissionUuid": "fde93d35-722b-4db0-86d8-0070fb750f17",
  "versionUuid": "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c"
}

UUIDs: `34c6c6ba-5daf-4ea2-afc3-9d2855402735`, `fde93d35-722b-4db0-86d8-0070fb750f17`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`

### Retained sign-off fixture: declaration reviewOfficeFinal/dual

{
  "crewUuid": "9397b528-3bfb-4671-8888-4a9ae87571aa",
  "assignmentUuid": "bb2cd2d6-08cd-4ae0-8a72-6eaddcd0bd10",
  "submissionUuid": "55c8a7d5-1cd9-492a-800e-9ac4411b8d34",
  "versionUuid": "4d2faafb-108d-4d42-9b0d-99d049ef1092"
}

UUIDs: `9397b528-3bfb-4671-8888-4a9ae87571aa`, `bb2cd2d6-08cd-4ae0-8a72-6eaddcd0bd10`, `55c8a7d5-1cd9-492a-800e-9ac4411b8d34`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`

### Retained sign-off fixture: sign-off/signature race declaration

{
  "assignmentUuid": "bb2cd2d6-08cd-4ae0-8a72-6eaddcd0bd10",
  "submissionUuid": "e211475e-fff4-4a8c-9862-697a26d26ee7"
}

UUIDs: `bb2cd2d6-08cd-4ae0-8a72-6eaddcd0bd10`, `e211475e-fff4-4a8c-9862-697a26d26ee7`

### Retained sign-off fixture: Reliever reciprocal metadata records

{
  "assignmentUuid": "c6075b19-429f-4e53-8c40-a85f29774b3a",
  "originalUuid": "b5e80856-3c53-49e5-a19b-ff540bdc5052",
  "replacementUuid": "5d674513-c776-4c81-82a8-ffad592e8c5e",
  "replacementVersionUuid": "86906dbc-9735-4f36-a9e1-2363f4e4a47f"
}

UUIDs: `c6075b19-429f-4e53-8c40-a85f29774b3a`, `b5e80856-3c53-49e5-a19b-ff540bdc5052`, `5d674513-c776-4c81-82a8-ffad592e8c5e`, `86906dbc-9735-4f36-a9e1-2363f4e4a47f`

### Retained sign-off fixture: persisted declaration, freeze, signature and attachment identities

{
  "uuids": [
    "e3165578-865a-444f-8399-ccc665bc585c",
    "8d529a30-8a45-4b5f-89fd-d923796a3cb1",
    "fc849c20-cc2c-4d8b-898d-2e053e449221",
    "0d58e4bb-d12e-4d7d-aa11-eb37ac74960c",
    "c909aa25-95bc-4369-9473-5ab1597a6e11",
    "9cae0acc-2fc0-442a-aa31-6d5501890281",
    "82a712b8-3aca-4da7-bf79-ef2f02a92f75",
    "ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93",
    "03480ad7-4b5a-4102-9e98-afc55307865b",
    "7c1dac2c-5704-4127-9b90-42d0aae5de72",
    "7574e16a-eb7c-4ecf-9ec9-b7d97cf85b5e",
    "337781b3-c623-4d1b-b4d1-cf2c54f36e7d",
    "6f345b27-94cc-4be3-bd6b-0767cdc1968a",
    "65687d4f-634d-43c3-ade4-a0fdac84067a",
    "78f0db50-3045-486d-bdd3-6903d6b455f0",
    "f75e0a5f-893a-4c65-8f33-81262ec5ebb9",
    "4d2faafb-108d-4d42-9b0d-99d049ef1092",
    "ad35bf8c-68db-4965-89a1-1864b9a1ca7a",
    "79b89e39-0f95-487e-911a-c94eebc9ce23",
    "5e4ba81b-81bb-4c3d-bbee-5633acd84d8e",
    "0aebb0d8-6108-4c41-a3a1-72922eda606f",
    "5e163210-4eed-4217-907f-4005e995a81e",
    "88d2f57b-47e1-4319-925c-f3028102346a",
    "79edce12-9fcd-47f9-aca4-e527d7e46226",
    "cd29cf82-9f44-45d9-bf96-bd99aaec80e4",
    "d0675224-a7dc-4ded-bb2b-d293a2bc7c70",
    "01ef546b-8138-46cf-9e07-90e94632fd8e",
    "76bba5ce-5d99-41ee-9e26-f4062dd5f334",
    "a73c8208-96f6-41ce-847c-1d457a14b498",
    "9e4d7f5a-9610-4a82-a580-978d5a84b8e1",
    "fc0d0b19-4596-400a-86a8-29b7f54045d5",
    "4a9f2955-6790-4be0-8d4a-d86a4a224fcd",
    "8c0c5108-50c7-4ae6-ac8f-eea1746e41e8",
    "e3ef921e-69d3-45b6-a098-208f160b3b3a",
    "bd17acfa-e893-4ea1-b650-e6f32f13b561",
    "b4b8e0b9-5ff6-44ec-b379-50553848ed02",
    "508e268c-74fb-413b-a393-5c137590acc5",
    "a0cbf790-57c2-4793-b60f-fb56323a0f40",
    "23d48149-5cd4-4f56-9324-22441962d215",
    "c775eb7a-8d98-4398-8452-95735d8e5677",
    "a82b92a7-d134-4eec-b934-70b8b2eb36b9",
    "de9e4a71-4263-4630-a406-03feb0175c28",
    "56224b44-17a5-4a2a-acc9-d8f99f9c72cf",
    "2a2e277d-df2d-4a2f-a52a-0e044f516280",
    "007a3895-51cf-4d7c-9c52-303411382d76",
    "44714849-14f0-494a-b1e7-efe121063e83",
    "0800d9ac-da4b-4b5e-b857-2a1107860e48",
    "9472d907-cf37-402c-b768-9b5366e469e9",
    "d973c64d-1590-468d-8859-da7d0112c24c",
    "f6147dc5-d35e-4802-8d3b-f43090ecf8c6",
    "34c6c6ba-5daf-4ea2-afc3-9d2855402735",
    "862678d9-1a02-448d-a4b7-4978f8ad391a",
    "fde93d35-722b-4db0-86d8-0070fb750f17",
    "bb2cd2d6-08cd-4ae0-8a72-6eaddcd0bd10",
    "55c8a7d5-1cd9-492a-800e-9ac4411b8d34",
    "e211475e-fff4-4a8c-9862-697a26d26ee7",
    "4e228153-b243-42b4-a9e7-0f27a7e65f35",
    "c6075b19-429f-4e53-8c40-a85f29774b3a",
    "b5e80856-3c53-49e5-a19b-ff540bdc5052",
    "ca131fbf-a1a6-46d0-bc5e-2d822ecfcfb0",
    "5d674513-c776-4c81-82a8-ffad592e8c5e",
    "86906dbc-9735-4f36-a9e1-2363f4e4a47f",
    "8052e960-c152-4687-abaa-597c076a0629",
    "2fc704f8-eb6e-4190-b350-6c090de1d011",
    "0fdba70d-cdfd-4e12-8dad-b1f72f6b1be4",
    "82ca4d46-b346-4a6f-8d25-09dd3f67f413",
    "09e8cdc0-b4c3-414c-a688-77ce876352fa",
    "cb8ce0e2-db2f-4c36-8623-402863e32747",
    "5292a31a-4078-49db-9452-e17ce90b78c7",
    "8e1ad158-c774-439a-8b34-d0ef612a2848",
    "f46487f3-cc37-48ec-87d2-ee907e67a53c",
    "6987ec14-dc39-4813-924b-dcc573056bff",
    "dabdf726-9f96-4986-b61c-e017242be92d",
    "1730bf01-09b8-4702-9723-a529cc5e6bf8",
    "46f3a74c-9b63-4641-8b14-39a1f080ce02",
    "d0def786-1824-4107-a6e9-d4c9988c328f",
    "e1ba5cda-75b6-4333-8b2c-cec67f839405",
    "e36bfdf0-048c-4578-b67d-00ec8d8c3869",
    "4ca33d84-b2e8-4229-b22b-87d9e42317d2",
    "845db391-d0cb-41ef-a1b9-ac0fc66b3ff8",
    "d3f14ee9-d3db-4337-803d-bc0275d825f4",
    "16ab1775-57c4-4ff2-9f20-2c228735b6f5",
    "d5a9feef-6f56-4eeb-8477-392968ca9701",
    "2558d822-e533-4de7-bc6d-366214155de0",
    "1883548f-1fb1-47e1-bfd8-e630bad0948f",
    "5351d4a3-f6c3-4a2e-934f-9ab1c8413b84",
    "a85aef19-701d-4a43-8a01-44371bb34957",
    "10f0ebea-e588-413d-b4d6-088d7d644615",
    "4f10910d-014d-4295-9e6a-ce7c720f3595",
    "2fcfa970-315b-4678-b68d-a7c187ee882d",
    "289c05a9-0396-4435-87b5-0be83bfb9830",
    "455008cb-6559-4d90-a559-a4c2ea073360",
    "d18769ea-3d72-4ad7-a642-518c181f55e2",
    "0e66d0cd-291a-4a78-9f32-b84c8a46ca73",
    "fb2331d7-1a1a-46c5-9b66-4aaf40183039",
    "44825006-6a7c-4527-8f69-22ac5b4cd2bb",
    "ca97536c-861f-4736-9b2d-3b662f811961",
    "6d42308c-4267-462d-aa26-639567f11f7d",
    "37da85ec-e760-4e77-84f9-9c9d3ec1b83a",
    "77a0e933-207c-4bc2-a905-f57a3dd7be79",
    "c53ac3a5-9ffd-406c-845a-1092669859c4",
    "6b487109-45ef-41b0-aa8d-4c06a5a68f1e",
    "abde03ca-e6e9-43b3-b7cc-e79a1025d4bd",
    "ba9f434c-7220-43eb-bf1d-b4ac8130740f",
    "7a3a482f-d415-47bd-b83d-10cdbed17c58",
    "39da1fb1-2ee3-4751-8883-5569b48d6463",
    "9cb9887a-846d-4850-81f9-81e6753aee0e",
    "4fa40bc1-1e64-417d-b101-bab2cd9aa322",
    "759eaae4-e26e-423e-87e9-33b820983d4f",
    "53005fea-2bc9-4a4f-921d-c6853b2dbf62",
    "6e157fa9-e97f-49b8-b77a-5e3cdcb5a499",
    "97bd15ca-6a21-4237-8e81-8dc9122b6062",
    "f5251fba-3533-49ae-a6bf-da727c32639f",
    "ebeb48cd-6ac3-4e2d-8966-12fcaef1a0a5",
    "cfe9bb6c-a4de-4b92-818c-85b83a3377d7",
    "3279caa8-f407-4661-86b3-dbab35833462",
    "cafadb89-9ed7-41ce-90de-6711a7b709f4",
    "9296ff1e-ce90-45e8-b75d-344909a1beb0",
    "920fd6de-6364-4071-a24f-c084b1acbe19",
    "7feff2c6-be09-4f88-9e8b-8f9323e27644",
    "19306c5c-7ac3-4dd4-94e2-49ad0760ba91",
    "b9512ab9-7de4-40d8-aca7-a114778a2d2f",
    "784b2787-8834-452b-815d-6cead79d737f",
    "d68d3072-8f0c-4ba8-810a-0c9fa1aa1b80",
    "611dc2c1-a46f-4839-bc52-af9888c0617c",
    "60a1c7c7-cacf-4785-b6f4-7c780810840d",
    "7d7093b6-c60d-4b2d-bdad-218eed4057ab",
    "184352f3-6cd9-4424-88b1-e6fde777f5e9",
    "95253478-3009-473d-afe7-b2b0f8498910",
    "f22f778d-78b0-4aeb-83f4-2770a5ecf6a1",
    "40c99db4-e080-44a3-8874-b43ec8d945ec",
    "7440571a-841a-11ed-aa7c-7003bca91a86",
    "72ee3817-6dcd-4737-bfc3-7bdc78329b4e",
    "04863f76-9920-4e6f-a69b-ea09155dee66",
    "ae31d626-f537-48f7-98e2-1caa87f81eec",
    "95a95798-0dc2-4a75-b7d2-1fc9eb17bf6a",
    "1f8e587c-30e2-4e92-b63e-4f20d5dd97dd",
    "f9cc0516-0872-4cd0-9f86-786ddac35e61",
    "71e62af5-15ad-4170-9235-207e89c2d8e8",
    "0582286d-25ff-432d-8bda-2ed1d24e87c9",
    "6552f03a-0b1b-4552-ad2c-dc5a9133f1bb",
    "8e955a2c-833e-44a0-9e13-5dc09359abfb",
    "73a7631e-c084-4619-beae-eec03ce1a604",
    "a9b25172-ba2c-43a9-94c2-5ffef8989a20",
    "9c992aaa-3993-4701-93ef-90d0faf50c8f",
    "615d8091-48fd-46f3-aebc-740e9e30ae8a",
    "7d123c06-f464-41dd-b5fe-83b31167cb61",
    "143c938c-1ed3-4578-ab59-83402bac08e2",
    "aa138b71-f579-4df4-a6ec-e7de746b1582",
    "d293c4a2-6956-43ae-b5d0-1d8abfb46eed",
    "0744a6bb-de25-4d15-885d-4fc9dfd0b2db",
    "1779f213-4cd8-4826-b020-9595a54ad55b",
    "26a24ca0-e6d4-4afb-9e7d-327477a6f9ac",
    "1aee88ff-5f2a-4ec2-aa5a-5e81bf7f9894",
    "2a418b33-0fe5-4ca4-9f85-23886ebd77dc",
    "c00f1dbe-ead3-4a1b-807e-eefcc1ed6473",
    "b64745eb-e056-49dd-82a5-907d0914e4a6",
    "479f9f09-f734-4547-b7d3-0165cfa65e1f",
    "eac98a9c-a722-4ff0-a3c3-db47e801674c",
    "2d00a271-9e66-4517-b825-69368e0e7ce8",
    "69314bdc-658b-4e64-8d2b-33186a749bb4",
    "1078e8df-d82f-4f0a-89ea-d60695685ac6",
    "366e2d64-f6c2-47f2-b7c3-020ea2b9decc",
    "8639398b-d15d-49b3-bc1d-14969b24e43e",
    "1162282f-8cc0-4a36-b39d-f840dff53367",
    "7bcec69a-0727-4129-98a8-cc44bb537d44",
    "468fa4b2-b63d-4da7-b8d7-e73dca2a6ba0",
    "9ea5a58b-7a88-4399-8cb7-ca0ca58da52e",
    "782e9b4b-ae8d-47ef-b273-4f710ee73c79",
    "437a9ff3-e9fd-4ce8-9d7b-cf1bf93068d1",
    "3e2a1cf1-32a3-413e-b269-f1512d02467b",
    "0b89405c-18d5-4d2f-bb14-2bf96a67d6d3",
    "6fc595fd-fcc8-4187-83b8-821c02c7ed0d",
    "03abbb3a-4069-40fa-b754-1252b308b07d",
    "11864dc0-ee28-480b-851a-bf433679107d",
    "6bfb170b-8993-4132-a26d-8ec455614c70",
    "7fbda2ba-2eda-4c50-88d0-41d624cf511b",
    "6e0e3c3e-6dd2-4c13-bf49-c269a4e6fb89",
    "bd34062b-d47f-455f-a26e-d93895a4e06c",
    "5fc6484b-d841-45dc-87ec-57af18ba4b32",
    "d45019fe-712d-4717-973a-abe0a0570845",
    "61273508-52f1-4c83-a575-c648e2db6bca",
    "c2e093fe-4a2a-495c-9866-e7b173f85609",
    "c76a45ea-b245-4eb3-958b-9551e4f041ab",
    "5c49b6cd-4107-484c-986d-3de1c8454fd5",
    "15b295fe-2463-49e3-807e-97785fc816d9",
    "e7d561d2-440f-41d2-95a5-67e100a61885",
    "4cf52d04-6f03-4610-8ef6-10b96a5d6369",
    "4772d63d-ccb8-4899-b145-cb5543422d25",
    "78db92f9-ddc6-4c02-a263-5ab9df0658b4",
    "893b9929-db58-4d6a-9c26-c97873b67d1a",
    "4e80a5c5-6b0f-448d-a723-6c702afb7e27",
    "bbac8512-1ec3-40bd-93bc-b633d47e459d",
    "9397b528-3bfb-4671-8888-4a9ae87571aa",
    "bb6d124d-7153-4a05-8f87-7ecf0ecae74f",
    "21da317f-f2af-49f7-ab85-466761ccac24",
    "39be6753-2f6c-45c3-9616-48f1863533db"
  ]
}

UUIDs: `e3165578-865a-444f-8399-ccc665bc585c`, `8d529a30-8a45-4b5f-89fd-d923796a3cb1`, `fc849c20-cc2c-4d8b-898d-2e053e449221`, `0d58e4bb-d12e-4d7d-aa11-eb37ac74960c`, `c909aa25-95bc-4369-9473-5ab1597a6e11`, `9cae0acc-2fc0-442a-aa31-6d5501890281`, `82a712b8-3aca-4da7-bf79-ef2f02a92f75`, `ae69f2e2-b7d9-48ee-b2b4-18cfd060aa93`, `03480ad7-4b5a-4102-9e98-afc55307865b`, `7c1dac2c-5704-4127-9b90-42d0aae5de72`, `7574e16a-eb7c-4ecf-9ec9-b7d97cf85b5e`, `337781b3-c623-4d1b-b4d1-cf2c54f36e7d`, `6f345b27-94cc-4be3-bd6b-0767cdc1968a`, `65687d4f-634d-43c3-ade4-a0fdac84067a`, `78f0db50-3045-486d-bdd3-6903d6b455f0`, `f75e0a5f-893a-4c65-8f33-81262ec5ebb9`, `4d2faafb-108d-4d42-9b0d-99d049ef1092`, `ad35bf8c-68db-4965-89a1-1864b9a1ca7a`, `79b89e39-0f95-487e-911a-c94eebc9ce23`, `5e4ba81b-81bb-4c3d-bbee-5633acd84d8e`, `0aebb0d8-6108-4c41-a3a1-72922eda606f`, `5e163210-4eed-4217-907f-4005e995a81e`, `88d2f57b-47e1-4319-925c-f3028102346a`, `79edce12-9fcd-47f9-aca4-e527d7e46226`, `cd29cf82-9f44-45d9-bf96-bd99aaec80e4`, `d0675224-a7dc-4ded-bb2b-d293a2bc7c70`, `01ef546b-8138-46cf-9e07-90e94632fd8e`, `76bba5ce-5d99-41ee-9e26-f4062dd5f334`, `a73c8208-96f6-41ce-847c-1d457a14b498`, `9e4d7f5a-9610-4a82-a580-978d5a84b8e1`, `fc0d0b19-4596-400a-86a8-29b7f54045d5`, `4a9f2955-6790-4be0-8d4a-d86a4a224fcd`, `8c0c5108-50c7-4ae6-ac8f-eea1746e41e8`, `e3ef921e-69d3-45b6-a098-208f160b3b3a`, `bd17acfa-e893-4ea1-b650-e6f32f13b561`, `b4b8e0b9-5ff6-44ec-b379-50553848ed02`, `508e268c-74fb-413b-a393-5c137590acc5`, `a0cbf790-57c2-4793-b60f-fb56323a0f40`, `23d48149-5cd4-4f56-9324-22441962d215`, `c775eb7a-8d98-4398-8452-95735d8e5677`, `a82b92a7-d134-4eec-b934-70b8b2eb36b9`, `de9e4a71-4263-4630-a406-03feb0175c28`, `56224b44-17a5-4a2a-acc9-d8f99f9c72cf`, `2a2e277d-df2d-4a2f-a52a-0e044f516280`, `007a3895-51cf-4d7c-9c52-303411382d76`, `44714849-14f0-494a-b1e7-efe121063e83`, `0800d9ac-da4b-4b5e-b857-2a1107860e48`, `9472d907-cf37-402c-b768-9b5366e469e9`, `d973c64d-1590-468d-8859-da7d0112c24c`, `f6147dc5-d35e-4802-8d3b-f43090ecf8c6`, `34c6c6ba-5daf-4ea2-afc3-9d2855402735`, `862678d9-1a02-448d-a4b7-4978f8ad391a`, `fde93d35-722b-4db0-86d8-0070fb750f17`, `bb2cd2d6-08cd-4ae0-8a72-6eaddcd0bd10`, `55c8a7d5-1cd9-492a-800e-9ac4411b8d34`, `e211475e-fff4-4a8c-9862-697a26d26ee7`, `4e228153-b243-42b4-a9e7-0f27a7e65f35`, `c6075b19-429f-4e53-8c40-a85f29774b3a`, `b5e80856-3c53-49e5-a19b-ff540bdc5052`, `ca131fbf-a1a6-46d0-bc5e-2d822ecfcfb0`, `5d674513-c776-4c81-82a8-ffad592e8c5e`, `86906dbc-9735-4f36-a9e1-2363f4e4a47f`, `8052e960-c152-4687-abaa-597c076a0629`, `2fc704f8-eb6e-4190-b350-6c090de1d011`, `0fdba70d-cdfd-4e12-8dad-b1f72f6b1be4`, `82ca4d46-b346-4a6f-8d25-09dd3f67f413`, `09e8cdc0-b4c3-414c-a688-77ce876352fa`, `cb8ce0e2-db2f-4c36-8623-402863e32747`, `5292a31a-4078-49db-9452-e17ce90b78c7`, `8e1ad158-c774-439a-8b34-d0ef612a2848`, `f46487f3-cc37-48ec-87d2-ee907e67a53c`, `6987ec14-dc39-4813-924b-dcc573056bff`, `dabdf726-9f96-4986-b61c-e017242be92d`, `1730bf01-09b8-4702-9723-a529cc5e6bf8`, `46f3a74c-9b63-4641-8b14-39a1f080ce02`, `d0def786-1824-4107-a6e9-d4c9988c328f`, `e1ba5cda-75b6-4333-8b2c-cec67f839405`, `e36bfdf0-048c-4578-b67d-00ec8d8c3869`, `4ca33d84-b2e8-4229-b22b-87d9e42317d2`, `845db391-d0cb-41ef-a1b9-ac0fc66b3ff8`, `d3f14ee9-d3db-4337-803d-bc0275d825f4`, `16ab1775-57c4-4ff2-9f20-2c228735b6f5`, `d5a9feef-6f56-4eeb-8477-392968ca9701`, `2558d822-e533-4de7-bc6d-366214155de0`, `1883548f-1fb1-47e1-bfd8-e630bad0948f`, `5351d4a3-f6c3-4a2e-934f-9ab1c8413b84`, `a85aef19-701d-4a43-8a01-44371bb34957`, `10f0ebea-e588-413d-b4d6-088d7d644615`, `4f10910d-014d-4295-9e6a-ce7c720f3595`, `2fcfa970-315b-4678-b68d-a7c187ee882d`, `289c05a9-0396-4435-87b5-0be83bfb9830`, `455008cb-6559-4d90-a559-a4c2ea073360`, `d18769ea-3d72-4ad7-a642-518c181f55e2`, `0e66d0cd-291a-4a78-9f32-b84c8a46ca73`, `fb2331d7-1a1a-46c5-9b66-4aaf40183039`, `44825006-6a7c-4527-8f69-22ac5b4cd2bb`, `ca97536c-861f-4736-9b2d-3b662f811961`, `6d42308c-4267-462d-aa26-639567f11f7d`, `37da85ec-e760-4e77-84f9-9c9d3ec1b83a`, `77a0e933-207c-4bc2-a905-f57a3dd7be79`, `c53ac3a5-9ffd-406c-845a-1092669859c4`, `6b487109-45ef-41b0-aa8d-4c06a5a68f1e`, `abde03ca-e6e9-43b3-b7cc-e79a1025d4bd`, `ba9f434c-7220-43eb-bf1d-b4ac8130740f`, `7a3a482f-d415-47bd-b83d-10cdbed17c58`, `39da1fb1-2ee3-4751-8883-5569b48d6463`, `9cb9887a-846d-4850-81f9-81e6753aee0e`, `4fa40bc1-1e64-417d-b101-bab2cd9aa322`, `759eaae4-e26e-423e-87e9-33b820983d4f`, `53005fea-2bc9-4a4f-921d-c6853b2dbf62`, `6e157fa9-e97f-49b8-b77a-5e3cdcb5a499`, `97bd15ca-6a21-4237-8e81-8dc9122b6062`, `f5251fba-3533-49ae-a6bf-da727c32639f`, `ebeb48cd-6ac3-4e2d-8966-12fcaef1a0a5`, `cfe9bb6c-a4de-4b92-818c-85b83a3377d7`, `3279caa8-f407-4661-86b3-dbab35833462`, `cafadb89-9ed7-41ce-90de-6711a7b709f4`, `9296ff1e-ce90-45e8-b75d-344909a1beb0`, `920fd6de-6364-4071-a24f-c084b1acbe19`, `7feff2c6-be09-4f88-9e8b-8f9323e27644`, `19306c5c-7ac3-4dd4-94e2-49ad0760ba91`, `b9512ab9-7de4-40d8-aca7-a114778a2d2f`, `784b2787-8834-452b-815d-6cead79d737f`, `d68d3072-8f0c-4ba8-810a-0c9fa1aa1b80`, `611dc2c1-a46f-4839-bc52-af9888c0617c`, `60a1c7c7-cacf-4785-b6f4-7c780810840d`, `7d7093b6-c60d-4b2d-bdad-218eed4057ab`, `184352f3-6cd9-4424-88b1-e6fde777f5e9`, `95253478-3009-473d-afe7-b2b0f8498910`, `f22f778d-78b0-4aeb-83f4-2770a5ecf6a1`, `40c99db4-e080-44a3-8874-b43ec8d945ec`, `7440571a-841a-11ed-aa7c-7003bca91a86`, `72ee3817-6dcd-4737-bfc3-7bdc78329b4e`, `04863f76-9920-4e6f-a69b-ea09155dee66`, `ae31d626-f537-48f7-98e2-1caa87f81eec`, `95a95798-0dc2-4a75-b7d2-1fc9eb17bf6a`, `1f8e587c-30e2-4e92-b63e-4f20d5dd97dd`, `f9cc0516-0872-4cd0-9f86-786ddac35e61`, `71e62af5-15ad-4170-9235-207e89c2d8e8`, `0582286d-25ff-432d-8bda-2ed1d24e87c9`, `6552f03a-0b1b-4552-ad2c-dc5a9133f1bb`, `8e955a2c-833e-44a0-9e13-5dc09359abfb`, `73a7631e-c084-4619-beae-eec03ce1a604`, `a9b25172-ba2c-43a9-94c2-5ffef8989a20`, `9c992aaa-3993-4701-93ef-90d0faf50c8f`, `615d8091-48fd-46f3-aebc-740e9e30ae8a`, `7d123c06-f464-41dd-b5fe-83b31167cb61`, `143c938c-1ed3-4578-ab59-83402bac08e2`, `aa138b71-f579-4df4-a6ec-e7de746b1582`, `d293c4a2-6956-43ae-b5d0-1d8abfb46eed`, `0744a6bb-de25-4d15-885d-4fc9dfd0b2db`, `1779f213-4cd8-4826-b020-9595a54ad55b`, `26a24ca0-e6d4-4afb-9e7d-327477a6f9ac`, `1aee88ff-5f2a-4ec2-aa5a-5e81bf7f9894`, `2a418b33-0fe5-4ca4-9f85-23886ebd77dc`, `c00f1dbe-ead3-4a1b-807e-eefcc1ed6473`, `b64745eb-e056-49dd-82a5-907d0914e4a6`, `479f9f09-f734-4547-b7d3-0165cfa65e1f`, `eac98a9c-a722-4ff0-a3c3-db47e801674c`, `2d00a271-9e66-4517-b825-69368e0e7ce8`, `69314bdc-658b-4e64-8d2b-33186a749bb4`, `1078e8df-d82f-4f0a-89ea-d60695685ac6`, `366e2d64-f6c2-47f2-b7c3-020ea2b9decc`, `8639398b-d15d-49b3-bc1d-14969b24e43e`, `1162282f-8cc0-4a36-b39d-f840dff53367`, `7bcec69a-0727-4129-98a8-cc44bb537d44`, `468fa4b2-b63d-4da7-b8d7-e73dca2a6ba0`, `9ea5a58b-7a88-4399-8cb7-ca0ca58da52e`, `782e9b4b-ae8d-47ef-b273-4f710ee73c79`, `437a9ff3-e9fd-4ce8-9d7b-cf1bf93068d1`, `3e2a1cf1-32a3-413e-b269-f1512d02467b`, `0b89405c-18d5-4d2f-bb14-2bf96a67d6d3`, `6fc595fd-fcc8-4187-83b8-821c02c7ed0d`, `03abbb3a-4069-40fa-b754-1252b308b07d`, `11864dc0-ee28-480b-851a-bf433679107d`, `6bfb170b-8993-4132-a26d-8ec455614c70`, `7fbda2ba-2eda-4c50-88d0-41d624cf511b`, `6e0e3c3e-6dd2-4c13-bf49-c269a4e6fb89`, `bd34062b-d47f-455f-a26e-d93895a4e06c`, `5fc6484b-d841-45dc-87ec-57af18ba4b32`, `d45019fe-712d-4717-973a-abe0a0570845`, `61273508-52f1-4c83-a575-c648e2db6bca`, `c2e093fe-4a2a-495c-9866-e7b173f85609`, `c76a45ea-b245-4eb3-958b-9551e4f041ab`, `5c49b6cd-4107-484c-986d-3de1c8454fd5`, `15b295fe-2463-49e3-807e-97785fc816d9`, `e7d561d2-440f-41d2-95a5-67e100a61885`, `4cf52d04-6f03-4610-8ef6-10b96a5d6369`, `4772d63d-ccb8-4899-b145-cb5543422d25`, `78db92f9-ddc6-4c02-a263-5ab9df0658b4`, `893b9929-db58-4d6a-9c26-c97873b67d1a`, `4e80a5c5-6b0f-448d-a723-6c702afb7e27`, `bbac8512-1ec3-40bd-93bc-b633d47e459d`, `9397b528-3bfb-4671-8888-4a9ae87571aa`, `bb6d124d-7153-4a05-8f87-7ecf0ecae74f`, `21da317f-f2af-49f7-ab85-466761ccac24`, `39be6753-2f6c-45c3-9616-48f1863533db`

### Company Forms independent-permission development fixtures

Test-owned actors, definition and subject created for permission verification; no protected historical declarations modified.

{
  "office": {
    "id": 209,
    "role": "TEST ONLY CF PERMISSIONS OFFICE b91cda97",
    "roleUuid": "b91cda97-dba7-4708-b391-855fe037e386",
    "userUuid": "891fc283-a3e5-422f-839b-9b4e76b06274",
    "userType": "Office"
  },
  "ship": {
    "id": 210,
    "role": "TEST ONLY CF PERMISSIONS VESSEL 299c9339",
    "roleUuid": "299c9339-24d2-4f5c-acab-504ab149ebc1",
    "userUuid": "4ba6c16f-7f3f-403b-bb2d-eb0b391ac910",
    "userType": "Ship"
  },
  "admin": {
    "id": 1,
    "role": "Sail Admin",
    "userType": "Office",
    "roleUuid": "5f06d995-832d-42ba-96bd-7928ab9f099c"
  },
  "crewUuid": "d64d7a3c-defa-42cc-a2b3-9a27d207b58a",
  "assignUuid": "1819a41c-fff4-4452-939d-cc09e7a8e726",
  "formUuid": "963b650d-2fbe-4357-b6eb-108ea74ada82",
  "versionUuid": "2adb5a76-ce14-45f0-9535-a8452d436973",
  "sectionUuid": "9cd8ec46-bdc9-4102-be0e-d2fffe46fd56",
  "vesselUuid": "7440571a-841a-11ed-aa7c-7003bca91a86"
}

- Retained test context (2026-10-11T07:32:29.189Z): tests/unit/fixture-retention.test.ts; target crew_assignments; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:01.178Z): tests/unit/company-form-planning-lock-order.test.ts; target "cf_lock_d6e302d9680d4183a2b85dc402edceb6"; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:12.063Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_signatures; references `1906196c-8683-4895-bbe9-4160d798cef3`, `c8bbc449-34c2-4d7a-af56-af4294ab1873`, `6534ae47-674a-48ff-ae95-1c4b585482d0`, `74665feb-f6dc-4b6b-9cc0-450cc94c54f7`, `513b838c-02a0-4359-829e-2936fbecea59`.

- Retained test context (2026-10-11T07:51:12.064Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_signature_attachments; references `dc5757d3-079c-49fd-a7cf-ee35ed7712ad`, `cfe0065e-d28c-41f0-803f-2bdfbafad5ee`, `8c755c90-1cbe-4ac8-a8cd-4f1c2d996b35`, `c541f871-4f38-4654-babe-613615929d5e`, `9bc4b7ce-2b47-4a4f-927f-8f5b592bc46f`, `b4b8c4f9-814e-4fa9-a986-f266acb376cb`.

- Retained test context (2026-10-11T07:51:12.064Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references `1906196c-8683-4895-bbe9-4160d798cef3`, `c8bbc449-34c2-4d7a-af56-af4294ab1873`, `6534ae47-674a-48ff-ae95-1c4b585482d0`, `74665feb-f6dc-4b6b-9cc0-450cc94c54f7`, `513b838c-02a0-4359-829e-2936fbecea59`.

- Retained test context (2026-10-11T07:51:12.065Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_answers; references `1906196c-8683-4895-bbe9-4160d798cef3`, `c8bbc449-34c2-4d7a-af56-af4294ab1873`, `6534ae47-674a-48ff-ae95-1c4b585482d0`, `74665feb-f6dc-4b6b-9cc0-450cc94c54f7`, `513b838c-02a0-4359-829e-2936fbecea59`.

- Retained test context (2026-10-11T07:51:12.066Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_states; references `1906196c-8683-4895-bbe9-4160d798cef3`, `c8bbc449-34c2-4d7a-af56-af4294ab1873`, `6534ae47-674a-48ff-ae95-1c4b585482d0`, `74665feb-f6dc-4b6b-9cc0-450cc94c54f7`, `513b838c-02a0-4359-829e-2936fbecea59`.

- Retained test context (2026-10-11T07:51:12.067Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_assignments; references `1906196c-8683-4895-bbe9-4160d798cef3`, `c8bbc449-34c2-4d7a-af56-af4294ab1873`, `6534ae47-674a-48ff-ae95-1c4b585482d0`, `74665feb-f6dc-4b6b-9cc0-450cc94c54f7`, `513b838c-02a0-4359-829e-2936fbecea59`.

- Retained test context (2026-10-11T07:51:12.067Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references `1906196c-8683-4895-bbe9-4160d798cef3`, `c8bbc449-34c2-4d7a-af56-af4294ab1873`, `6534ae47-674a-48ff-ae95-1c4b585482d0`, `74665feb-f6dc-4b6b-9cc0-450cc94c54f7`, `513b838c-02a0-4359-829e-2936fbecea59`.

- Retained test context (2026-10-11T07:51:12.069Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_questions; references `e21b20eb-8817-473c-9a9e-654b96f56271`, `59dfaf29-3d6a-45e9-8b48-1c769e246fe6`, `ad2a1f41-c682-4ebf-a460-f56323d46a30`, `9511daf9-228c-45d2-8a57-37e8d3bf4800`.

- Retained test context (2026-10-11T07:51:12.069Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_sections; references `e21b20eb-8817-473c-9a9e-654b96f56271`, `59dfaf29-3d6a-45e9-8b48-1c769e246fe6`, `ad2a1f41-c682-4ebf-a460-f56323d46a30`, `9511daf9-228c-45d2-8a57-37e8d3bf4800`.

- Retained test context (2026-10-11T07:51:12.070Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_form_parts; references `e21b20eb-8817-473c-9a9e-654b96f56271`, `59dfaf29-3d6a-45e9-8b48-1c769e246fe6`, `ad2a1f41-c682-4ebf-a460-f56323d46a30`, `9511daf9-228c-45d2-8a57-37e8d3bf4800`.

- Retained test context (2026-10-11T07:51:12.070Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_form_versions_v2; references `e21b20eb-8817-473c-9a9e-654b96f56271`, `59dfaf29-3d6a-45e9-8b48-1c769e246fe6`, `ad2a1f41-c682-4ebf-a460-f56323d46a30`, `9511daf9-228c-45d2-8a57-37e8d3bf4800`.

- Retained test context (2026-10-11T07:51:12.070Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_forms_v2; references `57094e45-cd8d-43df-902e-bb13f2ba863c`, `29023d9f-6b06-4697-9bd5-f010353d0b67`.

- Retained test context (2026-10-11T07:51:12.071Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_assignments; references `77153c54-3635-4207-b5ae-d5715b558dde`, `94da92cb-da6b-4c26-8467-07d771fbe083`, `e4513e5b-cb41-4f16-97da-dfd8efdf8a8d`, `09a86922-5284-4ca9-b764-e1cf638c92fe`.

- Retained test context (2026-10-11T07:51:12.071Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_members_v2; references `e7de4674-fbd6-43ac-bf2e-9a4a584cbc04`.

- Retained test context (2026-10-11T07:51:12.071Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `6fb584ae-9883-43a8-8595-3d5f1aa98a3a`.

- Retained test context (2026-10-11T07:51:12.072Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `59b97073-6d5b-47e0-96f4-4edbda264359`.

- Retained test context (2026-10-11T07:51:12.077Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_resource_action_grants; references `1c7d368a-7049-4128-8fe2-b2afd4d323d2`, `8d3c28d9-de31-4848-acc2-4d58f4482960`, `7861d16b-174a-44c8-ab6a-3755ec82cc9a`, `f7d4ffd9-8e04-41ac-a75b-1214f6cee3fa`.

- Retained test context (2026-10-11T07:51:12.078Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_roleaccess_ac; references `1c7d368a-7049-4128-8fe2-b2afd4d323d2`, `8d3c28d9-de31-4848-acc2-4d58f4482960`, `7861d16b-174a-44c8-ab6a-3755ec82cc9a`, `f7d4ffd9-8e04-41ac-a75b-1214f6cee3fa`.

- Retained test context (2026-10-11T07:51:12.078Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:12.079Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_rolemaster_ac; references `1c7d368a-7049-4128-8fe2-b2afd4d323d2`, `8d3c28d9-de31-4848-acc2-4d58f4482960`, `7861d16b-174a-44c8-ab6a-3755ec82cc9a`, `f7d4ffd9-8e04-41ac-a75b-1214f6cee3fa`.

- Retained test context (2026-10-11T07:51:14.328Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_section_signatures; references `4d4f0093-14bd-414c-8320-0611400c03db`, `a437435a-ae68-439c-ab53-cd1b5044eae9`.

- Retained test context (2026-10-11T07:51:14.329Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_answers; references `4d4f0093-14bd-414c-8320-0611400c03db`, `a437435a-ae68-439c-ab53-cd1b5044eae9`.

- Retained test context (2026-10-11T07:51:14.329Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_section_states; references `4d4f0093-14bd-414c-8320-0611400c03db`, `a437435a-ae68-439c-ab53-cd1b5044eae9`.

- Retained test context (2026-10-11T07:51:14.330Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_company_submission_assignments; references `4d4f0093-14bd-414c-8320-0611400c03db`, `a437435a-ae68-439c-ab53-cd1b5044eae9`.

- Retained test context (2026-10-11T07:51:14.331Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_company_submissions; references `4d4f0093-14bd-414c-8320-0611400c03db`, `a437435a-ae68-439c-ab53-cd1b5044eae9`.

- Retained test context (2026-10-11T07:51:14.331Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_signature_attachments; references `022a94af-cfe5-4bde-ba93-f9488a03e439`.

- Retained test context (2026-10-11T07:51:14.332Z): tests/integration/api/company-form-submission-boundary.test.ts; target crew_assignments; references `28b047a7-e4fb-4588-a7d4-05c1dcc4ecce`, `25dd5a6a-3000-41db-873c-433c4f638e83`.

- Retained test context (2026-10-11T07:51:14.332Z): tests/integration/api/company-form-submission-boundary.test.ts; target crew_members_v2; references `ed8212c1-a66e-408d-a8e5-d4fecbc4a704`.

- Retained test context (2026-10-11T07:51:14.333Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_questions; references `0bcc182f-3882-4da9-bd2a-0debf9b6dd3a`.

- Retained test context (2026-10-11T07:51:14.333Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_sections; references `2c0ceaaf-55f0-4abb-aab9-f10171bbca8b`.

- Retained test context (2026-10-11T07:51:14.334Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_form_parts; references `c82c86c2-abd8-45a6-932e-ac020c239d0c`.

- Retained test context (2026-10-11T07:51:14.334Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_options; references `641f4d32-34af-4a35-8122-e12add221d50`.

- Retained test context (2026-10-11T07:51:14.335Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_option_sets; references `641f4d32-34af-4a35-8122-e12add221d50`.

- Retained test context (2026-10-11T07:51:14.335Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_form_versions_v2; references `e3be2242-6122-453e-bfcd-2941e1b3329f`.

- Retained test context (2026-10-11T07:51:14.335Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_forms_v2; references `f53fc50a-2ce2-4d15-8987-5b75ec539610`.

- Retained test context (2026-10-11T07:51:14.337Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_resource_action_grants; references `db7dcf3e-5509-4f8f-9385-d6ccc94e5a3c`, `41a7b921-dfa2-479c-808c-885518405799`, `d0ab321c-75a5-47e3-b68e-7be99a8f16ae`, `eb22ec66-5d6e-4e0c-9f7c-47a1d023300f`, `29b52a93-b7b9-4d36-9c30-5204f2ed247d`, `a2c06483-24d3-4542-acd0-23d81df4d75a`, `70f7bec0-812d-40a9-92f0-1000df900819`.

- Retained test context (2026-10-11T07:51:14.337Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_roleaccess_ac; references `db7dcf3e-5509-4f8f-9385-d6ccc94e5a3c`, `41a7b921-dfa2-479c-808c-885518405799`, `d0ab321c-75a5-47e3-b68e-7be99a8f16ae`, `eb22ec66-5d6e-4e0c-9f7c-47a1d023300f`, `29b52a93-b7b9-4d36-9c30-5204f2ed247d`, `a2c06483-24d3-4542-acd0-23d81df4d75a`, `70f7bec0-812d-40a9-92f0-1000df900819`.

- Retained test context (2026-10-11T07:51:14.338Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_rolemaster_ac; references `db7dcf3e-5509-4f8f-9385-d6ccc94e5a3c`, `41a7b921-dfa2-479c-808c-885518405799`, `d0ab321c-75a5-47e3-b68e-7be99a8f16ae`, `eb22ec66-5d6e-4e0c-9f7c-47a1d023300f`, `29b52a93-b7b9-4d36-9c30-5204f2ed247d`, `a2c06483-24d3-4542-acd0-23d81df4d75a`, `70f7bec0-812d-40a9-92f0-1000df900819`.

- Retained test context (2026-10-11T07:51:14.338Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:14.339Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessels; references `2bf0feb4-24ec-4951-a7b4-f0b4fdddaf07`.

- Retained test context (2026-10-11T07:51:14.339Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessels; references `f0765b78-dc45-4c42-b92b-191bd8c67a4f`.

- Retained test context (2026-10-11T07:51:14.339Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessel_types; references `ef5283a2-7c19-46f0-ad50-efc4c6eb17ff`.

- Retained test context (2026-10-11T07:51:20.842Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_signatures; references `8685bafe-0d51-49e7-8f80-87e592155d9b`, `b50c1d22-8932-4406-97f8-a2360cab2619`.

- Retained test context (2026-10-11T07:51:20.842Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_signature_attachments; references `8685bafe-0d51-49e7-8f80-87e592155d9b`, `b50c1d22-8932-4406-97f8-a2360cab2619`.

- Retained test context (2026-10-11T07:51:20.843Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_answers; references `34f09e01-a8bb-42f4-9591-0741653c6904`, `43496cbe-8d43-4ea3-aefe-72fe1bebe13e`, `85880011-e41d-44cf-9bba-fa53a532e44d`, `3fb222c0-b062-46db-ba63-c5c84f0d60e6`.

- Retained test context (2026-10-11T07:51:20.843Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_states; references `34f09e01-a8bb-42f4-9591-0741653c6904`, `43496cbe-8d43-4ea3-aefe-72fe1bebe13e`, `85880011-e41d-44cf-9bba-fa53a532e44d`, `3fb222c0-b062-46db-ba63-c5c84f0d60e6`.

- Retained test context (2026-10-11T07:51:20.844Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_answers; references `e4431839-f5d3-48c5-bc76-eeecfddfac32`.

- Retained test context (2026-10-11T07:51:20.844Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_states; references `e4431839-f5d3-48c5-bc76-eeecfddfac32`.

- Retained test context (2026-10-11T07:51:20.845Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_company_submission_assignments; references `bc7ca35a-4e05-4b2a-aa78-d39a8b13c0c6`, `03b2f699-89bd-4dad-9680-7cc7f1afde90`, `626b28e6-009d-49f5-a1ea-9ea6b0ecc06a`, `5f708a60-de90-4464-b78e-3dae194b30aa`, `548db53a-7900-4490-83cb-1240f4d90ce6`.

- Retained test context (2026-10-11T07:51:20.845Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_company_submissions; references `bc7ca35a-4e05-4b2a-aa78-d39a8b13c0c6`, `03b2f699-89bd-4dad-9680-7cc7f1afde90`, `626b28e6-009d-49f5-a1ea-9ea6b0ecc06a`, `5f708a60-de90-4464-b78e-3dae194b30aa`, `548db53a-7900-4490-83cb-1240f4d90ce6`.

- Retained test context (2026-10-11T07:51:20.845Z): tests/integration/api/company-form-submission-starts.test.ts; target crew_assignments; references `bc7ca35a-4e05-4b2a-aa78-d39a8b13c0c6`, `03b2f699-89bd-4dad-9680-7cc7f1afde90`, `626b28e6-009d-49f5-a1ea-9ea6b0ecc06a`, `5f708a60-de90-4464-b78e-3dae194b30aa`, `548db53a-7900-4490-83cb-1240f4d90ce6`.

- Retained test context (2026-10-11T07:51:20.846Z): tests/integration/api/company-form-submission-starts.test.ts; target crew_members_v2; references `ce377938-e906-488c-8381-1e35c76c0e5a`.

- Retained test context (2026-10-11T07:51:20.846Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_questions; references `dadc2f48-27d9-47ee-b86f-2ad2305a4833`, `c95e6c75-1244-4ce4-9c06-4e3726e4f25d`, `b49826e5-5758-43c9-add7-68e1b5e58119`, `c02031a0-5211-4cc5-b2e2-408c8e2e6427`.

- Retained test context (2026-10-11T07:51:20.846Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_sections; references `dadc2f48-27d9-47ee-b86f-2ad2305a4833`, `c95e6c75-1244-4ce4-9c06-4e3726e4f25d`, `b49826e5-5758-43c9-add7-68e1b5e58119`, `c02031a0-5211-4cc5-b2e2-408c8e2e6427`.

- Retained test context (2026-10-11T07:51:20.846Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_options; references `985f3201-d6e3-4951-a429-4c71dae6db6c`, `dd8be96d-550a-4a0b-a2ee-0a001e1e3252`, `2c2c8a50-ce7d-40ab-ad9d-a88cb67db819`, `df007429-c015-4aa9-9d72-825d1c23c021`.

- Retained test context (2026-10-11T07:51:20.847Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_option_sets; references `985f3201-d6e3-4951-a429-4c71dae6db6c`, `dd8be96d-550a-4a0b-a2ee-0a001e1e3252`, `2c2c8a50-ce7d-40ab-ad9d-a88cb67db819`, `df007429-c015-4aa9-9d72-825d1c23c021`.

- Retained test context (2026-10-11T07:51:20.847Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_form_parts; references `02508914-3fb4-408d-9e62-9f07333d7b32`, `8f9b6706-17a6-48c6-b985-e1b8901792d2`, `6ce0728c-2b55-42c9-9cb1-a81da4efa37c`, `3bc6ffa5-b7a4-436b-8a76-5082d9bd81c5`.

- Retained test context (2026-10-11T07:51:20.847Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessel_types; references `5ad759bc-fb6a-4651-aba7-9e075e5b6971`.

- Retained test context (2026-10-11T07:51:20.847Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_form_versions_v2; references `ae989b40-e6bf-48c3-9e28-c98c65257d73`, `77030c51-3a65-4b86-8d2d-75e0680b17d9`, `3302c9b2-d0e0-4cb3-aac4-847c5da5330c`, `4bdb528d-2928-401d-b32e-d0e8ba604532`, `6b1f0d7c-57da-4bd6-90fb-0c3f5598c468`.

- Retained test context (2026-10-11T07:51:20.848Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_forms_v2; references `4baebcea-1c5b-4920-ba19-c82324779a00`, `6062ef8d-2de3-41c9-ba9f-87523837a14a`, `6a7ad87e-cb82-44ca-a6a0-e5697128eca2`.

- Retained test context (2026-10-11T07:51:20.851Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_resource_action_grants; references `f319828b-221c-448c-8728-5c5347392ab2`, `bb45c109-7dbe-49ef-9016-40783188ce57`, `8880e42e-6b28-4583-99c1-c2a2c506a13d`, `df39edb9-23b4-4595-9485-10d8e014a098`, `6f0e2187-5278-459c-bd6e-c3c030b92173`.

- Retained test context (2026-10-11T07:51:20.852Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_roleaccess_ac; references `f319828b-221c-448c-8728-5c5347392ab2`, `bb45c109-7dbe-49ef-9016-40783188ce57`, `8880e42e-6b28-4583-99c1-c2a2c506a13d`, `df39edb9-23b4-4595-9485-10d8e014a098`, `6f0e2187-5278-459c-bd6e-c3c030b92173`.

- Retained test context (2026-10-11T07:51:20.852Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_rolemaster_ac; references `f319828b-221c-448c-8728-5c5347392ab2`, `bb45c109-7dbe-49ef-9016-40783188ce57`, `8880e42e-6b28-4583-99c1-c2a2c506a13d`, `df39edb9-23b4-4595-9485-10d8e014a098`, `6f0e2187-5278-459c-bd6e-c3c030b92173`.

- Retained test context (2026-10-11T07:51:20.855Z): tests/integration/api/company-form-submission-starts.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:20.855Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessels; references `fa413a46-255c-4ff5-bd40-eb93319ca922`.

- Retained test context (2026-10-11T07:51:20.855Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessels; references `ad1af0ab-7096-4b5f-a73f-8b265327a817`.

- Retained test context (2026-10-11T07:51:23.033Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submission_system_snapshots; references `9c376d9c-1d99-419e-a01d-7dbe4bd7b410`, `2842a0dc-c026-4db5-8ea0-159bfcd1f5f6`, `6c171f69-3a6a-4fa7-b037-ed16eb70cf2d`, `650a04c9-417b-4bb2-9ede-739157e50e41`, `50ebfa1d-4ea0-4f6a-b3a9-15eff87a06e3`.

- Retained test context (2026-10-11T07:51:23.034Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_section_signatures; references `9c376d9c-1d99-419e-a01d-7dbe4bd7b410`, `2842a0dc-c026-4db5-8ea0-159bfcd1f5f6`, `6c171f69-3a6a-4fa7-b037-ed16eb70cf2d`, `650a04c9-417b-4bb2-9ede-739157e50e41`, `50ebfa1d-4ea0-4f6a-b3a9-15eff87a06e3`.

- Retained test context (2026-10-11T07:51:23.035Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_answers; references `9c376d9c-1d99-419e-a01d-7dbe4bd7b410`, `2842a0dc-c026-4db5-8ea0-159bfcd1f5f6`, `6c171f69-3a6a-4fa7-b037-ed16eb70cf2d`, `650a04c9-417b-4bb2-9ede-739157e50e41`, `50ebfa1d-4ea0-4f6a-b3a9-15eff87a06e3`.

- Retained test context (2026-10-11T07:51:23.036Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_section_states; references `9c376d9c-1d99-419e-a01d-7dbe4bd7b410`, `2842a0dc-c026-4db5-8ea0-159bfcd1f5f6`, `6c171f69-3a6a-4fa7-b037-ed16eb70cf2d`, `650a04c9-417b-4bb2-9ede-739157e50e41`, `50ebfa1d-4ea0-4f6a-b3a9-15eff87a06e3`.

- Retained test context (2026-10-11T07:51:23.036Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submissions; references `9c376d9c-1d99-419e-a01d-7dbe4bd7b410`, `2842a0dc-c026-4db5-8ea0-159bfcd1f5f6`, `6c171f69-3a6a-4fa7-b037-ed16eb70cf2d`, `650a04c9-417b-4bb2-9ede-739157e50e41`, `50ebfa1d-4ea0-4f6a-b3a9-15eff87a06e3`.

- Retained test context (2026-10-11T07:51:23.037Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_signature_attachments; references `a01738de-2650-456b-9904-77dbc481d195`, `2f8028ec-240b-4c6f-a82a-56d846edc713`, `fd68eb0b-ee6b-4484-9c76-6ccceb442d7e`, `77d545a0-b7de-4db5-bc0b-384834c28a84`, `43c78016-6bc7-4e30-adcc-8e9ea3d79339`, `a999793d-8a4e-4657-bf4d-6b49054e1106`.

- Retained test context (2026-10-11T07:51:23.038Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_questions; references `1c2d28e9-a297-46d7-9475-f21030badbde`, `63c94dcf-b441-4267-89af-4d082c295908`, `995cbd65-2f24-4785-adeb-b3963ec7730d`, `90407086-7651-4594-a8ff-076bd72d65b3`, `20ba5e13-080c-4964-ab6c-1ffe7c1c4241`, `750d1af0-be46-479a-a245-0c1ea050d4d2`, `477c32d3-c734-426d-9b3e-a2291d1d1081`.

- Retained test context (2026-10-11T07:51:23.038Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_sections; references `181ef2c0-ff56-4284-ad19-2d0261c95e3f`, `4702917e-9577-49e6-8e43-7d3a35353127`, `5d2fee81-da79-4a84-addd-b88010325ef4`, `8f3b8e9a-8219-4fa8-a77f-70c788e0d2d0`, `dccd897f-b146-43a0-9e3e-0bd2b33775eb`.

- Retained test context (2026-10-11T07:51:23.039Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_form_parts; references `bf7d4ce8-a08d-43d8-ade9-e78fb1f34821`.

- Retained test context (2026-10-11T07:51:23.039Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_form_versions_v2; references `597ba1dc-4c6f-4e12-8f0d-9f7900a7a85e`.

- Retained test context (2026-10-11T07:51:23.039Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_forms_v2; references `1bb57215-6655-417f-bef8-eca27af158a8`.

- Retained test context (2026-10-11T07:51:23.040Z): tests/integration/company-form-stage-less-runtime.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:23.040Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_roleaccess_ac; references `a4b16421-6302-452c-879c-a93b70cd2570`.

- Retained test context (2026-10-11T07:51:23.040Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_rolemaster_ac; references `a4b16421-6302-452c-879c-a93b70cd2570`.

- Retained test context (2026-10-11T07:51:23.040Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_subject_types; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:25.824Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `9a8e1c35-24b6-4ffe-9607-efbff690432c`.

- Retained test context (2026-10-11T07:51:25.825Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `9a8e1c35-24b6-4ffe-9607-efbff690432c`.

- Retained test context (2026-10-11T07:51:25.826Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `9a8e1c35-24b6-4ffe-9607-efbff690432c`.

- Retained test context (2026-10-11T07:51:25.827Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `9a8e1c35-24b6-4ffe-9607-efbff690432c`.

- Retained test context (2026-10-11T07:51:25.827Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `9a8e1c35-24b6-4ffe-9607-efbff690432c`.

- Retained test context (2026-10-11T07:51:25.828Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `63a3caea-c6d7-4664-82c1-8f8c64cf1449`.

- Retained test context (2026-10-11T07:51:25.828Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `63a3caea-c6d7-4664-82c1-8f8c64cf1449`.

- Retained test context (2026-10-11T07:51:25.829Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `63a3caea-c6d7-4664-82c1-8f8c64cf1449`.

- Retained test context (2026-10-11T07:51:25.829Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `63a3caea-c6d7-4664-82c1-8f8c64cf1449`.

- Retained test context (2026-10-11T07:51:25.830Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `63a3caea-c6d7-4664-82c1-8f8c64cf1449`.

- Retained test context (2026-10-11T07:51:25.830Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `f78cea17-800f-41d7-afa3-d14d9279efd5`.

- Retained test context (2026-10-11T07:51:25.831Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `f78cea17-800f-41d7-afa3-d14d9279efd5`.

- Retained test context (2026-10-11T07:51:25.831Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `f78cea17-800f-41d7-afa3-d14d9279efd5`.

- Retained test context (2026-10-11T07:51:25.832Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `f78cea17-800f-41d7-afa3-d14d9279efd5`.

- Retained test context (2026-10-11T07:51:25.833Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `f78cea17-800f-41d7-afa3-d14d9279efd5`.

- Retained test context (2026-10-11T07:51:25.833Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `60c53e4c-9213-4fb9-9cf3-a0afbfe55d35`.

- Retained test context (2026-10-11T07:51:25.833Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `60c53e4c-9213-4fb9-9cf3-a0afbfe55d35`.

- Retained test context (2026-10-11T07:51:25.834Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `60c53e4c-9213-4fb9-9cf3-a0afbfe55d35`.

- Retained test context (2026-10-11T07:51:25.834Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `60c53e4c-9213-4fb9-9cf3-a0afbfe55d35`.

- Retained test context (2026-10-11T07:51:25.835Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `60c53e4c-9213-4fb9-9cf3-a0afbfe55d35`.

- Retained test context (2026-10-11T07:51:25.835Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `cf80d14c-0755-431e-bd24-405c20cd407b`.

- Retained test context (2026-10-11T07:51:25.836Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `cf80d14c-0755-431e-bd24-405c20cd407b`.

- Retained test context (2026-10-11T07:51:25.836Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `cf80d14c-0755-431e-bd24-405c20cd407b`.

- Retained test context (2026-10-11T07:51:25.836Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `cf80d14c-0755-431e-bd24-405c20cd407b`.

- Retained test context (2026-10-11T07:51:25.836Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `cf80d14c-0755-431e-bd24-405c20cd407b`.

- Retained test context (2026-10-11T07:51:25.837Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `1b4cd624-6ec0-4f15-bd65-acff3c9a6680`.

- Retained test context (2026-10-11T07:51:25.837Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `1b4cd624-6ec0-4f15-bd65-acff3c9a6680`.

- Retained test context (2026-10-11T07:51:25.837Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `1b4cd624-6ec0-4f15-bd65-acff3c9a6680`.

- Retained test context (2026-10-11T07:51:25.838Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `1b4cd624-6ec0-4f15-bd65-acff3c9a6680`.

- Retained test context (2026-10-11T07:51:25.838Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `1b4cd624-6ec0-4f15-bd65-acff3c9a6680`.

- Retained test context (2026-10-11T07:51:25.838Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `1035914c-ae8d-4a54-a8ee-ef65d1472235`.

- Retained test context (2026-10-11T07:51:25.839Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `1035914c-ae8d-4a54-a8ee-ef65d1472235`.

- Retained test context (2026-10-11T07:51:25.839Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `1035914c-ae8d-4a54-a8ee-ef65d1472235`.

- Retained test context (2026-10-11T07:51:25.839Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `1035914c-ae8d-4a54-a8ee-ef65d1472235`.

- Retained test context (2026-10-11T07:51:25.840Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `1035914c-ae8d-4a54-a8ee-ef65d1472235`.

- Retained test context (2026-10-11T07:51:25.840Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `fe4161b8-fc12-4542-aef4-925c016bd377`.

- Retained test context (2026-10-11T07:51:25.840Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `fe4161b8-fc12-4542-aef4-925c016bd377`.

- Retained test context (2026-10-11T07:51:25.841Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `fe4161b8-fc12-4542-aef4-925c016bd377`.

- Retained test context (2026-10-11T07:51:25.841Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `fe4161b8-fc12-4542-aef4-925c016bd377`.

- Retained test context (2026-10-11T07:51:25.841Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `fe4161b8-fc12-4542-aef4-925c016bd377`.

- Retained test context (2026-10-11T07:51:25.842Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `f1ce6f13-a51b-449d-938f-c6c3638d08e2`.

- Retained test context (2026-10-11T07:51:25.842Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `f1ce6f13-a51b-449d-938f-c6c3638d08e2`.

- Retained test context (2026-10-11T07:51:25.842Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `f1ce6f13-a51b-449d-938f-c6c3638d08e2`.

- Retained test context (2026-10-11T07:51:25.843Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `f1ce6f13-a51b-449d-938f-c6c3638d08e2`.

- Retained test context (2026-10-11T07:51:25.843Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `f1ce6f13-a51b-449d-938f-c6c3638d08e2`.

- Retained test context (2026-10-11T07:51:28.579Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_answers; references `58dbb680-e573-4859-bc6d-9936596971b0`.

- Retained test context (2026-10-11T07:51:28.580Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_section_states; references `58dbb680-e573-4859-bc6d-9936596971b0`.

- Retained test context (2026-10-11T07:51:28.581Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_company_submission_assignments; references `58dbb680-e573-4859-bc6d-9936596971b0`.

- Retained test context (2026-10-11T07:51:28.582Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_company_submissions; references `58dbb680-e573-4859-bc6d-9936596971b0`.

- Retained test context (2026-10-11T07:51:28.582Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_questions; references `e3cec996-0c7e-43a3-8655-e92e994c673d`, `1e81d263-dee9-4684-8c95-4326c4ef318f`, `dd621b12-6776-4e30-8467-752a35002216`, `ccaad8df-3327-42b9-9f9f-1e2b2a87a41c`, `32d05884-3401-4e3c-8a5d-1c46a1153bf0`, `804734a5-8f70-41a7-85fc-0e6727020796`, `835a46ce-84a0-47cf-9bb3-b247dfc6818c`, `eec97951-23d8-427b-9376-9264a6967cc9`, `b2c7fe5a-354c-4fee-8419-3fdaee70cc4a`, `722084b9-465a-4ca8-8277-d1111738e2f5`, `117eb6df-23c9-4596-8b7f-b815aa18720b`, `6b2ff2ad-9610-4122-a2ee-c7b8655daa1d`, `4a6dc78b-7809-4b0c-8da7-2692f3f63960`.

- Retained test context (2026-10-11T07:51:28.583Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_sections; references `1f8fe790-70b9-416d-a2b9-716884b27153`.

- Retained test context (2026-10-11T07:51:28.584Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_form_parts; references `1ed02879-252d-4aba-863a-f5b589848686`.

- Retained test context (2026-10-11T07:51:28.584Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_options; references `8118956e-9f3e-45a0-b8a7-8622095d1290`.

- Retained test context (2026-10-11T07:51:28.585Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_option_sets; references `8118956e-9f3e-45a0-b8a7-8622095d1290`.

- Retained test context (2026-10-11T07:51:28.585Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_form_versions_v2; references `f8d647c9-961f-4187-8ff8-3e97001daf52`.

- Retained test context (2026-10-11T07:51:28.586Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_forms_v2; references `3bf9517e-4d6e-4c8b-9c0f-0afa9a0561a9`.

- Retained test context (2026-10-11T07:51:28.586Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target crew_assignments; references `c1ab8d89-e2c7-4a5f-97d2-3281fb8da56d`.

- Retained test context (2026-10-11T07:51:28.586Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target crew_members_v2; references `600365bb-0295-478a-9a9a-36cbbde841f6`.

- Retained test context (2026-10-11T07:51:28.587Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:28.588Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_resource_action_grants; references `5fc00dfe-a2ed-48e9-a277-d7e073443356`.

- Retained test context (2026-10-11T07:51:28.589Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_roleaccess_ac; references `5fc00dfe-a2ed-48e9-a277-d7e073443356`.

- Retained test context (2026-10-11T07:51:28.589Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_rolemaster_ac; references `5fc00dfe-a2ed-48e9-a277-d7e073443356`.

- Retained test context (2026-10-11T07:51:30.387Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_section_signatures; references `9fedf370-eaa3-4982-8272-fe3e85f2938e`, `aa17b3c2-c216-4a8a-b222-64acfb10d576`, `f77a4740-4af8-47fa-afcf-dd6bc992acb0`, `15d4edfc-fbdc-4ec9-b656-43b3dfa8402c`.

- Retained test context (2026-10-11T07:51:30.388Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_answers; references `9fedf370-eaa3-4982-8272-fe3e85f2938e`, `aa17b3c2-c216-4a8a-b222-64acfb10d576`, `f77a4740-4af8-47fa-afcf-dd6bc992acb0`, `15d4edfc-fbdc-4ec9-b656-43b3dfa8402c`.

- Retained test context (2026-10-11T07:51:30.389Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submission_system_snapshots; references `9fedf370-eaa3-4982-8272-fe3e85f2938e`, `aa17b3c2-c216-4a8a-b222-64acfb10d576`, `f77a4740-4af8-47fa-afcf-dd6bc992acb0`, `15d4edfc-fbdc-4ec9-b656-43b3dfa8402c`.

- Retained test context (2026-10-11T07:51:30.389Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_section_states; references `9fedf370-eaa3-4982-8272-fe3e85f2938e`, `aa17b3c2-c216-4a8a-b222-64acfb10d576`, `f77a4740-4af8-47fa-afcf-dd6bc992acb0`, `15d4edfc-fbdc-4ec9-b656-43b3dfa8402c`.

- Retained test context (2026-10-11T07:51:30.390Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submission_assignments; references `9fedf370-eaa3-4982-8272-fe3e85f2938e`, `aa17b3c2-c216-4a8a-b222-64acfb10d576`, `f77a4740-4af8-47fa-afcf-dd6bc992acb0`, `15d4edfc-fbdc-4ec9-b656-43b3dfa8402c`.

- Retained test context (2026-10-11T07:51:30.390Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submissions; references `9fedf370-eaa3-4982-8272-fe3e85f2938e`, `aa17b3c2-c216-4a8a-b222-64acfb10d576`, `f77a4740-4af8-47fa-afcf-dd6bc992acb0`, `15d4edfc-fbdc-4ec9-b656-43b3dfa8402c`.

- Retained test context (2026-10-11T07:51:30.391Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_signature_attachments; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:30.391Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_questions; references `35ad0cb3-3197-4357-89ae-bab49958629e`.

- Retained test context (2026-10-11T07:51:30.391Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_sections; references `80f510b2-5c00-40a3-9fb2-11c03d4cae7d`.

- Retained test context (2026-10-11T07:51:30.392Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_form_parts; references `8b8fe8b9-8531-4f11-90c4-c811cdb5c2a7`.

- Retained test context (2026-10-11T07:51:30.392Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_form_versions_v2; references `d5dbe6c3-484a-47ca-be1b-6571d34ca86f`.

- Retained test context (2026-10-11T07:51:30.393Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_forms_v2; references `6499adca-d6b9-4c38-92b5-34ba7299e94c`.

- Retained test context (2026-10-11T07:51:30.393Z): tests/integration/api/company-form-submission-void-races.test.ts; target crew_assignments; references `9d4b18cc-c248-435c-8cdd-a2c2a5b9a3d6`, `c4817e3e-53d9-4d84-9307-859543d011d8`, `d042f33e-6e87-4146-9a2d-71298171c56e`, `36d4275c-8b20-45c0-b156-92fcdff1bdc0`.

- Retained test context (2026-10-11T07:51:30.393Z): tests/integration/api/company-form-submission-void-races.test.ts; target crew_members_v2; references `e10c3dd8-b6d0-4dd9-aa8c-4fa1284354fc`.

- Retained test context (2026-10-11T07:51:30.395Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_resource_action_grants; references `46d65820-f181-4312-b760-afed5b51f76f`, `793c742d-e6d0-4bc0-8dfb-eab9ac3baada`.

- Retained test context (2026-10-11T07:51:30.395Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_roleaccess_ac; references `46d65820-f181-4312-b760-afed5b51f76f`.

- Retained test context (2026-10-11T07:51:30.395Z): tests/integration/api/company-form-submission-void-races.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:30.396Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_rolemaster_ac; references `46d65820-f181-4312-b760-afed5b51f76f`, `793c742d-e6d0-4bc0-8dfb-eab9ac3baada`.

- Retained test context (2026-10-11T07:51:30.396Z): tests/integration/api/company-form-submission-void-races.test.ts; target master_vessels; references `583c7075-1dfb-4b57-bc0c-53cf3dae45df`.

- Retained test context (2026-10-11T07:51:35.617Z): tests/integration/api/company-form-submission-races.test.ts; target frm_answers; references `af9be429-5c76-45d7-9aa5-a237b7bcbf5d`, `bece06c3-6ebf-466f-a9d6-561ec9477a0d`, `18bcf5d3-7f6f-45ca-a6d7-fddaab1da0a3`.

- Retained test context (2026-10-11T07:51:35.617Z): tests/integration/api/company-form-submission-races.test.ts; target frm_section_states; references `af9be429-5c76-45d7-9aa5-a237b7bcbf5d`, `bece06c3-6ebf-466f-a9d6-561ec9477a0d`, `18bcf5d3-7f6f-45ca-a6d7-fddaab1da0a3`.

- Retained test context (2026-10-11T07:51:35.618Z): tests/integration/api/company-form-submission-races.test.ts; target frm_company_submission_assignments; references `af9be429-5c76-45d7-9aa5-a237b7bcbf5d`, `bece06c3-6ebf-466f-a9d6-561ec9477a0d`, `18bcf5d3-7f6f-45ca-a6d7-fddaab1da0a3`.

- Retained test context (2026-10-11T07:51:35.619Z): tests/integration/api/company-form-submission-races.test.ts; target frm_company_submissions; references `af9be429-5c76-45d7-9aa5-a237b7bcbf5d`, `bece06c3-6ebf-466f-a9d6-561ec9477a0d`, `18bcf5d3-7f6f-45ca-a6d7-fddaab1da0a3`.

- Retained test context (2026-10-11T07:51:35.619Z): tests/integration/api/company-form-submission-races.test.ts; target crew_assignments; references `58d6050b-f8e9-44da-b80d-2e94cefe8e2e`, `aaeda1e9-2fc3-4bbf-b511-8a07c9cfb445`, `b4e54f30-272e-4517-90dc-e8707052fc4a`, `798d3433-4d16-4228-aaae-b676f8542bf2`, `abfbc900-3eb1-4dae-9fa4-eacccd4805ca`.

- Retained test context (2026-10-11T07:51:35.620Z): tests/integration/api/company-form-submission-races.test.ts; target frm_questions; references `6c73f17e-fd2c-4ef7-a795-7d509bbb0bd7`.

- Retained test context (2026-10-11T07:51:35.620Z): tests/integration/api/company-form-submission-races.test.ts; target frm_sections; references `5e6723cb-7564-49fb-9406-c9b8bccf7b0c`.

- Retained test context (2026-10-11T07:51:35.620Z): tests/integration/api/company-form-submission-races.test.ts; target frm_form_parts; references `fcb3e617-00c0-4675-afa0-87ec5061590a`.

- Retained test context (2026-10-11T07:51:35.621Z): tests/integration/api/company-form-submission-races.test.ts; target adm_form_versions_v2; references `2e917216-b11b-412b-a009-25bddf016604`.

- Retained test context (2026-10-11T07:51:35.621Z): tests/integration/api/company-form-submission-races.test.ts; target adm_forms_v2; references `18f5b577-deb9-47f9-ac72-c5b4c9cdce92`.

- Retained test context (2026-10-11T07:51:35.621Z): tests/integration/api/company-form-submission-races.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:35.623Z): tests/integration/api/company-form-submission-races.test.ts; target adm_resource_action_grants; references `d1fdda35-7b84-420c-a1ae-2b2bf8dbd84d`.

- Retained test context (2026-10-11T07:51:35.623Z): tests/integration/api/company-form-submission-races.test.ts; target adm_roleaccess_ac; references `d1fdda35-7b84-420c-a1ae-2b2bf8dbd84d`.

- Retained test context (2026-10-11T07:51:35.624Z): tests/integration/api/company-form-submission-races.test.ts; target adm_rolemaster_ac; references `d1fdda35-7b84-420c-a1ae-2b2bf8dbd84d`.

- Retained test context (2026-10-11T07:51:39.964Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_section_signatures; references `dc273422-f9f7-4f70-b10f-d37462e57e9f`.

- Retained test context (2026-10-11T07:51:39.965Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_signature_attachments; references `afb69341-4a53-471c-89d3-87da50ff8923`, `e00674a5-5f8d-4dd7-bfa6-34a9bff62d04`.

- Retained test context (2026-10-11T07:51:39.966Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_answers; references `dc273422-f9f7-4f70-b10f-d37462e57e9f`.

- Retained test context (2026-10-11T07:51:39.967Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_section_states; references `dc273422-f9f7-4f70-b10f-d37462e57e9f`.

- Retained test context (2026-10-11T07:51:39.968Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_debriefing_submissions; references `dc273422-f9f7-4f70-b10f-d37462e57e9f`.

- Retained test context (2026-10-11T07:51:39.968Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_questions; references `1f0bdb1c-b7e4-45c3-ae42-625687715871`.

- Retained test context (2026-10-11T07:51:39.969Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_sections; references `63af52c7-690e-4c1d-90f1-db8257ffd943`, `30e4fc1a-14b3-43ca-a97d-916e340cb7e2`, `f17eca13-b6d9-4350-880e-29f7b23b48f6`.

- Retained test context (2026-10-11T07:51:39.969Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_form_parts; references `165c2775-00f2-455e-8af4-9828b13585d9`.

- Retained test context (2026-10-11T07:51:39.970Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_form_versions_v2; references `9a0ef69f-55a3-4826-bdb4-0519ec301d6b`, `451ac142-5677-4072-ac7a-eba403bfb405`.

- Retained test context (2026-10-11T07:51:39.971Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_rank_groups_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:39.972Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_forms_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T07:51:39.972Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_debriefings; references `8d98795d-0a1c-47f0-816d-e6d8f7180c2f`, `80ae50aa-9373-4c24-9d21-e6b7e9ffe613`, `ebde8c54-b9b8-41ef-a35e-6ba4a736606f`.

- Retained test context (2026-10-11T07:51:39.973Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_members_v2; references `d452927c-2549-4425-bdfd-d28dbe1c5360`.

- Retained test context (2026-10-11T07:51:39.973Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_vessels; references `c9dee626-66a9-4f61-bec9-2f5512c98f27`.

- Retained test context (2026-10-11T07:51:39.974Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_vessel_types; references `3997ca40-c849-40ec-b950-f9ec0109e64a`.

- Retained test context (2026-10-11T07:51:39.974Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:00:32.884Z): dimension context cf_dimensions_059eff74; target registered_fixture_context; references `aefc1115-ef29-469b-b88e-4fc506e97e7e`, `0706ba6e-cbcd-4f93-b3fe-1a85712b7b0c`, `eca5de4f-6a57-4c42-8792-19186bc0d20d`, `e581fd15-3aae-4aa7-88ac-813a8806f989`.

- Retained test context (2026-10-11T08:02:00.501Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:00.502Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:00.503Z): tests/integration/api/company-form-signing-and-completion.test.ts; target cleanup context; references `56165c46-587f-4e55-8d76-c38881fff7cb`, `ec5374ca-9c53-40dc-bcb1-02b51166e60b`, `6f24abaf-9349-4e1e-946e-04a5a8e77303`, `5b558243-1434-4abe-a69e-177e4287bb5a`, `51320f68-3552-42c5-9a30-66c6a96a5af1`.

- Retained test context (2026-10-11T08:02:00.503Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_signatures; references `56165c46-587f-4e55-8d76-c38881fff7cb`, `ec5374ca-9c53-40dc-bcb1-02b51166e60b`, `6f24abaf-9349-4e1e-946e-04a5a8e77303`, `5b558243-1434-4abe-a69e-177e4287bb5a`, `51320f68-3552-42c5-9a30-66c6a96a5af1`.

- Retained test context (2026-10-11T08:02:00.503Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_signature_attachments; references `b4a20a27-cf77-40cb-a497-a5ddd9fd90a9`, `f7fad7fd-8f00-49d4-a5c8-474146e94212`, `00cb049a-4cd6-4ce9-9712-1a197734b7b4`, `806b9fad-a437-43d7-adae-959c5bec1d6a`, `152103d5-5f41-45dd-b32b-f1dc742a8183`, `e0642eec-d038-4674-bf77-9324d3b9be78`.

- Retained test context (2026-10-11T08:02:00.503Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references `56165c46-587f-4e55-8d76-c38881fff7cb`, `ec5374ca-9c53-40dc-bcb1-02b51166e60b`, `6f24abaf-9349-4e1e-946e-04a5a8e77303`, `5b558243-1434-4abe-a69e-177e4287bb5a`, `51320f68-3552-42c5-9a30-66c6a96a5af1`.

- Retained test context (2026-10-11T08:02:00.504Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_answers; references `56165c46-587f-4e55-8d76-c38881fff7cb`, `ec5374ca-9c53-40dc-bcb1-02b51166e60b`, `6f24abaf-9349-4e1e-946e-04a5a8e77303`, `5b558243-1434-4abe-a69e-177e4287bb5a`, `51320f68-3552-42c5-9a30-66c6a96a5af1`.

- Retained test context (2026-10-11T08:02:00.504Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_states; references `56165c46-587f-4e55-8d76-c38881fff7cb`, `ec5374ca-9c53-40dc-bcb1-02b51166e60b`, `6f24abaf-9349-4e1e-946e-04a5a8e77303`, `5b558243-1434-4abe-a69e-177e4287bb5a`, `51320f68-3552-42c5-9a30-66c6a96a5af1`.

- Retained test context (2026-10-11T08:02:00.504Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_assignments; references `56165c46-587f-4e55-8d76-c38881fff7cb`, `ec5374ca-9c53-40dc-bcb1-02b51166e60b`, `6f24abaf-9349-4e1e-946e-04a5a8e77303`, `5b558243-1434-4abe-a69e-177e4287bb5a`, `51320f68-3552-42c5-9a30-66c6a96a5af1`.

- Retained test context (2026-10-11T08:02:00.505Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references `56165c46-587f-4e55-8d76-c38881fff7cb`, `ec5374ca-9c53-40dc-bcb1-02b51166e60b`, `6f24abaf-9349-4e1e-946e-04a5a8e77303`, `5b558243-1434-4abe-a69e-177e4287bb5a`, `51320f68-3552-42c5-9a30-66c6a96a5af1`.

- Retained test context (2026-10-11T08:02:00.505Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_questions; references `0a1884b7-811c-49c7-b5f0-69acfe7b2e6d`, `1ec4e819-9ced-40f7-8597-2298ff72679e`, `2ea16639-61fa-4e1e-ab5b-191da31b4b2f`, `ab3fde16-c047-453b-ada5-5af5d91aeddc`.

- Retained test context (2026-10-11T08:02:00.505Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_sections; references `0a1884b7-811c-49c7-b5f0-69acfe7b2e6d`, `1ec4e819-9ced-40f7-8597-2298ff72679e`, `2ea16639-61fa-4e1e-ab5b-191da31b4b2f`, `ab3fde16-c047-453b-ada5-5af5d91aeddc`.

- Retained test context (2026-10-11T08:02:00.505Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_form_parts; references `0a1884b7-811c-49c7-b5f0-69acfe7b2e6d`, `1ec4e819-9ced-40f7-8597-2298ff72679e`, `2ea16639-61fa-4e1e-ab5b-191da31b4b2f`, `ab3fde16-c047-453b-ada5-5af5d91aeddc`.

- Retained test context (2026-10-11T08:02:00.506Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_form_versions_v2; references `0a1884b7-811c-49c7-b5f0-69acfe7b2e6d`, `1ec4e819-9ced-40f7-8597-2298ff72679e`, `2ea16639-61fa-4e1e-ab5b-191da31b4b2f`, `ab3fde16-c047-453b-ada5-5af5d91aeddc`.

- Retained test context (2026-10-11T08:02:00.506Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_forms_v2; references `c329025d-a44d-424d-938e-cd1181de15f1`, `d177ef16-c914-4e6c-931c-53a429665a9d`.

- Retained test context (2026-10-11T08:02:00.506Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_assignments; references `ac9eca19-50cd-4a58-abb3-e277f4872e92`, `f9ea8f99-2190-48c6-8349-0b85c6f2f71d`, `45c73433-a020-4bc5-819f-f6af7c69fc70`, `ea7daef3-ae51-4e31-9baf-58740ad96186`.

- Retained test context (2026-10-11T08:02:00.506Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_members_v2; references `d67c0a4d-33ba-43df-8b9d-e763d3fe129e`.

- Retained test context (2026-10-11T08:02:00.506Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `069d1924-ef38-4717-a691-ad949560b5c1`.

- Retained test context (2026-10-11T08:02:00.507Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `016465f9-92ee-4824-a5b5-36e6ffdcf9db`.

- Retained test context (2026-10-11T08:02:00.507Z): tests/integration/api/company-form-signing-and-completion.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:00.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_resource_action_grants; references `1819ed68-b49f-4325-b365-674003dee070`, `5db2c471-3132-494f-8968-2fc3818d64ba`, `18a8b75a-ccc2-4c0f-98f2-ec783a90fc9d`, `7fc5e2d4-4749-4666-bc3e-7ad59561f33c`.

- Retained test context (2026-10-11T08:02:00.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_roleaccess_ac; references `1819ed68-b49f-4325-b365-674003dee070`, `5db2c471-3132-494f-8968-2fc3818d64ba`, `18a8b75a-ccc2-4c0f-98f2-ec783a90fc9d`, `7fc5e2d4-4749-4666-bc3e-7ad59561f33c`.

- Retained test context (2026-10-11T08:02:00.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:00.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_rolemaster_ac; references `1819ed68-b49f-4325-b365-674003dee070`, `5db2c471-3132-494f-8968-2fc3818d64ba`, `18a8b75a-ccc2-4c0f-98f2-ec783a90fc9d`, `7fc5e2d4-4749-4666-bc3e-7ad59561f33c`.

- Retained test context (2026-10-11T08:02:03.773Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `5cb65b77-9c90-4771-b77b-2b099a66c187`.

- Retained test context (2026-10-11T08:02:03.775Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `5cb65b77-9c90-4771-b77b-2b099a66c187`.

- Retained test context (2026-10-11T08:02:03.776Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `5cb65b77-9c90-4771-b77b-2b099a66c187`.

- Retained test context (2026-10-11T08:02:03.777Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `5cb65b77-9c90-4771-b77b-2b099a66c187`.

- Retained test context (2026-10-11T08:02:03.777Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `5cb65b77-9c90-4771-b77b-2b099a66c187`.

- Retained test context (2026-10-11T08:02:03.778Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `6e2bfdfc-b248-49ee-9b41-2909c07b3ac9`.

- Retained test context (2026-10-11T08:02:03.778Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `6e2bfdfc-b248-49ee-9b41-2909c07b3ac9`.

- Retained test context (2026-10-11T08:02:03.779Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `6e2bfdfc-b248-49ee-9b41-2909c07b3ac9`.

- Retained test context (2026-10-11T08:02:03.780Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `6e2bfdfc-b248-49ee-9b41-2909c07b3ac9`.

- Retained test context (2026-10-11T08:02:03.780Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `6e2bfdfc-b248-49ee-9b41-2909c07b3ac9`.

- Retained test context (2026-10-11T08:02:03.781Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `ac4c8fce-b502-45af-91f3-21a02568136d`.

- Retained test context (2026-10-11T08:02:03.781Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `ac4c8fce-b502-45af-91f3-21a02568136d`.

- Retained test context (2026-10-11T08:02:03.782Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `ac4c8fce-b502-45af-91f3-21a02568136d`.

- Retained test context (2026-10-11T08:02:03.782Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `ac4c8fce-b502-45af-91f3-21a02568136d`.

- Retained test context (2026-10-11T08:02:03.782Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `ac4c8fce-b502-45af-91f3-21a02568136d`.

- Retained test context (2026-10-11T08:02:03.783Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `e76bbcac-df61-4c95-a1de-a097dfc491da`.

- Retained test context (2026-10-11T08:02:03.783Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `e76bbcac-df61-4c95-a1de-a097dfc491da`.

- Retained test context (2026-10-11T08:02:03.784Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `e76bbcac-df61-4c95-a1de-a097dfc491da`.

- Retained test context (2026-10-11T08:02:03.784Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `e76bbcac-df61-4c95-a1de-a097dfc491da`.

- Retained test context (2026-10-11T08:02:03.785Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `e76bbcac-df61-4c95-a1de-a097dfc491da`.

- Retained test context (2026-10-11T08:02:03.785Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `e18f756d-960d-4588-b5a0-3ea34798c5c7`.

- Retained test context (2026-10-11T08:02:03.785Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `e18f756d-960d-4588-b5a0-3ea34798c5c7`.

- Retained test context (2026-10-11T08:02:03.786Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `e18f756d-960d-4588-b5a0-3ea34798c5c7`.

- Retained test context (2026-10-11T08:02:03.786Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `e18f756d-960d-4588-b5a0-3ea34798c5c7`.

- Retained test context (2026-10-11T08:02:03.787Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `e18f756d-960d-4588-b5a0-3ea34798c5c7`.

- Retained test context (2026-10-11T08:02:03.787Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `b5354cc4-2e84-4331-8e64-54711fb2c5e9`.

- Retained test context (2026-10-11T08:02:03.788Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `b5354cc4-2e84-4331-8e64-54711fb2c5e9`.

- Retained test context (2026-10-11T08:02:03.788Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `b5354cc4-2e84-4331-8e64-54711fb2c5e9`.

- Retained test context (2026-10-11T08:02:03.788Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `b5354cc4-2e84-4331-8e64-54711fb2c5e9`.

- Retained test context (2026-10-11T08:02:03.789Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `b5354cc4-2e84-4331-8e64-54711fb2c5e9`.

- Retained test context (2026-10-11T08:02:03.789Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `27cbb0c2-fc4e-4397-b88f-a1c9a7501e5d`.

- Retained test context (2026-10-11T08:02:03.789Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `27cbb0c2-fc4e-4397-b88f-a1c9a7501e5d`.

- Retained test context (2026-10-11T08:02:03.790Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `27cbb0c2-fc4e-4397-b88f-a1c9a7501e5d`.

- Retained test context (2026-10-11T08:02:03.790Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `27cbb0c2-fc4e-4397-b88f-a1c9a7501e5d`.

- Retained test context (2026-10-11T08:02:03.790Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `27cbb0c2-fc4e-4397-b88f-a1c9a7501e5d`.

- Retained test context (2026-10-11T08:02:03.791Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `dee2e14b-69a9-4e71-bd18-685c4ba591d8`.

- Retained test context (2026-10-11T08:02:03.791Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `dee2e14b-69a9-4e71-bd18-685c4ba591d8`.

- Retained test context (2026-10-11T08:02:03.791Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `dee2e14b-69a9-4e71-bd18-685c4ba591d8`.

- Retained test context (2026-10-11T08:02:03.792Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `dee2e14b-69a9-4e71-bd18-685c4ba591d8`.

- Retained test context (2026-10-11T08:02:03.792Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `dee2e14b-69a9-4e71-bd18-685c4ba591d8`.

- Retained test context (2026-10-11T08:02:03.792Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `babdd0d2-d890-431d-8654-f670fce01c60`.

- Retained test context (2026-10-11T08:02:03.793Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `babdd0d2-d890-431d-8654-f670fce01c60`.

- Retained test context (2026-10-11T08:02:03.793Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `babdd0d2-d890-431d-8654-f670fce01c60`.

- Retained test context (2026-10-11T08:02:03.794Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `babdd0d2-d890-431d-8654-f670fce01c60`.

- Retained test context (2026-10-11T08:02:03.794Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `babdd0d2-d890-431d-8654-f670fce01c60`.

- Retained test context (2026-10-11T08:02:03.794Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `03d810b0-578f-498e-99db-a483c24d0eea`.

- Retained test context (2026-10-11T08:02:03.795Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `03d810b0-578f-498e-99db-a483c24d0eea`.

- Retained test context (2026-10-11T08:02:03.795Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `03d810b0-578f-498e-99db-a483c24d0eea`.

- Retained test context (2026-10-11T08:02:03.795Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `03d810b0-578f-498e-99db-a483c24d0eea`.

- Retained test context (2026-10-11T08:02:03.796Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `03d810b0-578f-498e-99db-a483c24d0eea`.

- Retained test context (2026-10-11T08:02:04.927Z): dimension release definition; target registered_fixture_context; references `c7bcdcf4-c8cc-4d79-9cf1-ec49d6a558ee`, `0b837368-ab44-4896-8e01-19d90e1cf467`.

- Retained test context (2026-10-11T08:02:05.008Z): dimension release draft content; target registered_fixture_context; references `75614dd5-4b64-4b37-b034-1753acb625a8`, `625dc837-342d-40fa-9fc8-29db2448b1bc`, `32fff443-8e71-4d40-b585-a934a14bf1d4`, `f7e384be-6967-407b-a8c9-912f8c30b945`.

- Retained test context (2026-10-11T08:02:05.058Z): dimension release condition data; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.136Z): dimension context cf_dimensions_e35ef7a3; target registered_fixture_context; references `0b8a97f1-db8a-413d-b6f5-065b8e759ed9`, `f94baaad-a5c7-45e8-90c9-b455dad3dd28`, `bd21e895-5b6d-4697-bca3-73c59967907a`, `7908b748-c9f4-4dde-a5d8-3eb45bbd6e73`.

- Retained test context (2026-10-11T08:02:06.416Z): cf_dimensions_e35ef7a3.adm_available_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.439Z): cf_dimensions_e35ef7a3.adm_company_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.459Z): cf_dimensions_e35ef7a3.master_vessels canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.487Z): cf_dimensions_e35ef7a3.master_vessel_types canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.513Z): cf_dimensions_e35ef7a3.master_nationalities canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.532Z): cf_dimensions_e35ef7a3.master_manning_agents canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.554Z): cf_dimensions_e35ef7a3.master_crew_pools canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.574Z): cf_dimensions_e35ef7a3.master_fleet_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:02:06.588Z): cf_dimensions_e35ef7a3.master_additional_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:04.655Z): dimension context cf_dimensions_46d8b717; target registered_fixture_context; references `c0e7596b-34bb-476c-848c-e34b35ac09d4`, `0ec14c46-6697-4f73-a2f1-def0a41afbd1`, `b1d3959b-e18b-4035-8f48-c3c7e3375ae8`, `0cc2e0fe-2668-461b-b553-ce2102bd5c52`.

- Retained test context (2026-10-11T08:03:04.971Z): cf_dimensions_46d8b717.adm_available_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:04.987Z): cf_dimensions_46d8b717.adm_company_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:05.007Z): cf_dimensions_46d8b717.master_vessels canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:05.021Z): cf_dimensions_46d8b717.master_vessel_types canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:05.039Z): cf_dimensions_46d8b717.master_nationalities canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:05.053Z): cf_dimensions_46d8b717.master_manning_agents canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:05.067Z): cf_dimensions_46d8b717.master_crew_pools canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:05.083Z): cf_dimensions_46d8b717.master_fleet_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:05.096Z): cf_dimensions_46d8b717.master_additional_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:05.120Z): canonical master copies cf_dimensions_46d8b717; target registered_fixture_context; references `55d4c4b0-8e9c-479c-a9f0-9f3fbe95e0e5`, `743feb08-841a-11ed-aa7c-7003bca91a86`.

- Retained test context (2026-10-11T08:03:06.654Z): dimension release definition; target registered_fixture_context; references `2192cd1a-50a6-4e50-bd3a-b8c73fda6fff`, `4b15e686-5dd4-4be1-9247-61f274c1ac0b`.

- Retained test context (2026-10-11T08:03:06.752Z): dimension release draft content; target registered_fixture_context; references `f8437fb0-301f-4dac-8319-aa3e2982eed5`, `92a5a6a5-4c02-4f59-aaa3-eafa85dc84c4`, `7b0c143b-bf11-4945-ac4d-a147e21b747d`, `ff60fdc0-95dc-483d-9962-016e4e43c133`.

- Retained test context (2026-10-11T08:03:06.807Z): dimension release condition data; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:03:06.939Z): dimension release copied draft; target registered_fixture_context; references `59e78de3-39a1-4010-8490-e474e1b13ff9`.

- Retained test context (2026-10-11T08:04:17.527Z): tests/unit/company-form-planning-lock-order.test.ts; target "cf_lock_a562c8a31a8f46dc9cd84d04d0cb8a41"; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:24.988Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `d6e853e7-2f14-448d-af97-a2987ed64310`.

- Retained test context (2026-10-11T08:04:24.990Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `d6e853e7-2f14-448d-af97-a2987ed64310`.

- Retained test context (2026-10-11T08:04:24.990Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `d6e853e7-2f14-448d-af97-a2987ed64310`.

- Retained test context (2026-10-11T08:04:24.991Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `d6e853e7-2f14-448d-af97-a2987ed64310`.

- Retained test context (2026-10-11T08:04:24.991Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `d6e853e7-2f14-448d-af97-a2987ed64310`.

- Retained test context (2026-10-11T08:04:24.992Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `9f35cc09-0e89-4ddf-8b5e-01ebd1c086cc`.

- Retained test context (2026-10-11T08:04:24.992Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `9f35cc09-0e89-4ddf-8b5e-01ebd1c086cc`.

- Retained test context (2026-10-11T08:04:24.992Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `9f35cc09-0e89-4ddf-8b5e-01ebd1c086cc`.

- Retained test context (2026-10-11T08:04:24.993Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `9f35cc09-0e89-4ddf-8b5e-01ebd1c086cc`.

- Retained test context (2026-10-11T08:04:24.993Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `9f35cc09-0e89-4ddf-8b5e-01ebd1c086cc`.

- Retained test context (2026-10-11T08:04:24.994Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `56716e67-1b78-4eb5-b4bd-4a6e8da2f479`.

- Retained test context (2026-10-11T08:04:24.994Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `56716e67-1b78-4eb5-b4bd-4a6e8da2f479`.

- Retained test context (2026-10-11T08:04:24.994Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `56716e67-1b78-4eb5-b4bd-4a6e8da2f479`.

- Retained test context (2026-10-11T08:04:24.995Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `56716e67-1b78-4eb5-b4bd-4a6e8da2f479`.

- Retained test context (2026-10-11T08:04:24.995Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `56716e67-1b78-4eb5-b4bd-4a6e8da2f479`.

- Retained test context (2026-10-11T08:04:24.995Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `1f35fcf5-4b9e-4a55-8ba8-a9578b7eb768`.

- Retained test context (2026-10-11T08:04:24.995Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `1f35fcf5-4b9e-4a55-8ba8-a9578b7eb768`.

- Retained test context (2026-10-11T08:04:24.996Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `1f35fcf5-4b9e-4a55-8ba8-a9578b7eb768`.

- Retained test context (2026-10-11T08:04:24.996Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `1f35fcf5-4b9e-4a55-8ba8-a9578b7eb768`.

- Retained test context (2026-10-11T08:04:24.996Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `1f35fcf5-4b9e-4a55-8ba8-a9578b7eb768`.

- Retained test context (2026-10-11T08:04:24.997Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `4c0b2503-ba84-4494-a773-067f19a43874`.

- Retained test context (2026-10-11T08:04:24.997Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `4c0b2503-ba84-4494-a773-067f19a43874`.

- Retained test context (2026-10-11T08:04:24.997Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `4c0b2503-ba84-4494-a773-067f19a43874`.

- Retained test context (2026-10-11T08:04:24.998Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `4c0b2503-ba84-4494-a773-067f19a43874`.

- Retained test context (2026-10-11T08:04:24.998Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `4c0b2503-ba84-4494-a773-067f19a43874`.

- Retained test context (2026-10-11T08:04:24.999Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `4ca99cc4-0351-4d79-b4cd-b04041e43955`.

- Retained test context (2026-10-11T08:04:24.999Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `4ca99cc4-0351-4d79-b4cd-b04041e43955`.

- Retained test context (2026-10-11T08:04:24.999Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `4ca99cc4-0351-4d79-b4cd-b04041e43955`.

- Retained test context (2026-10-11T08:04:25.000Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `4ca99cc4-0351-4d79-b4cd-b04041e43955`.

- Retained test context (2026-10-11T08:04:25.000Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `4ca99cc4-0351-4d79-b4cd-b04041e43955`.

- Retained test context (2026-10-11T08:04:25.000Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `ca6b5f58-e3d5-48b7-9ea4-746edb2905cb`.

- Retained test context (2026-10-11T08:04:25.000Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `ca6b5f58-e3d5-48b7-9ea4-746edb2905cb`.

- Retained test context (2026-10-11T08:04:25.001Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `ca6b5f58-e3d5-48b7-9ea4-746edb2905cb`.

- Retained test context (2026-10-11T08:04:25.002Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `ca6b5f58-e3d5-48b7-9ea4-746edb2905cb`.

- Retained test context (2026-10-11T08:04:25.002Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `ca6b5f58-e3d5-48b7-9ea4-746edb2905cb`.

- Retained test context (2026-10-11T08:04:25.002Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `f2420bda-41fa-47b4-b618-0f5333628bb5`.

- Retained test context (2026-10-11T08:04:25.005Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `f2420bda-41fa-47b4-b618-0f5333628bb5`.

- Retained test context (2026-10-11T08:04:25.005Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `f2420bda-41fa-47b4-b618-0f5333628bb5`.

- Retained test context (2026-10-11T08:04:25.005Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `f2420bda-41fa-47b4-b618-0f5333628bb5`.

- Retained test context (2026-10-11T08:04:25.005Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `f2420bda-41fa-47b4-b618-0f5333628bb5`.

- Retained test context (2026-10-11T08:04:25.006Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `eae36e4e-de3a-41b3-924c-0d33df90b1b4`.

- Retained test context (2026-10-11T08:04:25.006Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `eae36e4e-de3a-41b3-924c-0d33df90b1b4`.

- Retained test context (2026-10-11T08:04:25.006Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `eae36e4e-de3a-41b3-924c-0d33df90b1b4`.

- Retained test context (2026-10-11T08:04:25.009Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `eae36e4e-de3a-41b3-924c-0d33df90b1b4`.

- Retained test context (2026-10-11T08:04:25.009Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `eae36e4e-de3a-41b3-924c-0d33df90b1b4`.

- Retained test context (2026-10-11T08:04:25.009Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `fda38a31-73be-4d09-bf0f-cd2c725457eb`.

- Retained test context (2026-10-11T08:04:25.009Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `fda38a31-73be-4d09-bf0f-cd2c725457eb`.

- Retained test context (2026-10-11T08:04:25.010Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `fda38a31-73be-4d09-bf0f-cd2c725457eb`.

- Retained test context (2026-10-11T08:04:25.010Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `fda38a31-73be-4d09-bf0f-cd2c725457eb`.

- Retained test context (2026-10-11T08:04:25.010Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `fda38a31-73be-4d09-bf0f-cd2c725457eb`.

- Retained test context (2026-10-11T08:04:32.505Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:32.506Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:32.507Z): tests/integration/api/company-form-signing-and-completion.test.ts; target cleanup context; references `f3be9c7d-2083-4448-8955-0a4d762474ea`, `006089ec-ff75-4154-9b02-b9389ba46e89`, `e725da75-32be-461a-ae49-f926a3ef30c1`, `0e3197d4-bb1a-46d4-82c8-958a9758598b`, `e5a05b81-09c4-4295-9bc8-4b91fea39539`.

- Retained test context (2026-10-11T08:04:32.507Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_signatures; references `f3be9c7d-2083-4448-8955-0a4d762474ea`, `006089ec-ff75-4154-9b02-b9389ba46e89`, `e725da75-32be-461a-ae49-f926a3ef30c1`, `0e3197d4-bb1a-46d4-82c8-958a9758598b`, `e5a05b81-09c4-4295-9bc8-4b91fea39539`.

- Retained test context (2026-10-11T08:04:32.508Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_signature_attachments; references `d7ad1e17-6ae3-4657-ae88-7e3d8e6ad125`, `be9acc81-ded1-4614-82ce-014792d6bcce`, `af7c04f4-2fdd-4b27-9a98-f466fd1ca366`, `0e7eef01-bed5-4346-9a94-4b902ccb6f1e`, `ba1a50b7-f8b8-4433-b0f5-ca7a3dc0cd85`, `8fa1f518-ef23-4bdf-9591-0752cc764fd0`.

- Retained test context (2026-10-11T08:04:32.508Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references `f3be9c7d-2083-4448-8955-0a4d762474ea`, `006089ec-ff75-4154-9b02-b9389ba46e89`, `e725da75-32be-461a-ae49-f926a3ef30c1`, `0e3197d4-bb1a-46d4-82c8-958a9758598b`, `e5a05b81-09c4-4295-9bc8-4b91fea39539`.

- Retained test context (2026-10-11T08:04:32.508Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_answers; references `f3be9c7d-2083-4448-8955-0a4d762474ea`, `006089ec-ff75-4154-9b02-b9389ba46e89`, `e725da75-32be-461a-ae49-f926a3ef30c1`, `0e3197d4-bb1a-46d4-82c8-958a9758598b`, `e5a05b81-09c4-4295-9bc8-4b91fea39539`.

- Retained test context (2026-10-11T08:04:32.508Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_states; references `f3be9c7d-2083-4448-8955-0a4d762474ea`, `006089ec-ff75-4154-9b02-b9389ba46e89`, `e725da75-32be-461a-ae49-f926a3ef30c1`, `0e3197d4-bb1a-46d4-82c8-958a9758598b`, `e5a05b81-09c4-4295-9bc8-4b91fea39539`.

- Retained test context (2026-10-11T08:04:32.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_assignments; references `f3be9c7d-2083-4448-8955-0a4d762474ea`, `006089ec-ff75-4154-9b02-b9389ba46e89`, `e725da75-32be-461a-ae49-f926a3ef30c1`, `0e3197d4-bb1a-46d4-82c8-958a9758598b`, `e5a05b81-09c4-4295-9bc8-4b91fea39539`.

- Retained test context (2026-10-11T08:04:32.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references `f3be9c7d-2083-4448-8955-0a4d762474ea`, `006089ec-ff75-4154-9b02-b9389ba46e89`, `e725da75-32be-461a-ae49-f926a3ef30c1`, `0e3197d4-bb1a-46d4-82c8-958a9758598b`, `e5a05b81-09c4-4295-9bc8-4b91fea39539`.

- Retained test context (2026-10-11T08:04:32.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_questions; references `656f8ef7-1c96-4c53-ab0d-92b030ef4bd1`, `e7923997-205a-43b5-8af4-7a7ba8e8ce7d`, `0805ea47-ea7d-48f6-aa57-68aad84bd908`, `1631d00f-6c32-4936-bccc-e41dc3845a07`.

- Retained test context (2026-10-11T08:04:32.510Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_sections; references `656f8ef7-1c96-4c53-ab0d-92b030ef4bd1`, `e7923997-205a-43b5-8af4-7a7ba8e8ce7d`, `0805ea47-ea7d-48f6-aa57-68aad84bd908`, `1631d00f-6c32-4936-bccc-e41dc3845a07`.

- Retained test context (2026-10-11T08:04:32.510Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_form_parts; references `656f8ef7-1c96-4c53-ab0d-92b030ef4bd1`, `e7923997-205a-43b5-8af4-7a7ba8e8ce7d`, `0805ea47-ea7d-48f6-aa57-68aad84bd908`, `1631d00f-6c32-4936-bccc-e41dc3845a07`.

- Retained test context (2026-10-11T08:04:32.510Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_form_versions_v2; references `656f8ef7-1c96-4c53-ab0d-92b030ef4bd1`, `e7923997-205a-43b5-8af4-7a7ba8e8ce7d`, `0805ea47-ea7d-48f6-aa57-68aad84bd908`, `1631d00f-6c32-4936-bccc-e41dc3845a07`.

- Retained test context (2026-10-11T08:04:32.510Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_forms_v2; references `d44c5c2c-ef63-47e3-9680-8ce84ad664d6`, `c02c4dcf-0664-4148-8011-45ad4c8e1af9`.

- Retained test context (2026-10-11T08:04:32.510Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_assignments; references `eead2a5a-e3f6-43d2-afdb-f3cc64f818ea`, `bb7834cd-d586-473e-a3a9-9aaf371d516a`, `309a0cbf-2c13-4c09-8dec-5f454a289a87`, `03d7725d-db91-479e-b3fd-259b55da0f60`.

- Retained test context (2026-10-11T08:04:32.511Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_members_v2; references `e9abc432-2a8d-452d-b223-545f642cb638`.

- Retained test context (2026-10-11T08:04:32.511Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `1e5d9339-37f1-4bab-a523-5f8a6d94473d`.

- Retained test context (2026-10-11T08:04:32.511Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `64c13df5-f487-45a1-97c8-f75afecf634b`.

- Retained test context (2026-10-11T08:04:32.512Z): tests/integration/api/company-form-signing-and-completion.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:32.513Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_resource_action_grants; references `a443ebc0-a084-439c-bccf-64fb644db9f1`, `08ab2dfb-a25b-4642-b218-a6eb960d30f1`, `1fe86a04-bdea-47d7-a720-7ab37644a7e4`, `f677eea2-1479-4124-9b6b-ba82e34b9291`.

- Retained test context (2026-10-11T08:04:32.514Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_roleaccess_ac; references `a443ebc0-a084-439c-bccf-64fb644db9f1`, `08ab2dfb-a25b-4642-b218-a6eb960d30f1`, `1fe86a04-bdea-47d7-a720-7ab37644a7e4`, `f677eea2-1479-4124-9b6b-ba82e34b9291`.

- Retained test context (2026-10-11T08:04:32.514Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:32.514Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_rolemaster_ac; references `a443ebc0-a084-439c-bccf-64fb644db9f1`, `08ab2dfb-a25b-4642-b218-a6eb960d30f1`, `1fe86a04-bdea-47d7-a720-7ab37644a7e4`, `f677eea2-1479-4124-9b6b-ba82e34b9291`.

- Retained test context (2026-10-11T08:04:35.847Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_signatures; references `f03711d1-a746-477a-a3ce-dc861c8e87de`, `35f58b16-bfeb-429e-b682-373010a6b5d0`.

- Retained test context (2026-10-11T08:04:35.848Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_signature_attachments; references `f03711d1-a746-477a-a3ce-dc861c8e87de`, `35f58b16-bfeb-429e-b682-373010a6b5d0`.

- Retained test context (2026-10-11T08:04:35.848Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_answers; references `ade58184-2373-4ce5-92fb-dd9a3632bc31`, `f2792745-3ea6-4aa7-b74c-073ebc00e92f`, `73b10adf-b49d-4797-9a5f-ae1817745536`, `e7dab641-a1bd-4714-a79d-19e5f10246ef`.

- Retained test context (2026-10-11T08:04:35.848Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_states; references `ade58184-2373-4ce5-92fb-dd9a3632bc31`, `f2792745-3ea6-4aa7-b74c-073ebc00e92f`, `73b10adf-b49d-4797-9a5f-ae1817745536`, `e7dab641-a1bd-4714-a79d-19e5f10246ef`.

- Retained test context (2026-10-11T08:04:35.849Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_answers; references `9711a058-d606-4cb8-a562-be34f6632bac`.

- Retained test context (2026-10-11T08:04:35.849Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_states; references `9711a058-d606-4cb8-a562-be34f6632bac`.

- Retained test context (2026-10-11T08:04:35.849Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_company_submission_assignments; references `5197b5c9-8eeb-4b46-87d2-935ba71c66de`, `f960d639-d825-46f2-b3f6-f202114f80d7`, `0b55d04e-6da4-40b1-adc8-c089f4ccd06e`, `d38f6d63-1b68-4e4e-8e97-0fd8290e3e7a`, `37ff1ae0-923f-4899-a1be-e51dd34c7788`.

- Retained test context (2026-10-11T08:04:35.849Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_company_submissions; references `5197b5c9-8eeb-4b46-87d2-935ba71c66de`, `f960d639-d825-46f2-b3f6-f202114f80d7`, `0b55d04e-6da4-40b1-adc8-c089f4ccd06e`, `d38f6d63-1b68-4e4e-8e97-0fd8290e3e7a`, `37ff1ae0-923f-4899-a1be-e51dd34c7788`.

- Retained test context (2026-10-11T08:04:35.850Z): tests/integration/api/company-form-submission-starts.test.ts; target crew_assignments; references `5197b5c9-8eeb-4b46-87d2-935ba71c66de`, `f960d639-d825-46f2-b3f6-f202114f80d7`, `0b55d04e-6da4-40b1-adc8-c089f4ccd06e`, `d38f6d63-1b68-4e4e-8e97-0fd8290e3e7a`, `37ff1ae0-923f-4899-a1be-e51dd34c7788`.

- Retained test context (2026-10-11T08:04:35.850Z): tests/integration/api/company-form-submission-starts.test.ts; target crew_members_v2; references `75f95a73-b97b-4ab8-b470-a5c074569bc1`.

- Retained test context (2026-10-11T08:04:35.850Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_questions; references `01801249-df33-4e4b-97b2-30ce7db58f4a`, `23ec8f61-5992-4e3e-9817-eee81e0240a3`, `57fa2b0d-6aa7-4fe2-b0f6-e9e3cb252ac4`, `be75979e-2382-4f8d-9fb7-7b04004a0a36`.

- Retained test context (2026-10-11T08:04:35.851Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_sections; references `01801249-df33-4e4b-97b2-30ce7db58f4a`, `23ec8f61-5992-4e3e-9817-eee81e0240a3`, `57fa2b0d-6aa7-4fe2-b0f6-e9e3cb252ac4`, `be75979e-2382-4f8d-9fb7-7b04004a0a36`.

- Retained test context (2026-10-11T08:04:35.851Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_options; references `502a8d79-6508-486f-86a2-1d5bbc9f1564`, `bc83a4af-f562-4632-ac47-762375ef7d6a`, `44e9bef8-c448-4e92-864b-d83e75e4c1d5`, `f5c76198-9297-44d5-93a0-0d694c9cb62a`.

- Retained test context (2026-10-11T08:04:35.851Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_option_sets; references `502a8d79-6508-486f-86a2-1d5bbc9f1564`, `bc83a4af-f562-4632-ac47-762375ef7d6a`, `44e9bef8-c448-4e92-864b-d83e75e4c1d5`, `f5c76198-9297-44d5-93a0-0d694c9cb62a`.

- Retained test context (2026-10-11T08:04:35.851Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_form_parts; references `80aeee03-6ef2-456a-8233-61d40f92d19e`, `60036fa6-1e6c-4a5c-9beb-c2d9a680a816`, `d838fdb1-52e0-43f0-88e6-2f12ff51539b`, `8663cc6e-3f79-4224-acf1-71fc9ac08fa2`.

- Retained test context (2026-10-11T08:04:35.851Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessel_types; references `abf5e999-0c20-4cf4-8fea-b6b8e47d4369`.

- Retained test context (2026-10-11T08:04:35.852Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_form_versions_v2; references `a8356552-b5e4-4ea3-8ae5-69d92f6391fe`, `55b85c37-245c-45de-83a2-ad8cc4c2b1af`, `da5e17c8-e811-4c9c-8073-c708bec2bd85`, `4e319d32-a07d-4c46-8ad6-613325fc4b2e`, `b2a351d8-01c4-41f6-a2df-3764803f3925`.

- Retained test context (2026-10-11T08:04:35.852Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_forms_v2; references `edc0aff1-f410-4ef4-917a-69cdda5c5ea6`, `52b4b6ff-64c0-45e9-bba1-1417e1a658d1`, `4957d384-c267-493d-ad49-c5b7aa44609f`.

- Retained test context (2026-10-11T08:04:35.852Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_resource_action_grants; references `ec8e5ece-a85b-4ed4-9bf3-1012a535213e`, `819ce3e7-9632-44a3-aad2-3b0bbbf74376`, `1996ffef-2f40-4a10-b588-18af5e301084`, `dbf1e637-c801-44ba-b54a-346470225722`, `611402af-fcc9-4128-93ce-e89925e3e74e`.

- Retained test context (2026-10-11T08:04:35.852Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_roleaccess_ac; references `ec8e5ece-a85b-4ed4-9bf3-1012a535213e`, `819ce3e7-9632-44a3-aad2-3b0bbbf74376`, `1996ffef-2f40-4a10-b588-18af5e301084`, `dbf1e637-c801-44ba-b54a-346470225722`, `611402af-fcc9-4128-93ce-e89925e3e74e`.

- Retained test context (2026-10-11T08:04:35.853Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_rolemaster_ac; references `ec8e5ece-a85b-4ed4-9bf3-1012a535213e`, `819ce3e7-9632-44a3-aad2-3b0bbbf74376`, `1996ffef-2f40-4a10-b588-18af5e301084`, `dbf1e637-c801-44ba-b54a-346470225722`, `611402af-fcc9-4128-93ce-e89925e3e74e`.

- Retained test context (2026-10-11T08:04:35.853Z): tests/integration/api/company-form-submission-starts.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:35.853Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessels; references `1358bf6f-fa7a-45fd-8665-35408cfb8225`.

- Retained test context (2026-10-11T08:04:35.853Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessels; references `765bf814-f869-413a-a59c-9d436b7aceb3`.

- Retained test context (2026-10-11T08:04:35.860Z): tests/integration/api/company-form-submission-starts.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:41.698Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_section_signatures; references `1e8c7c2c-d93b-41d5-a349-7c72da612992`, `9e904594-079b-46cb-b4b2-3d9afb3c73be`.

- Retained test context (2026-10-11T08:04:41.699Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_answers; references `1e8c7c2c-d93b-41d5-a349-7c72da612992`, `9e904594-079b-46cb-b4b2-3d9afb3c73be`.

- Retained test context (2026-10-11T08:04:41.700Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_section_states; references `1e8c7c2c-d93b-41d5-a349-7c72da612992`, `9e904594-079b-46cb-b4b2-3d9afb3c73be`.

- Retained test context (2026-10-11T08:04:41.700Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_company_submission_assignments; references `1e8c7c2c-d93b-41d5-a349-7c72da612992`, `9e904594-079b-46cb-b4b2-3d9afb3c73be`.

- Retained test context (2026-10-11T08:04:41.701Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_company_submissions; references `1e8c7c2c-d93b-41d5-a349-7c72da612992`, `9e904594-079b-46cb-b4b2-3d9afb3c73be`.

- Retained test context (2026-10-11T08:04:41.701Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_signature_attachments; references `c0d10dc9-c87a-4811-ad89-4bae877b7e84`.

- Retained test context (2026-10-11T08:04:41.702Z): tests/integration/api/company-form-submission-boundary.test.ts; target crew_assignments; references `38687f62-1a65-4f3e-8802-cd00c390668b`, `9fc21c79-c6d4-4ba8-8d4f-475eafdf2fab`.

- Retained test context (2026-10-11T08:04:41.702Z): tests/integration/api/company-form-submission-boundary.test.ts; target crew_members_v2; references `a1ef1620-1ff6-4c01-8f8a-c6fa642f4321`.

- Retained test context (2026-10-11T08:04:41.702Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_questions; references `2a8aafad-ebfa-4d47-ac48-a4040cdcedc8`.

- Retained test context (2026-10-11T08:04:41.703Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_sections; references `71f2def3-0ea3-4ee0-9061-324a4de7752b`.

- Retained test context (2026-10-11T08:04:41.703Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_form_parts; references `97489d72-aa33-4aef-8333-765621d5bd41`.

- Retained test context (2026-10-11T08:04:41.703Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_options; references `f9f5a51f-72bf-4264-b674-574a1f7d6c2a`.

- Retained test context (2026-10-11T08:04:41.704Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_option_sets; references `f9f5a51f-72bf-4264-b674-574a1f7d6c2a`.

- Retained test context (2026-10-11T08:04:41.704Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_form_versions_v2; references `10a24918-e95c-4224-9e80-80081acda38f`.

- Retained test context (2026-10-11T08:04:41.704Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_forms_v2; references `a06e4f7b-362d-4c22-b244-bf8061a9e9d3`.

- Retained test context (2026-10-11T08:04:41.705Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_resource_action_grants; references `615925f3-36b0-48fa-9ff5-b4d5ae59be5c`, `27ef123a-32f4-467d-8078-ad369ebc059a`, `7efcd638-5a80-45b8-9568-4215ea03e5b7`, `48493775-8cb5-4123-9646-3c364b174853`, `0a1993bc-ac4e-4118-95ed-7468c0d67344`, `524d0121-96fc-42f9-9c21-28c0c9d09ba4`, `26230877-86d2-41cb-906c-454913e15f2a`.

- Retained test context (2026-10-11T08:04:41.705Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_roleaccess_ac; references `615925f3-36b0-48fa-9ff5-b4d5ae59be5c`, `27ef123a-32f4-467d-8078-ad369ebc059a`, `7efcd638-5a80-45b8-9568-4215ea03e5b7`, `48493775-8cb5-4123-9646-3c364b174853`, `0a1993bc-ac4e-4118-95ed-7468c0d67344`, `524d0121-96fc-42f9-9c21-28c0c9d09ba4`, `26230877-86d2-41cb-906c-454913e15f2a`.

- Retained test context (2026-10-11T08:04:41.706Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_rolemaster_ac; references `615925f3-36b0-48fa-9ff5-b4d5ae59be5c`, `27ef123a-32f4-467d-8078-ad369ebc059a`, `7efcd638-5a80-45b8-9568-4215ea03e5b7`, `48493775-8cb5-4123-9646-3c364b174853`, `0a1993bc-ac4e-4118-95ed-7468c0d67344`, `524d0121-96fc-42f9-9c21-28c0c9d09ba4`, `26230877-86d2-41cb-906c-454913e15f2a`.

- Retained test context (2026-10-11T08:04:41.706Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:41.706Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessels; references `3137c681-f7ee-4efa-8e6a-7c87b7bdad75`.

- Retained test context (2026-10-11T08:04:41.707Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessels; references `5c940532-d915-4ade-b9b4-22e6d5fbfef0`.

- Retained test context (2026-10-11T08:04:41.707Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessel_types; references `001533c1-faf8-493a-9d82-e729d1a2609a`.

- Retained test context (2026-10-11T08:04:41.712Z): tests/integration/api/company-form-submission-boundary.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:44.408Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_answers; references `0dc9e4bb-aaab-44d3-a64a-5d01442b2e12`.

- Retained test context (2026-10-11T08:04:44.409Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_section_states; references `0dc9e4bb-aaab-44d3-a64a-5d01442b2e12`.

- Retained test context (2026-10-11T08:04:44.410Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_company_submission_assignments; references `0dc9e4bb-aaab-44d3-a64a-5d01442b2e12`.

- Retained test context (2026-10-11T08:04:44.410Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_company_submissions; references `0dc9e4bb-aaab-44d3-a64a-5d01442b2e12`.

- Retained test context (2026-10-11T08:04:44.411Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_questions; references `0baac3d5-d236-411a-b288-c2b2f4ade2e4`, `4de08f9e-5f60-4070-9ed2-b02fd9c303ac`, `81c9ac37-01c8-4165-af74-815de645b7ec`, `26b2d899-4456-4f64-8604-f86b2d493052`, `7f82a025-97b5-41d4-a019-f0dae0b50a2d`, `b1411caf-a619-488e-85da-78bb76c6b466`, `5fafd5e4-3281-4a1b-a8c5-4a2e8fdd2ec9`, `fd7f0a36-10b9-4aed-8110-168b7445d8b8`, `938bc12d-1614-4bd8-833e-1f02b4dcaa6c`, `f7c50353-b1ce-402f-af61-c938ededf017`, `92ff9171-a23e-4a15-804e-050238e65fb1`, `029ad3af-341a-4f50-8504-7ab54dc38ae9`, `02f8c699-b79f-497d-9278-d37795551ed0`.

- Retained test context (2026-10-11T08:04:44.411Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_sections; references `ae90c592-9d8d-4710-b436-4e76f6fe8be9`.

- Retained test context (2026-10-11T08:04:44.412Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_form_parts; references `aae77c40-c88b-47d6-8446-c3f599237273`.

- Retained test context (2026-10-11T08:04:44.412Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_options; references `9100d8db-b11d-4dc3-a849-0272d71a0701`.

- Retained test context (2026-10-11T08:04:44.412Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_option_sets; references `9100d8db-b11d-4dc3-a849-0272d71a0701`.

- Retained test context (2026-10-11T08:04:44.413Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_form_versions_v2; references `dc59bc1a-7b86-43dc-bc5c-acc19666e4cf`.

- Retained test context (2026-10-11T08:04:44.414Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_forms_v2; references `5318b81a-f2d3-4402-920c-edd5e1d2f920`.

- Retained test context (2026-10-11T08:04:44.414Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target crew_assignments; references `3fad2890-7af4-48eb-8334-88d7536e0de5`.

- Retained test context (2026-10-11T08:04:44.414Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target crew_members_v2; references `9c00f5f3-a4bd-4e61-98b1-72b7d2bcfeb0`.

- Retained test context (2026-10-11T08:04:44.415Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:44.415Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_resource_action_grants; references `7625209b-8254-42a0-85a9-8f870a2e7f0e`.

- Retained test context (2026-10-11T08:04:44.416Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_roleaccess_ac; references `7625209b-8254-42a0-85a9-8f870a2e7f0e`.

- Retained test context (2026-10-11T08:04:44.416Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_rolemaster_ac; references `7625209b-8254-42a0-85a9-8f870a2e7f0e`.

- Retained test context (2026-10-11T08:04:46.772Z): tests/integration/company-form-stage-less-runtime.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:46.857Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submission_system_snapshots; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:46.858Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submission_system_snapshots; references `fca8e646-b5f1-42d9-8804-320f53d86259`, `1ab07708-a9a4-4de0-92b7-73a6640aef05`, `89a258c6-9b8a-449b-af47-e9ab0dcbe0ff`, `5ad4810a-ecd3-483f-a51e-be9d974af374`, `63fb9c39-dfc6-46d2-b8b3-a9bd2ae5dd53`.

- Retained test context (2026-10-11T08:04:46.859Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_section_signatures; references `fca8e646-b5f1-42d9-8804-320f53d86259`, `1ab07708-a9a4-4de0-92b7-73a6640aef05`, `89a258c6-9b8a-449b-af47-e9ab0dcbe0ff`, `5ad4810a-ecd3-483f-a51e-be9d974af374`, `63fb9c39-dfc6-46d2-b8b3-a9bd2ae5dd53`.

- Retained test context (2026-10-11T08:04:46.861Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_answers; references `fca8e646-b5f1-42d9-8804-320f53d86259`, `1ab07708-a9a4-4de0-92b7-73a6640aef05`, `89a258c6-9b8a-449b-af47-e9ab0dcbe0ff`, `5ad4810a-ecd3-483f-a51e-be9d974af374`, `63fb9c39-dfc6-46d2-b8b3-a9bd2ae5dd53`.

- Retained test context (2026-10-11T08:04:46.861Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_section_states; references `fca8e646-b5f1-42d9-8804-320f53d86259`, `1ab07708-a9a4-4de0-92b7-73a6640aef05`, `89a258c6-9b8a-449b-af47-e9ab0dcbe0ff`, `5ad4810a-ecd3-483f-a51e-be9d974af374`, `63fb9c39-dfc6-46d2-b8b3-a9bd2ae5dd53`.

- Retained test context (2026-10-11T08:04:46.862Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submissions; references `fca8e646-b5f1-42d9-8804-320f53d86259`, `1ab07708-a9a4-4de0-92b7-73a6640aef05`, `89a258c6-9b8a-449b-af47-e9ab0dcbe0ff`, `5ad4810a-ecd3-483f-a51e-be9d974af374`, `63fb9c39-dfc6-46d2-b8b3-a9bd2ae5dd53`.

- Retained test context (2026-10-11T08:04:46.862Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_signature_attachments; references `d458a397-f155-4aa0-989c-3a77dfbfa7dd`, `a1a8c0cf-7ed7-459c-8182-45669af6f515`, `4c5d22dd-7d30-4eca-8658-352c9c181302`, `b1b90110-fb4c-4a9e-b049-45a831de85cc`, `40faed8c-3644-46c9-83d2-ce507efc4f69`, `c25dda6a-4413-4280-8dbf-61d2cbfb2541`.

- Retained test context (2026-10-11T08:04:46.863Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_questions; references `f80aa3d9-9b92-438b-81a4-bdd03765066a`, `e8c8bd55-5fe8-48f6-b47b-e7c70d930f0b`, `2055271f-fdaa-4def-a004-bee590b8e434`, `cd81a1e6-39a9-4a43-8be9-7c770cb55d32`, `5a5c1595-9e14-4fba-8053-dbb9690fa594`, `9795fe0b-d23a-4857-a122-d4839810144a`, `cb1b90eb-68eb-49ec-8e10-87e5dc1c9818`.

- Retained test context (2026-10-11T08:04:46.863Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_sections; references `4914d840-eece-4934-81b6-cef776b89a22`, `f4e0edf9-d04d-4614-93e6-63c0d1e548ab`, `7e3ade07-f84c-4ac6-af60-eea286f2cfd3`, `e0b4c24b-de87-40fd-a53c-801327ddd512`, `0eb3ff09-730c-4f2c-82d3-ff4403cf4223`.

- Retained test context (2026-10-11T08:04:46.864Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_form_parts; references `384bed5c-8c4d-47a0-856b-08afd47b7876`.

- Retained test context (2026-10-11T08:04:46.864Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_form_versions_v2; references `fbf50db1-4632-427d-82d0-729ea73dbbab`.

- Retained test context (2026-10-11T08:04:46.864Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_forms_v2; references `107350f0-d8e0-4317-a4e0-31f766956072`.

- Retained test context (2026-10-11T08:04:46.865Z): tests/integration/company-form-stage-less-runtime.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:46.865Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_roleaccess_ac; references `ce9d0a46-5c27-4e3b-85d8-5216a94dd1b2`.

- Retained test context (2026-10-11T08:04:46.865Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_rolemaster_ac; references `ce9d0a46-5c27-4e3b-85d8-5216a94dd1b2`.

- Retained test context (2026-10-11T08:04:46.866Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_subject_types; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:51.220Z): tests/integration/api/company-form-submission-void-races.test.ts; target cleanup context; references `7d8ea909-0516-47c9-8e71-f2868d9bb1ea`.

- Retained test context (2026-10-11T08:04:51.313Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_section_signatures; references `2d05d5a1-2f71-4578-94b2-e9db6a38d6be`, `6e7e9369-9aca-4af5-af60-fa24f94094de`, `7119b0d4-3306-41bb-a2ae-ef5886ab6f15`, `c837fcba-2a87-4968-aa64-a9ede7fa5f5c`.

- Retained test context (2026-10-11T08:04:51.314Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_answers; references `2d05d5a1-2f71-4578-94b2-e9db6a38d6be`, `6e7e9369-9aca-4af5-af60-fa24f94094de`, `7119b0d4-3306-41bb-a2ae-ef5886ab6f15`, `c837fcba-2a87-4968-aa64-a9ede7fa5f5c`.

- Retained test context (2026-10-11T08:04:51.314Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submission_system_snapshots; references `2d05d5a1-2f71-4578-94b2-e9db6a38d6be`, `6e7e9369-9aca-4af5-af60-fa24f94094de`, `7119b0d4-3306-41bb-a2ae-ef5886ab6f15`, `c837fcba-2a87-4968-aa64-a9ede7fa5f5c`.

- Retained test context (2026-10-11T08:04:51.314Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_section_states; references `2d05d5a1-2f71-4578-94b2-e9db6a38d6be`, `6e7e9369-9aca-4af5-af60-fa24f94094de`, `7119b0d4-3306-41bb-a2ae-ef5886ab6f15`, `c837fcba-2a87-4968-aa64-a9ede7fa5f5c`.

- Retained test context (2026-10-11T08:04:51.315Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submission_assignments; references `2d05d5a1-2f71-4578-94b2-e9db6a38d6be`, `6e7e9369-9aca-4af5-af60-fa24f94094de`, `7119b0d4-3306-41bb-a2ae-ef5886ab6f15`, `c837fcba-2a87-4968-aa64-a9ede7fa5f5c`.

- Retained test context (2026-10-11T08:04:51.315Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submissions; references `2d05d5a1-2f71-4578-94b2-e9db6a38d6be`, `6e7e9369-9aca-4af5-af60-fa24f94094de`, `7119b0d4-3306-41bb-a2ae-ef5886ab6f15`, `c837fcba-2a87-4968-aa64-a9ede7fa5f5c`.

- Retained test context (2026-10-11T08:04:51.315Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_signature_attachments; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:51.315Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_questions; references `08210b93-380b-4433-bcf5-ea0b17517564`.

- Retained test context (2026-10-11T08:04:51.316Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_sections; references `253b95d0-7269-4f31-86fd-8f7dd02d3837`.

- Retained test context (2026-10-11T08:04:51.316Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_form_parts; references `f0773a75-bf14-42c7-839f-159e0163fefa`.

- Retained test context (2026-10-11T08:04:51.316Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_form_versions_v2; references `1a2310f9-0b52-4514-98eb-0e693eee763a`.

- Retained test context (2026-10-11T08:04:51.316Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_forms_v2; references `52634eb2-fe52-4876-9780-4370f3928a6d`.

- Retained test context (2026-10-11T08:04:51.316Z): tests/integration/api/company-form-submission-void-races.test.ts; target crew_assignments; references `b38a91a5-0bd0-48f8-9491-b7340b6e18e1`, `c8e06503-6021-4f0e-be53-3ab2422ea575`, `38c1679f-ded0-4f13-9e58-5a7515223b58`, `2663c5d1-0f8a-4acc-8e3d-6432cb46b32a`.

- Retained test context (2026-10-11T08:04:51.317Z): tests/integration/api/company-form-submission-void-races.test.ts; target crew_members_v2; references `55fb7558-8384-4413-ab86-580569d38140`.

- Retained test context (2026-10-11T08:04:51.317Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_resource_action_grants; references `7d8ea909-0516-47c9-8e71-f2868d9bb1ea`, `f7a668a2-9099-4ea0-8c73-dce17ec4d42a`.

- Retained test context (2026-10-11T08:04:51.317Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_roleaccess_ac; references `7d8ea909-0516-47c9-8e71-f2868d9bb1ea`.

- Retained test context (2026-10-11T08:04:51.317Z): tests/integration/api/company-form-submission-void-races.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:51.318Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_rolemaster_ac; references `7d8ea909-0516-47c9-8e71-f2868d9bb1ea`, `f7a668a2-9099-4ea0-8c73-dce17ec4d42a`.

- Retained test context (2026-10-11T08:04:51.318Z): tests/integration/api/company-form-submission-void-races.test.ts; target master_vessels; references `cb72b462-159c-4ffc-8ae2-2c24a4390078`.

- Retained test context (2026-10-11T08:04:51.322Z): tests/integration/api/company-form-submission-void-races.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:53.097Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_section_signatures; references `66a3778d-ca58-4bdb-93a9-e6065a47f514`.

- Retained test context (2026-10-11T08:04:53.100Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_signature_attachments; references `26eb1a36-d3bf-4215-9679-25647a726d35`, `b1290b3f-257e-4f7b-85c2-b1841f72be42`.

- Retained test context (2026-10-11T08:04:53.101Z): tests/integration/debriefing-submission.acceptance.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:53.102Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_answers; references `66a3778d-ca58-4bdb-93a9-e6065a47f514`.

- Retained test context (2026-10-11T08:04:53.102Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_section_states; references `66a3778d-ca58-4bdb-93a9-e6065a47f514`.

- Retained test context (2026-10-11T08:04:53.102Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_debriefing_submissions; references `66a3778d-ca58-4bdb-93a9-e6065a47f514`.

- Retained test context (2026-10-11T08:04:53.103Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_questions; references `ad356806-5d12-4101-8256-a50de7ffda57`.

- Retained test context (2026-10-11T08:04:53.103Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_sections; references `ea7e0018-3047-46d6-ad73-e113e86491ff`, `dbb9fab7-718c-402b-9446-5b09dd7b7178`, `0758f8c3-cdb9-43a3-aeb9-6a4806ee069f`.

- Retained test context (2026-10-11T08:04:53.104Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_form_parts; references `a7fc6dfb-eb7b-4e22-b03f-0c92227cabec`.

- Retained test context (2026-10-11T08:04:53.104Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_form_versions_v2; references `d4c79f6a-deb1-4dcc-bbc6-ab90ff7ad0bb`, `66cf020b-4abe-4047-a053-01f1b2683622`.

- Retained test context (2026-10-11T08:04:53.104Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_rank_groups_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:53.105Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_forms_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:53.105Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_debriefings; references `6c3b4fcd-cc62-4c32-b982-b40812912a1b`, `1172d872-eb75-432b-b9fd-53b20ac28f59`, `2cccb6d1-6cfb-4e90-babb-30aa3cc0c73d`.

- Retained test context (2026-10-11T08:04:53.105Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_members_v2; references `aa8a9d07-46c7-4cc4-85ee-6e3f3cacf6d2`.

- Retained test context (2026-10-11T08:04:53.106Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_vessels; references `34d67378-ae6f-48cf-8544-286230e2edb0`.

- Retained test context (2026-10-11T08:04:53.106Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_vessel_types; references `712dc776-5398-40a1-bcc4-c83c54f355f8`.

- Retained test context (2026-10-11T08:04:53.106Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.675Z): dimension context cf_dimensions_a8fc6ed2; target registered_fixture_context; references `115d6142-7916-4cb5-819d-b9e55efc1e06`, `f3c2578a-c8e9-4115-b22d-6d022dc0ddba`, `f1d18ac1-79c5-4daf-ab6a-15015525a074`, `3af024fb-5969-487e-941d-87b3f3ee0679`.

- Retained test context (2026-10-11T08:04:55.869Z): cf_dimensions_a8fc6ed2.adm_available_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.884Z): cf_dimensions_a8fc6ed2.adm_company_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.900Z): cf_dimensions_a8fc6ed2.master_vessels canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.918Z): cf_dimensions_a8fc6ed2.master_vessel_types canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.936Z): cf_dimensions_a8fc6ed2.master_nationalities canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.952Z): cf_dimensions_a8fc6ed2.master_manning_agents canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.967Z): cf_dimensions_a8fc6ed2.master_crew_pools canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.981Z): cf_dimensions_a8fc6ed2.master_fleet_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:55.994Z): cf_dimensions_a8fc6ed2.master_additional_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:56.015Z): canonical master copies cf_dimensions_a8fc6ed2; target registered_fixture_context; references `55d4c4b0-8e9c-479c-a9f0-9f3fbe95e0e5`, `743feb08-841a-11ed-aa7c-7003bca91a86`.

- Retained test context (2026-10-11T08:04:58.003Z): tests/integration/api/company-form-submission-races.test.ts; target frm_answers; references `9dfdd7d3-7278-4f6d-a1d5-c177ddce3816`, `4aca0fe6-7a45-45dd-8c73-78fcef1242e5`, `9014cf61-8f17-47f1-a8ec-84067409825e`.

- Retained test context (2026-10-11T08:04:58.004Z): tests/integration/api/company-form-submission-races.test.ts; target frm_section_states; references `9dfdd7d3-7278-4f6d-a1d5-c177ddce3816`, `4aca0fe6-7a45-45dd-8c73-78fcef1242e5`, `9014cf61-8f17-47f1-a8ec-84067409825e`.

- Retained test context (2026-10-11T08:04:58.005Z): tests/integration/api/company-form-submission-races.test.ts; target frm_company_submission_assignments; references `9dfdd7d3-7278-4f6d-a1d5-c177ddce3816`, `4aca0fe6-7a45-45dd-8c73-78fcef1242e5`, `9014cf61-8f17-47f1-a8ec-84067409825e`.

- Retained test context (2026-10-11T08:04:58.005Z): tests/integration/api/company-form-submission-races.test.ts; target frm_company_submissions; references `9dfdd7d3-7278-4f6d-a1d5-c177ddce3816`, `4aca0fe6-7a45-45dd-8c73-78fcef1242e5`, `9014cf61-8f17-47f1-a8ec-84067409825e`.

- Retained test context (2026-10-11T08:04:58.006Z): tests/integration/api/company-form-submission-races.test.ts; target crew_assignments; references `5f6f6f57-4d8a-4c7e-8be0-35d0049c5f52`, `11f1f1c1-8c5b-4a57-8c2e-e25a4d5e6188`, `a54dd542-6b78-4292-95f8-ba281ec6cbf4`, `4dfb9a6e-cadb-416f-b26a-2e2304033972`, `fea3f337-7d26-49d9-80ce-28fd3c6dd7fa`.

- Retained test context (2026-10-11T08:04:58.006Z): tests/integration/api/company-form-submission-races.test.ts; target frm_questions; references `7baa566d-6c18-4bd2-bd3f-74cb562a85b0`.

- Retained test context (2026-10-11T08:04:58.007Z): tests/integration/api/company-form-submission-races.test.ts; target frm_sections; references `ab93345b-7c17-4df3-8bab-ecb39280a184`.

- Retained test context (2026-10-11T08:04:58.007Z): tests/integration/api/company-form-submission-races.test.ts; target frm_form_parts; references `f1d2237c-77d3-4204-be81-11da52ce47d5`.

- Retained test context (2026-10-11T08:04:58.008Z): tests/integration/api/company-form-submission-races.test.ts; target adm_form_versions_v2; references `3b2d8439-7829-452a-9b06-85b57fb3f3d0`.

- Retained test context (2026-10-11T08:04:58.008Z): tests/integration/api/company-form-submission-races.test.ts; target adm_forms_v2; references `3086b17f-fba6-4ec5-a582-463a81b88b3e`.

- Retained test context (2026-10-11T08:04:58.009Z): tests/integration/api/company-form-submission-races.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:04:58.010Z): tests/integration/api/company-form-submission-races.test.ts; target adm_resource_action_grants; references `6b47dfb2-8c75-4af2-9c99-6fd2b0ef906a`.

- Retained test context (2026-10-11T08:04:58.010Z): tests/integration/api/company-form-submission-races.test.ts; target adm_roleaccess_ac; references `6b47dfb2-8c75-4af2-9c99-6fd2b0ef906a`.

- Retained test context (2026-10-11T08:04:58.011Z): tests/integration/api/company-form-submission-races.test.ts; target adm_rolemaster_ac; references `6b47dfb2-8c75-4af2-9c99-6fd2b0ef906a`.

- Retained test context (2026-10-11T08:05:05.176Z): dimension release definition; target registered_fixture_context; references `3f0ea3c6-e38f-450a-8380-595d3854ec89`, `e0d53795-1479-4936-885d-a63da04facb6`.

- Retained test context (2026-10-11T08:05:05.263Z): dimension release draft content; target registered_fixture_context; references `30467657-03e7-4ecc-81f7-bf7ababff723`, `8100660b-c9e6-4f5a-801a-d465365ec13d`, `1888b60b-1e14-4ec9-a101-b6a3b6cd754d`, `23f5a128-b93d-43f4-8225-772bd13a4653`.

- Retained test context (2026-10-11T08:05:05.329Z): dimension release condition data; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:05:05.458Z): dimension release copied draft; target registered_fixture_context; references `eee9b2ff-8e51-449c-ad0b-e8fd07b5964e`.

- Retained test context (2026-10-11T08:06:46.326Z): tests/integration/api/obsolete-crew-assignment-paths.test.ts; target vessel_planning_v2; references `d45858ed-cd82-471b-9c13-9feb7f19c6b0`.

- Retained test context (2026-10-11T08:06:46.328Z): tests/integration/api/obsolete-crew-assignment-paths.test.ts; target crew_members_v2; references `ad10e5a1-9f17-4b0f-a4ad-cd0e4b687238`.

- Retained test context (2026-10-11T08:06:49.066Z): tests/integration/api/ship-reference-reads.test.ts; target acc_allotments_v2; references `2c771cb0-2eda-4f80-af8f-829c55fdb39a`, `462a0343-9f5e-4beb-bc93-b155e89e02bd`, `f813cab8-970d-436b-afe8-228e0c979eba`.

- Retained test context (2026-10-11T08:06:49.067Z): tests/integration/api/ship-reference-reads.test.ts; target acc_engagements_v2; references `e10830bd-b2ef-494d-814f-2f7655397138`, `4eee1a4f-abdd-4a2e-ace8-ed0cdf70d15c`.

- Retained test context (2026-10-11T08:06:49.068Z): tests/integration/api/ship-reference-reads.test.ts; target acc_wage_scale_lines_v2; references `9a0635e4-ebfe-4f8c-98df-00cd04f661bd`, `ebac6417-6765-44e3-933d-1d4adc450ac9`.

- Retained test context (2026-10-11T08:06:49.068Z): tests/integration/api/ship-reference-reads.test.ts; target acc_wage_scales_v2; references `9a0635e4-ebfe-4f8c-98df-00cd04f661bd`, `ebac6417-6765-44e3-933d-1d4adc450ac9`.

- Retained test context (2026-10-11T08:06:49.069Z): tests/integration/api/ship-reference-reads.test.ts; target acc_pay_elements_v2; references `23df7e7e-3bf6-4b5b-8fa9-f511ab58c38e`, `3c98e9a1-1ef2-4685-b93c-7080081fc7b1`, `fff4f518-7bfd-40ec-933b-013b02337127`, `c10c7adf-ebe8-45ef-9d32-7f44b4bb73c8`, `483cc978-0a06-4414-a15f-4cdde406be9f`, `d1ef31be-d457-48c2-87ba-9a1a17e0c7d3`.

- Retained test context (2026-10-11T08:06:54.337Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_ctm_lines_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:54.339Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_ctm_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:54.340Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_monthly_transactions_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:54.341Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_wage_ledger_v2; references `1b6e353c-475d-46bd-89c4-2880297e305d`.

- Retained test context (2026-10-11T08:06:54.342Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_calculation_runs_v2; references `6fe80b0c-96f4-4f5f-b333-8b66bddd2755`, `81355e13-6d66-448d-b3a2-cdd1f9576e7e`, `5c34ae46-7c38-4931-a418-882157637de2`, `c7ffbd21-761d-46a8-88ec-7e8948232430`.

- Retained test context (2026-10-11T08:06:54.342Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:54.343Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_allotments_v2; references `5cdcfa27-14e6-4428-b484-e3bf8b1149fd`.

- Retained test context (2026-10-11T08:06:54.344Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_engagements_v2; references `1b6e353c-475d-46bd-89c4-2880297e305d`.

- Retained test context (2026-10-11T08:06:54.344Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_wage_scale_lines_v2; references `1af7b2c1-9ffd-4a25-b095-9b8639c3859f`.

- Retained test context (2026-10-11T08:06:54.345Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_wage_scales_v2; references `1af7b2c1-9ffd-4a25-b095-9b8639c3859f`.

- Retained test context (2026-10-11T08:06:54.346Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_pay_elements_v2; references `ebef6064-afa6-437e-8931-fe4b57e9df9c`, `6460b7c4-718e-4be0-b589-3e5f388939ea`, `a139632f-79db-422b-8919-58140ee8e76c`, `21369806-3441-42dd-a410-188f113f7bac`, `43600449-3021-4023-a22b-cac06db3e65d`.

- Retained test context (2026-10-11T08:06:56.042Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_wage_ledger_v2; references `9ee74443-05de-4f7f-9606-183016ab7912`, `931fb67c-c1d7-4f32-9139-4c84423dbcfc`.

- Retained test context (2026-10-11T08:06:56.043Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_calculation_runs_v2; references `9ee74443-05de-4f7f-9606-183016ab7912`, `931fb67c-c1d7-4f32-9139-4c84423dbcfc`.

- Retained test context (2026-10-11T08:06:56.044Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_monthly_transactions_v2; references `9ee74443-05de-4f7f-9606-183016ab7912`, `931fb67c-c1d7-4f32-9139-4c84423dbcfc`.

- Retained test context (2026-10-11T08:06:56.044Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_ctm_lines_v2; references `9ee74443-05de-4f7f-9606-183016ab7912`, `931fb67c-c1d7-4f32-9139-4c84423dbcfc`.

- Retained test context (2026-10-11T08:06:56.044Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_ctm_v2; references `9ee74443-05de-4f7f-9606-183016ab7912`, `931fb67c-c1d7-4f32-9139-4c84423dbcfc`.

- Retained test context (2026-10-11T08:06:56.045Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_portage_bills_v2; references `9ee74443-05de-4f7f-9606-183016ab7912`, `931fb67c-c1d7-4f32-9139-4c84423dbcfc`.

- Retained test context (2026-10-11T08:06:56.045Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_settlements_v2; references `12ca0e25-a942-4a8a-8dce-57eb54331997`.

- Retained test context (2026-10-11T08:06:56.046Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_allotments_v2; references `74d5ce0c-f9f1-434b-99ea-6333bfa3bb28`, `27eee0a9-4657-4e56-9a3d-918eaa73256e`, `cc38fa8c-8a5b-4bee-baf0-91d174c103ad`, `c9638201-7bd6-4652-bd93-f33a1d6724e8`.

- Retained test context (2026-10-11T08:06:56.046Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_engagements_v2; references `9ee74443-05de-4f7f-9606-183016ab7912`, `931fb67c-c1d7-4f32-9139-4c84423dbcfc`.

- Retained test context (2026-10-11T08:06:56.047Z): tests/integration/api/vessel-initiated-workflow.test.ts; target crew_assignments; references `965e9281-5e03-4acf-8855-9b5083703b63`, `a196eb6d-d460-49df-a86c-d8ce9d06038f`.

- Retained test context (2026-10-11T08:06:56.047Z): tests/integration/api/vessel-initiated-workflow.test.ts; target crew_members_v2; references `74d5ce0c-f9f1-434b-99ea-6333bfa3bb28`, `27eee0a9-4657-4e56-9a3d-918eaa73256e`, `cc38fa8c-8a5b-4bee-baf0-91d174c103ad`, `c9638201-7bd6-4652-bd93-f33a1d6724e8`.

- Retained test context (2026-10-11T08:06:56.048Z): tests/integration/api/vessel-initiated-workflow.test.ts; target adm_company_ranks_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:56.048Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_wage_scale_lines_v2; references `81e98e97-db47-4f47-b165-9c7b13379ef5`.

- Retained test context (2026-10-11T08:06:56.049Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_wage_scales_v2; references `81e98e97-db47-4f47-b165-9c7b13379ef5`.

- Retained test context (2026-10-11T08:06:56.049Z): tests/integration/api/vessel-initiated-workflow.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:56.050Z): tests/integration/api/vessel-initiated-workflow.test.ts; target master_vessels; references `9ee74443-05de-4f7f-9606-183016ab7912`, `931fb67c-c1d7-4f32-9139-4c84423dbcfc`.

- Retained test context (2026-10-11T08:06:56.051Z): tests/integration/api/vessel-initiated-workflow.test.ts; target master_vessel_types; references `c68b931e-9f88-4767-ad94-536b43d7ca39`.

- Retained test context (2026-10-11T08:06:56.051Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_pay_elements_v2; references `1a619858-c838-4431-9e20-40935df6a202`, `3bcc4815-39af-46bb-b8ad-212820df59ad`.

- Retained test context (2026-10-11T08:06:56.051Z): tests/integration/api/vessel-initiated-workflow.test.ts; target cleanup context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:57.376Z): tests/integration/api/wage-engine.test.ts; target acc_settlement_approvals_v2; references `33c85aca-a752-4417-bf82-54dce2db73ac`, `c18d27fa-54fa-45b0-baf1-8c3e96907961`, `09d8b120-d0da-498c-983a-95546de1a206`, `00b15aa8-3beb-4fec-a540-f94da32badd1`, `3185e9d6-260f-4ef8-bc5d-6452ef48f6f3`, `2dc886b0-5cfd-4c6c-9520-de80447a69c0`, `021b2df3-cb55-49cb-a67b-c0771b37a045`, `fba3e729-3773-4aa5-a966-48624b9436ed`, `3c106bf8-328f-42e6-988a-844e37cb3165`, `883a5235-5002-4409-ae5c-d08247cacda3`, `2a381e2d-de41-446d-99d6-be8778b18d2e`, `4b2182a5-9f41-4b50-b709-424daed07636`, `63e32542-336e-4281-af95-ae9315ee9c65`, `4134f757-f078-4c9d-aee1-c95c68413c4d`, `15ddf4c9-ce7e-4113-b134-34388831bb89`, `fce2bdbc-da29-4f6e-bc49-2b40b2a62366`, `e92b9279-e5f9-4553-acf0-6c414b18e46c`, `7e1b9738-7f4e-4d50-aaf3-6ffe219db9fc`, `7070c0fd-243a-401e-aed0-c4da9a1c2017`, `0d380687-c1cf-4dfa-b732-01472ce00e3a`, `2eb49299-333d-49be-bb27-ba8c8861f9e1`.

- Retained test context (2026-10-11T08:06:57.377Z): tests/integration/api/wage-engine.test.ts; target acc_settlement_adjustments_v2; references `33c85aca-a752-4417-bf82-54dce2db73ac`, `c18d27fa-54fa-45b0-baf1-8c3e96907961`, `09d8b120-d0da-498c-983a-95546de1a206`, `00b15aa8-3beb-4fec-a540-f94da32badd1`, `3185e9d6-260f-4ef8-bc5d-6452ef48f6f3`, `2dc886b0-5cfd-4c6c-9520-de80447a69c0`, `021b2df3-cb55-49cb-a67b-c0771b37a045`, `fba3e729-3773-4aa5-a966-48624b9436ed`, `3c106bf8-328f-42e6-988a-844e37cb3165`, `883a5235-5002-4409-ae5c-d08247cacda3`, `2a381e2d-de41-446d-99d6-be8778b18d2e`, `4b2182a5-9f41-4b50-b709-424daed07636`, `63e32542-336e-4281-af95-ae9315ee9c65`, `4134f757-f078-4c9d-aee1-c95c68413c4d`, `15ddf4c9-ce7e-4113-b134-34388831bb89`, `fce2bdbc-da29-4f6e-bc49-2b40b2a62366`, `e92b9279-e5f9-4553-acf0-6c414b18e46c`, `7e1b9738-7f4e-4d50-aaf3-6ffe219db9fc`, `7070c0fd-243a-401e-aed0-c4da9a1c2017`, `0d380687-c1cf-4dfa-b732-01472ce00e3a`, `2eb49299-333d-49be-bb27-ba8c8861f9e1`.

- Retained test context (2026-10-11T08:06:57.378Z): tests/integration/api/wage-engine.test.ts; target acc_settlements_v2; references `33c85aca-a752-4417-bf82-54dce2db73ac`, `c18d27fa-54fa-45b0-baf1-8c3e96907961`, `09d8b120-d0da-498c-983a-95546de1a206`, `00b15aa8-3beb-4fec-a540-f94da32badd1`, `3185e9d6-260f-4ef8-bc5d-6452ef48f6f3`, `2dc886b0-5cfd-4c6c-9520-de80447a69c0`, `021b2df3-cb55-49cb-a67b-c0771b37a045`, `fba3e729-3773-4aa5-a966-48624b9436ed`, `3c106bf8-328f-42e6-988a-844e37cb3165`, `883a5235-5002-4409-ae5c-d08247cacda3`, `2a381e2d-de41-446d-99d6-be8778b18d2e`, `4b2182a5-9f41-4b50-b709-424daed07636`, `63e32542-336e-4281-af95-ae9315ee9c65`, `4134f757-f078-4c9d-aee1-c95c68413c4d`, `15ddf4c9-ce7e-4113-b134-34388831bb89`, `fce2bdbc-da29-4f6e-bc49-2b40b2a62366`, `e92b9279-e5f9-4553-acf0-6c414b18e46c`, `7e1b9738-7f4e-4d50-aaf3-6ffe219db9fc`, `7070c0fd-243a-401e-aed0-c4da9a1c2017`, `0d380687-c1cf-4dfa-b732-01472ce00e3a`, `2eb49299-333d-49be-bb27-ba8c8861f9e1`.

- Retained test context (2026-10-11T08:06:57.378Z): tests/integration/api/wage-engine.test.ts; target crew_assignments; references `f93b2b1d-f7b8-4c27-a833-7a5998d0a69b`.

- Retained test context (2026-10-11T08:06:57.379Z): tests/integration/api/wage-engine.test.ts; target acc_engagements_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:57.379Z): tests/integration/api/wage-engine.test.ts; target acc_wage_ledger_v2; references `33c85aca-a752-4417-bf82-54dce2db73ac`, `c18d27fa-54fa-45b0-baf1-8c3e96907961`, `09d8b120-d0da-498c-983a-95546de1a206`, `00b15aa8-3beb-4fec-a540-f94da32badd1`, `3185e9d6-260f-4ef8-bc5d-6452ef48f6f3`, `2dc886b0-5cfd-4c6c-9520-de80447a69c0`, `021b2df3-cb55-49cb-a67b-c0771b37a045`, `fba3e729-3773-4aa5-a966-48624b9436ed`, `3c106bf8-328f-42e6-988a-844e37cb3165`, `883a5235-5002-4409-ae5c-d08247cacda3`, `2a381e2d-de41-446d-99d6-be8778b18d2e`, `4b2182a5-9f41-4b50-b709-424daed07636`, `63e32542-336e-4281-af95-ae9315ee9c65`, `4134f757-f078-4c9d-aee1-c95c68413c4d`, `15ddf4c9-ce7e-4113-b134-34388831bb89`, `fce2bdbc-da29-4f6e-bc49-2b40b2a62366`, `e92b9279-e5f9-4553-acf0-6c414b18e46c`, `7e1b9738-7f4e-4d50-aaf3-6ffe219db9fc`, `7070c0fd-243a-401e-aed0-c4da9a1c2017`, `0d380687-c1cf-4dfa-b732-01472ce00e3a`, `2eb49299-333d-49be-bb27-ba8c8861f9e1`.

- Retained test context (2026-10-11T08:06:57.379Z): tests/integration/api/wage-engine.test.ts; target acc_calculation_runs_v2; references `33c85aca-a752-4417-bf82-54dce2db73ac`, `c18d27fa-54fa-45b0-baf1-8c3e96907961`, `09d8b120-d0da-498c-983a-95546de1a206`, `00b15aa8-3beb-4fec-a540-f94da32badd1`, `3185e9d6-260f-4ef8-bc5d-6452ef48f6f3`, `2dc886b0-5cfd-4c6c-9520-de80447a69c0`, `021b2df3-cb55-49cb-a67b-c0771b37a045`, `fba3e729-3773-4aa5-a966-48624b9436ed`, `3c106bf8-328f-42e6-988a-844e37cb3165`, `883a5235-5002-4409-ae5c-d08247cacda3`, `2a381e2d-de41-446d-99d6-be8778b18d2e`, `4b2182a5-9f41-4b50-b709-424daed07636`, `63e32542-336e-4281-af95-ae9315ee9c65`, `4134f757-f078-4c9d-aee1-c95c68413c4d`, `15ddf4c9-ce7e-4113-b134-34388831bb89`, `fce2bdbc-da29-4f6e-bc49-2b40b2a62366`, `e92b9279-e5f9-4553-acf0-6c414b18e46c`, `7e1b9738-7f4e-4d50-aaf3-6ffe219db9fc`, `7070c0fd-243a-401e-aed0-c4da9a1c2017`, `0d380687-c1cf-4dfa-b732-01472ce00e3a`, `2eb49299-333d-49be-bb27-ba8c8861f9e1`.

- Retained test context (2026-10-11T08:06:57.380Z): tests/integration/api/wage-engine.test.ts; target acc_portage_bills_v2; references `eaaf4ea3-a9ed-4510-a2e1-674e26f90d2e`.

- Retained test context (2026-10-11T08:06:57.380Z): tests/integration/api/wage-engine.test.ts; target acc_engagement_pay_elements_v2; references `05455f8e-8a71-4583-9d4b-9615aec99173`, `f8f4d1bf-5c71-466a-a209-8076deb87ec9`, `d4fbe1f6-8f41-4d54-a94d-3bcbaf97d31f`, `33bcf597-23a3-43f1-b4a2-906467ffc7dd`, `3686d034-dfde-4254-8a11-53e397fe13d4`.

- Retained test context (2026-10-11T08:06:57.381Z): tests/integration/api/wage-engine.test.ts; target acc_monthly_transactions_v2; references `088b4ec8-3c4e-4b4a-b9ad-3d49d351f6d3`, `e709cb23-1fe9-434e-8fd2-aac73513dc41`, `affd8290-799f-456b-ac47-549a458e3958`, `ce2389ff-6849-42dd-960d-344809353e15`.

- Retained test context (2026-10-11T08:06:57.381Z): tests/integration/api/wage-engine.test.ts; target acc_allotments_v2; references `812142ed-3537-40e7-8ae1-f6b340a94ea7`.

- Retained test context (2026-10-11T08:06:57.382Z): tests/integration/api/wage-engine.test.ts; target acc_advances_v2; references `08151e86-cab1-47bc-bf80-60ef799cee3b`.

- Retained test context (2026-10-11T08:06:57.382Z): tests/integration/api/wage-engine.test.ts; target acc_bond_items_v2; references `b5d0c750-991d-4397-b3ee-0cf64bbcb414`.

- Retained test context (2026-10-11T08:06:57.383Z): tests/integration/api/wage-engine.test.ts; target promo_execution_ledger_v2; references `09e3b32c-6f69-4963-bea5-33b582ac1544`.

- Retained test context (2026-10-11T08:06:57.383Z): tests/integration/api/wage-engine.test.ts; target acc_engagements_v2; references `33c85aca-a752-4417-bf82-54dce2db73ac`, `c18d27fa-54fa-45b0-baf1-8c3e96907961`, `09d8b120-d0da-498c-983a-95546de1a206`, `00b15aa8-3beb-4fec-a540-f94da32badd1`, `3185e9d6-260f-4ef8-bc5d-6452ef48f6f3`, `2dc886b0-5cfd-4c6c-9520-de80447a69c0`, `021b2df3-cb55-49cb-a67b-c0771b37a045`, `fba3e729-3773-4aa5-a966-48624b9436ed`, `3c106bf8-328f-42e6-988a-844e37cb3165`, `883a5235-5002-4409-ae5c-d08247cacda3`, `2a381e2d-de41-446d-99d6-be8778b18d2e`, `4b2182a5-9f41-4b50-b709-424daed07636`, `63e32542-336e-4281-af95-ae9315ee9c65`, `4134f757-f078-4c9d-aee1-c95c68413c4d`, `15ddf4c9-ce7e-4113-b134-34388831bb89`, `fce2bdbc-da29-4f6e-bc49-2b40b2a62366`, `e92b9279-e5f9-4553-acf0-6c414b18e46c`, `7e1b9738-7f4e-4d50-aaf3-6ffe219db9fc`, `7070c0fd-243a-401e-aed0-c4da9a1c2017`, `0d380687-c1cf-4dfa-b732-01472ce00e3a`, `2eb49299-333d-49be-bb27-ba8c8861f9e1`.

- Retained test context (2026-10-11T08:06:57.383Z): tests/integration/api/wage-engine.test.ts; target crew_members_v2; references `a88347ad-0cfd-4a40-876a-a3e828074353`.

- Retained test context (2026-10-11T08:06:57.384Z): tests/integration/api/wage-engine.test.ts; target acc_wage_scale_lines_v2; references `db08b99b-3039-4bfd-8e89-06e55f9b6c6e`, `8b87c5af-07d0-4627-b495-8d01aede2329`, `bcfacb75-a567-43e6-84ff-826ef6c3d860`, `7b0d9f56-385b-41b2-bcf3-5299676d7756`.

- Retained test context (2026-10-11T08:06:57.384Z): tests/integration/api/wage-engine.test.ts; target acc_wage_scales_v2; references `db08b99b-3039-4bfd-8e89-06e55f9b6c6e`, `8b87c5af-07d0-4627-b495-8d01aede2329`, `bcfacb75-a567-43e6-84ff-826ef6c3d860`, `7b0d9f56-385b-41b2-bcf3-5299676d7756`.

- Retained test context (2026-10-11T08:06:57.384Z): tests/integration/api/wage-engine.test.ts; target acc_pay_elements_v2; references `fb958b3e-fd9b-4677-980c-6d19f784be6e`, `c330be10-3036-49a9-aed6-aca10377ec4b`, `a86fbe62-898a-4995-877e-969725982971`, `e2047e01-7961-42df-89cc-9956c86bb298`, `16809158-9091-482b-bed7-def921668fc8`, `0328eab1-e582-45c1-9147-60c2f96f1e49`, `c02ac8e2-c177-445d-a12f-c97cce7bb0e1`, `3874ec63-c7ce-4ac0-b204-b84cbda93429`, `1f37d6fa-6e98-4210-a20e-0459d478e3e5`, `7aa42522-5cf6-44f1-8337-faa8b354a564`, `e26c5a1d-1e2e-4425-bb76-57936ea416e2`, `504dbe9e-a1da-4521-bcf6-675844165fd3`, `56592ef1-520a-43d5-b85c-f2c9a77ee1b3`, `e2cacfa0-c108-4ad2-b71e-ea2663e97d0b`.

- Retained test context (2026-10-11T08:06:57.385Z): tests/integration/api/wage-engine.test.ts; target cleanup context; references `64fe0f62-d6c1-4ae1-96f3-06836b2f4ed9`.

- Retained test context (2026-10-11T08:06:58.802Z): tests/integration/api/portage-auto-lock.test.ts; target cleanup context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:58.918Z): tests/integration/api/portage-auto-lock.test.ts; target acc_wage_ledger_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:58.923Z): tests/integration/api/portage-auto-lock.test.ts; target acc_portage_approvals_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:58.924Z): tests/integration/api/portage-auto-lock.test.ts; target acc_monthly_transactions_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:58.925Z): tests/integration/api/portage-auto-lock.test.ts; target acc_ctm_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:58.925Z): tests/integration/api/portage-auto-lock.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:58.926Z): tests/integration/api/portage-auto-lock.test.ts; target acc_engagements_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:06:58.926Z): tests/integration/api/portage-auto-lock.test.ts; target acc_pay_elements_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:00.283Z): tests/integration/api/vessel-portage.test.ts; target acc_ctm_lines_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:00.284Z): tests/integration/api/vessel-portage.test.ts; target acc_ctm_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:00.285Z): tests/integration/api/vessel-portage.test.ts; target acc_monthly_transactions_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:00.285Z): tests/integration/api/vessel-portage.test.ts; target acc_wage_ledger_v2; references `5c2595e3-bb72-4932-8703-e959f74897cd`.

- Retained test context (2026-10-11T08:07:00.286Z): tests/integration/api/vessel-portage.test.ts; target acc_calculation_runs_v2; references `5e2bdd15-4988-4235-ae8d-74dd05d1030c`.

- Retained test context (2026-10-11T08:07:00.286Z): tests/integration/api/vessel-portage.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:00.287Z): tests/integration/api/vessel-portage.test.ts; target acc_engagements_v2; references `5c2595e3-bb72-4932-8703-e959f74897cd`.

- Retained test context (2026-10-11T08:07:00.287Z): tests/integration/api/vessel-portage.test.ts; target acc_wage_scale_lines_v2; references `3e21fcc3-3fc5-442a-bc1c-851ccb1604c3`.

- Retained test context (2026-10-11T08:07:00.288Z): tests/integration/api/vessel-portage.test.ts; target acc_wage_scales_v2; references `3e21fcc3-3fc5-442a-bc1c-851ccb1604c3`.

- Retained test context (2026-10-11T08:07:00.288Z): tests/integration/api/vessel-portage.test.ts; target acc_pay_elements_v2; references `469bc5d0-69e7-4fd9-b69d-2695e3f84d07`, `794c1079-e573-44f2-85a4-908f37d1f5c7`, `b036c8b6-99e2-4d19-953b-e7c3c01abb48`, `91c62a5b-b5f5-417e-b7da-3801e89ecc63`, `704395cd-51d0-495b-b680-8988f89e463d`.

- Retained test context (2026-10-11T08:07:02.495Z): tests/integration/api/contract-detail.test.ts; target acc_wage_ledger_v2; references `8b15d83c-2cb6-466c-b75c-33c576f55a4c`, `4a057092-3ba9-4ad0-840c-cd186502f183`, `53e1d7eb-8959-42ba-8663-77f759c285ae`, `24cc9a8e-8ad0-4acc-b375-4be7b3ffd82d`.

- Retained test context (2026-10-11T08:07:02.497Z): tests/integration/api/contract-detail.test.ts; target acc_engagement_pay_elements_v2; references `8b15d83c-2cb6-466c-b75c-33c576f55a4c`, `4a057092-3ba9-4ad0-840c-cd186502f183`, `53e1d7eb-8959-42ba-8663-77f759c285ae`, `24cc9a8e-8ad0-4acc-b375-4be7b3ffd82d`.

- Retained test context (2026-10-11T08:07:02.497Z): tests/integration/api/contract-detail.test.ts; target acc_portage_bills_v2; references `3abc08af-4b34-48cf-bf7b-108aabdb8360`.

- Retained test context (2026-10-11T08:07:02.498Z): tests/integration/api/contract-detail.test.ts; target acc_engagements_v2; references `8b15d83c-2cb6-466c-b75c-33c576f55a4c`, `4a057092-3ba9-4ad0-840c-cd186502f183`, `53e1d7eb-8959-42ba-8663-77f759c285ae`, `24cc9a8e-8ad0-4acc-b375-4be7b3ffd82d`.

- Retained test context (2026-10-11T08:07:02.499Z): tests/integration/api/contract-detail.test.ts; target crew_assignments; references `f229a25d-4a1f-4b8a-9f71-3e1b299ded77`.

- Retained test context (2026-10-11T08:07:02.499Z): tests/integration/api/contract-detail.test.ts; target acc_wage_scale_lines_v2; references `500e849a-5e45-4c2e-8b9b-a6657616f297`.

- Retained test context (2026-10-11T08:07:02.500Z): tests/integration/api/contract-detail.test.ts; target acc_wage_scales_v2; references `500e849a-5e45-4c2e-8b9b-a6657616f297`.

- Retained test context (2026-10-11T08:07:02.501Z): tests/integration/api/contract-detail.test.ts; target acc_pay_elements_v2; references `7c15e15b-a99e-4451-9557-412d4f9dd12d`, `5a8c018a-7aed-45ea-b1ed-2ca80e78e56d`, `78669d44-9997-4c6e-8f58-0a39815f454d`, `daed6e11-b6f7-43ac-8752-283efe2a1262`, `69f88e00-7a9a-4ea4-83ed-75fe285f8b43`.

- Retained test context (2026-10-11T08:07:02.501Z): tests/integration/api/contract-detail.test.ts; target cleanup context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:09.787Z): tests/integration/api/ctm-carry-forward.test.ts; target acc_ctm_lines_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:09.789Z): tests/integration/api/ctm-carry-forward.test.ts; target acc_ctm_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:43.366Z): tests/integration/access-control-management.test.ts; target test_ac_02b15d8280754ce3ac3f42ba56b3f533; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:48.388Z): tests/unit/company-form-planning-lock-order.test.ts; target "cf_lock_cdd8da0cba544f78a3603d92906fc775"; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:07:58.376Z): tests/integration/api/reliever-unassign-assignment.test.ts; target rotation_archive_v2; references `ac2ecf3e-3871-4998-b022-c33ba91b7b43`, `60a3b25a-2212-424b-a3e1-2b372d253b78`, `f6b4b41f-cbf3-4686-88d7-ac024a687060`, `bd7287ee-9655-4a4b-a567-4f57c697470c`, `f990fcac-5b72-47a4-aab7-fd6be1e8874e`, `b946d301-0096-4162-bca3-a1c60d21b764`, `fccff24d-4049-40e4-a27d-0984559a835d`, `1f7dcfde-f9d0-4145-a465-288a3d63664f`, `d6bb79ea-07b7-4ed6-bd55-350c7fa2d6fa`.

- Retained test context (2026-10-11T08:07:58.377Z): tests/integration/api/reliever-unassign-assignment.test.ts; target rotation_entries_v2; references `ac2ecf3e-3871-4998-b022-c33ba91b7b43`, `60a3b25a-2212-424b-a3e1-2b372d253b78`, `f6b4b41f-cbf3-4686-88d7-ac024a687060`, `bd7287ee-9655-4a4b-a567-4f57c697470c`, `f990fcac-5b72-47a4-aab7-fd6be1e8874e`, `b946d301-0096-4162-bca3-a1c60d21b764`, `fccff24d-4049-40e4-a27d-0984559a835d`, `1f7dcfde-f9d0-4145-a465-288a3d63664f`, `d6bb79ea-07b7-4ed6-bd55-350c7fa2d6fa`.

- Retained test context (2026-10-11T08:07:58.378Z): tests/integration/api/reliever-unassign-assignment.test.ts; target vessel_planning_reliever_clear_audit; references `cb1e7216-be85-4625-ba25-2523393ced4f`, `b5712eb9-67f3-446b-b1e4-99fa146ea19e`, `bdc2c318-4571-4387-a30d-9008a2991e97`, `e5d0a94b-09d0-4e55-86cc-efedf4167cfd`, `85844301-e404-462d-97f2-cd04c203fd19`, `4e16b269-ddbd-49c7-ac7a-268966afa3ad`, `131288d6-d17a-4055-bdd6-787d69360869`, `37dae973-41bf-431d-a187-69bf7b05a645`, `e3724fd0-42bd-4c69-8a4d-35276f5f70e0`, `44e51d04-d313-479a-8a48-eb9c14528ebd`, `e2f49ebe-e1b4-424c-9e62-13a2c69129f8`, `ae9f277d-2bcc-4dc6-a565-f40d1a4829c7`, `80af7fda-7842-40cb-b53a-dcb6111136f0`, `031c354c-56e7-464e-83b7-2da0b0b44e63`, `00d06422-6eef-4eaa-98a3-6541e9833310`, `59a0fc77-2cf2-495c-8b67-b25d12822429`, `53076ff5-3631-4db0-abfd-e77ed68f3d26`, `1bff3761-4821-4662-a6a7-f2585d2d2b95`, `d0153796-462f-4d05-bd7d-55f5ba785342`, `0d8013a1-de20-4db5-b49a-4afb08695f37`, `01139eaf-be1f-426f-b062-4b1dfb0314a3`, `d30036d0-4a89-453e-bcf9-aab090fdb24a`, `54081f5f-a731-43a1-92a6-f6a61e69f457`, `c617c89b-cfee-497f-af87-9ced295b85eb`, `b4cf7a08-2f88-485a-8a3c-eba081fab5c3`, `a2461a86-ce1b-4f6b-9a51-8d38c058d291`, `8cade5ff-570c-4dae-9c66-47e65955798e`, `f26e9251-c35e-492a-aa18-9fe050a2130a`, `07684df4-db02-4e07-b26c-e3b42cf8b945`, `3d8fa629-9333-4d1c-8ac0-9e5e802e9f21`, `fc1e1614-8d81-48f8-998d-5904aa1f96c5`, `cf2b1ea0-0afd-4150-ba4b-f79412454321`, `6c2c99fb-b3d6-4e0f-a424-668414b2c60e`, `c4b088b6-aee9-4a73-ba94-2352fd7b0357`, `e739a850-9a55-4c80-8a65-c2387981a1e8`, `74465cae-5195-4d88-bc83-1ac74d732cc0`, `18d60cb6-4aaa-44d1-9c71-4ebab22e52c6`, `dc4aee35-93cb-44d0-b36d-c9a70f9b4d71`, `d5b7fb5d-8e01-460b-83bc-362f49b4f6a0`, `450076a2-a634-4e0a-b39f-9fdd75664ded`, `0e747e95-0c13-4be7-a316-c0d0cd3fdb6b`, `efc1d078-8668-4e09-8fc1-ad26ee77cf57`.

- Retained test context (2026-10-11T08:07:58.379Z): tests/integration/api/reliever-unassign-assignment.test.ts; target vessel_planning_assignment_reconciliations; references `cb1e7216-be85-4625-ba25-2523393ced4f`, `b5712eb9-67f3-446b-b1e4-99fa146ea19e`, `bdc2c318-4571-4387-a30d-9008a2991e97`, `e5d0a94b-09d0-4e55-86cc-efedf4167cfd`, `85844301-e404-462d-97f2-cd04c203fd19`, `4e16b269-ddbd-49c7-ac7a-268966afa3ad`, `131288d6-d17a-4055-bdd6-787d69360869`, `37dae973-41bf-431d-a187-69bf7b05a645`, `e3724fd0-42bd-4c69-8a4d-35276f5f70e0`, `44e51d04-d313-479a-8a48-eb9c14528ebd`, `e2f49ebe-e1b4-424c-9e62-13a2c69129f8`, `ae9f277d-2bcc-4dc6-a565-f40d1a4829c7`, `80af7fda-7842-40cb-b53a-dcb6111136f0`, `031c354c-56e7-464e-83b7-2da0b0b44e63`, `00d06422-6eef-4eaa-98a3-6541e9833310`, `59a0fc77-2cf2-495c-8b67-b25d12822429`, `53076ff5-3631-4db0-abfd-e77ed68f3d26`, `1bff3761-4821-4662-a6a7-f2585d2d2b95`, `d0153796-462f-4d05-bd7d-55f5ba785342`, `0d8013a1-de20-4db5-b49a-4afb08695f37`, `01139eaf-be1f-426f-b062-4b1dfb0314a3`, `d30036d0-4a89-453e-bcf9-aab090fdb24a`, `54081f5f-a731-43a1-92a6-f6a61e69f457`, `c617c89b-cfee-497f-af87-9ced295b85eb`, `b4cf7a08-2f88-485a-8a3c-eba081fab5c3`, `a2461a86-ce1b-4f6b-9a51-8d38c058d291`, `8cade5ff-570c-4dae-9c66-47e65955798e`, `f26e9251-c35e-492a-aa18-9fe050a2130a`, `07684df4-db02-4e07-b26c-e3b42cf8b945`, `3d8fa629-9333-4d1c-8ac0-9e5e802e9f21`, `fc1e1614-8d81-48f8-998d-5904aa1f96c5`, `cf2b1ea0-0afd-4150-ba4b-f79412454321`, `6c2c99fb-b3d6-4e0f-a424-668414b2c60e`, `c4b088b6-aee9-4a73-ba94-2352fd7b0357`, `e739a850-9a55-4c80-8a65-c2387981a1e8`, `74465cae-5195-4d88-bc83-1ac74d732cc0`, `18d60cb6-4aaa-44d1-9c71-4ebab22e52c6`, `dc4aee35-93cb-44d0-b36d-c9a70f9b4d71`, `d5b7fb5d-8e01-460b-83bc-362f49b4f6a0`, `450076a2-a634-4e0a-b39f-9fdd75664ded`, `0e747e95-0c13-4be7-a316-c0d0cd3fdb6b`, `efc1d078-8668-4e09-8fc1-ad26ee77cf57`.

- Retained test context (2026-10-11T08:07:58.379Z): tests/integration/api/reliever-unassign-assignment.test.ts; target vessel_planning_v2; references `cb1e7216-be85-4625-ba25-2523393ced4f`, `b5712eb9-67f3-446b-b1e4-99fa146ea19e`, `bdc2c318-4571-4387-a30d-9008a2991e97`, `e5d0a94b-09d0-4e55-86cc-efedf4167cfd`, `85844301-e404-462d-97f2-cd04c203fd19`, `4e16b269-ddbd-49c7-ac7a-268966afa3ad`, `131288d6-d17a-4055-bdd6-787d69360869`, `37dae973-41bf-431d-a187-69bf7b05a645`, `e3724fd0-42bd-4c69-8a4d-35276f5f70e0`, `44e51d04-d313-479a-8a48-eb9c14528ebd`, `e2f49ebe-e1b4-424c-9e62-13a2c69129f8`, `ae9f277d-2bcc-4dc6-a565-f40d1a4829c7`, `80af7fda-7842-40cb-b53a-dcb6111136f0`, `031c354c-56e7-464e-83b7-2da0b0b44e63`, `00d06422-6eef-4eaa-98a3-6541e9833310`, `59a0fc77-2cf2-495c-8b67-b25d12822429`, `53076ff5-3631-4db0-abfd-e77ed68f3d26`, `1bff3761-4821-4662-a6a7-f2585d2d2b95`, `d0153796-462f-4d05-bd7d-55f5ba785342`, `0d8013a1-de20-4db5-b49a-4afb08695f37`, `01139eaf-be1f-426f-b062-4b1dfb0314a3`, `d30036d0-4a89-453e-bcf9-aab090fdb24a`, `54081f5f-a731-43a1-92a6-f6a61e69f457`, `c617c89b-cfee-497f-af87-9ced295b85eb`, `b4cf7a08-2f88-485a-8a3c-eba081fab5c3`, `a2461a86-ce1b-4f6b-9a51-8d38c058d291`, `8cade5ff-570c-4dae-9c66-47e65955798e`, `f26e9251-c35e-492a-aa18-9fe050a2130a`, `07684df4-db02-4e07-b26c-e3b42cf8b945`, `3d8fa629-9333-4d1c-8ac0-9e5e802e9f21`, `fc1e1614-8d81-48f8-998d-5904aa1f96c5`, `cf2b1ea0-0afd-4150-ba4b-f79412454321`, `6c2c99fb-b3d6-4e0f-a424-668414b2c60e`, `c4b088b6-aee9-4a73-ba94-2352fd7b0357`, `e739a850-9a55-4c80-8a65-c2387981a1e8`, `74465cae-5195-4d88-bc83-1ac74d732cc0`, `18d60cb6-4aaa-44d1-9c71-4ebab22e52c6`, `dc4aee35-93cb-44d0-b36d-c9a70f9b4d71`, `d5b7fb5d-8e01-460b-83bc-362f49b4f6a0`, `450076a2-a634-4e0a-b39f-9fdd75664ded`, `0e747e95-0c13-4be7-a316-c0d0cd3fdb6b`, `efc1d078-8668-4e09-8fc1-ad26ee77cf57`.

- Retained test context (2026-10-11T08:07:58.380Z): tests/integration/api/reliever-unassign-assignment.test.ts; target crew_assignments; references `70c8e1a1-1ee4-460c-bb45-454973459866`, `2426e89c-f1bf-4a3a-a670-96b31a433c91`, `cf774299-8d74-406f-9217-fd1e8470da71`, `29495589-0865-4d1e-9687-24814d7901c0`, `e9b97803-c5f0-42c4-a59f-a46ed24d0aef`, `bfe41c87-b93f-46d2-a963-bd7b2af2bb92`, `695c6652-0494-4fd7-aa02-c33c53c9d917`, `cb19aef5-b40f-4e7f-bc32-fba4c5e48c6c`, `dd32a91d-2a4d-46a2-a6dc-542493166408`, `2fdfd544-36b5-4104-aba4-9a4559856fe0`, `5f27d279-16b9-476e-807c-2a3e7e91cb16`, `91ed710b-63d9-4dc8-9b54-b33dd96e4bab`, `7a2dc001-e3d2-40c7-9045-d74ac129a46b`, `fd0e447a-4f02-483c-8121-c25859f3fc38`, `b542daee-5d54-4626-9231-226f98ef4da6`, `536c3438-db34-414c-88a1-5c5cd9f27147`, `d223e9a9-0f49-4caa-886c-d631704ac65b`, `af4d0917-db64-4cae-b293-ac03a0a72b8e`, `db8bc6eb-94b7-4dbe-82b6-a5cc63179c6d`, `7d24428f-23e8-45e3-996b-944b1dee16b5`, `8caeca28-7d91-4a82-bc90-7115e0973288`, `45eb1cde-731c-445b-b0b1-d54d5999e6dc`, `7d089247-acd5-403c-9624-36b2bbde3953`, `181f3044-8b37-4159-aa2c-5fb9c5bd8aea`, `4e93435d-6ac9-4e32-8221-dd836300b4e7`, `f78b716f-4e62-42dd-b100-897a4d82603a`, `4a6018bc-0c59-4a22-9a12-8fedcc7e8e91`, `fb6c842a-7192-4775-9dbb-59ccd485e6bc`, `e94c8a13-24a0-49b0-ac56-9210c303ca52`, `0cbc1d02-7e0e-4c74-8b2b-326cfa66dcee`, `3ab57249-e40c-4955-91c7-6ef5073b6f7b`, `a70fd908-96b3-45c8-8abd-18f6fba76e62`, `49a8df19-86ac-4e24-9d5d-964897df14fd`, `0b2bd766-9d05-4b01-9cd2-fc37af483d8b`, `16976d56-7c7d-43bd-b987-965d572ce02e`, `fcc7f978-eea8-4a53-8691-e67bac609834`, `5e03ab29-8748-4b7a-9cda-171c775fb71d`, `22ba49fe-f13d-4878-b9fd-5a8d2703a13e`, `add079e2-ef90-4f00-8036-3e5450536d12`, `fc33b72d-3896-4a05-91c3-70aa2121be40`, `99e91c8e-8408-41b0-9bb5-ae973f324698`, `1cb4afae-2d64-4791-bb7e-b2060d0e2968`, `a5f7d1b2-3698-4520-b197-ecdc234b130b`, `6704e7d2-a61b-4aa5-8c90-17e2287f8b15`, `6ea8fc43-ede0-44bb-8c13-b642e1aac322`.

- Retained test context (2026-10-11T08:07:58.380Z): tests/integration/api/reliever-unassign-assignment.test.ts; target crew_sea_service; references `ce222c46-231e-4502-befb-4c1832084169`, `5dc370a1-312e-4210-ba81-9e54e81a5ebe`, `37159d35-0246-4e4a-9aa8-17234ea2d675`, `eb7100aa-c827-4d6c-b47a-f25f35b72cd5`, `674427c4-6939-4408-8a98-650963bd8cf9`, `f4300a7e-a48f-4b88-9151-4967cd76b8a0`, `13826591-6c4e-41c8-931e-ce31ae74eb1e`, `b10319e7-0b0b-4f58-ad03-c8b4daf166f6`, `1a888f96-cc71-4f25-8531-bcf0c6adb6d9`, `96fd7a3b-72ae-4417-9762-9e9ae8bc803f`, `deede563-e569-4944-bc0b-13695ad2c067`, `d52052a7-a25b-47b3-8bdc-0f560d6402d6`, `286c0c41-fe3c-47d3-b83d-1a8cb8855d02`, `c0f451ab-7211-48a4-bcb0-f26471938f05`, `ae15d923-205e-4219-9204-d233767a8648`, `514f4bf1-68a7-4310-808c-28d5a61f54e9`, `4bdaed76-a24b-4cd3-9673-72de07d0e7f9`, `d68d7099-8b6b-4008-b2dc-925868163ddb`, `dac38e7e-d098-40bd-a79e-4fd1745cbff9`, `154c62da-3da9-4b7f-b8e7-794289969a93`, `b4d0056f-d093-4164-97a2-832468a4f3f8`, `d26fd94f-d8da-486c-aaa2-cf97d8da2317`, `55623659-1c66-4347-ab38-af8ad710b645`, `c2059631-7014-4182-9da9-dd8147a1a496`, `61a64b5c-0d11-45a8-9fc0-83c68e55091f`, `947631c0-f7c0-49e6-b270-c25e38bbf2e6`, `c1e33e19-35d6-48ce-9a53-c191f7cd5d68`.

- Retained test context (2026-10-11T08:07:58.380Z): tests/integration/api/reliever-unassign-assignment.test.ts; target crew_members_v2; references `ce222c46-231e-4502-befb-4c1832084169`, `5dc370a1-312e-4210-ba81-9e54e81a5ebe`, `37159d35-0246-4e4a-9aa8-17234ea2d675`, `eb7100aa-c827-4d6c-b47a-f25f35b72cd5`, `674427c4-6939-4408-8a98-650963bd8cf9`, `f4300a7e-a48f-4b88-9151-4967cd76b8a0`, `13826591-6c4e-41c8-931e-ce31ae74eb1e`, `b10319e7-0b0b-4f58-ad03-c8b4daf166f6`, `1a888f96-cc71-4f25-8531-bcf0c6adb6d9`, `96fd7a3b-72ae-4417-9762-9e9ae8bc803f`, `deede563-e569-4944-bc0b-13695ad2c067`, `d52052a7-a25b-47b3-8bdc-0f560d6402d6`, `286c0c41-fe3c-47d3-b83d-1a8cb8855d02`, `c0f451ab-7211-48a4-bcb0-f26471938f05`, `ae15d923-205e-4219-9204-d233767a8648`, `514f4bf1-68a7-4310-808c-28d5a61f54e9`, `4bdaed76-a24b-4cd3-9673-72de07d0e7f9`, `d68d7099-8b6b-4008-b2dc-925868163ddb`, `dac38e7e-d098-40bd-a79e-4fd1745cbff9`, `154c62da-3da9-4b7f-b8e7-794289969a93`, `b4d0056f-d093-4164-97a2-832468a4f3f8`, `d26fd94f-d8da-486c-aaa2-cf97d8da2317`, `55623659-1c66-4347-ab38-af8ad710b645`, `c2059631-7014-4182-9da9-dd8147a1a496`, `61a64b5c-0d11-45a8-9fc0-83c68e55091f`, `947631c0-f7c0-49e6-b270-c25e38bbf2e6`, `c1e33e19-35d6-48ce-9a53-c191f7cd5d68`.

- Retained test context (2026-10-11T08:07:58.381Z): tests/integration/api/reliever-unassign-assignment.test.ts; target master_vessels; references `43089a39-6729-400d-b3c9-4046c85ba4aa`, `b54ce872-c75d-4acf-8aba-b4a1ecb75221`, `17535fe2-25a1-498c-854e-bdec7742063d`, `84443c82-61b6-4670-bd74-6eae29fb0245`, `837ac867-5772-4bd8-9342-1889afd1c798`, `f67fe4c5-0a40-4301-8330-37ba5b81da42`, `ea5040a6-de86-4a34-9453-14b9774b15f6`, `32ebdd9e-3b38-42f0-aa6f-08b09d437fa7`, `9b997fc2-da5d-4561-a2b5-d7420f1d8d64`, `4a8e0993-0b0e-49e9-b191-eac96f1d7092`, `11aaf179-9282-49b3-9470-77cddad7da58`, `47ce8029-b076-476e-8542-af68e5ca4ed6`, `0e0f52ed-759d-4b1f-b6d4-f0e1eb9ad4f7`, `99838ad1-478a-47e6-b455-d827d5eb6ba6`, `07409429-dd27-42f6-97f0-c771eb4244e5`, `36a5e527-9d49-477b-a332-8533cdb013e4`, `86aec264-3e41-47e8-bc9b-5b0daafc02ee`, `42d0b94c-4fbf-4d59-a6dd-1b88de95deee`, `374e6540-abf1-4e02-b2ca-8d9f4a3fb41c`, `d477ad39-0810-4bea-804d-d475908d694c`, `7ff9e4ee-8d3f-4013-b10e-e606365492b9`, `cc12ea46-7f93-485e-a9a7-8c4a348cb0d7`, `e9bd40b3-94b9-4837-85a0-212bf0bf30a5`, `f13644d7-24fa-424f-b93e-8b3069d5d770`, `60f96cce-db34-4441-b3ac-a2a72b0099f3`, `5e2dbb27-2516-46e8-91d4-9c6d82bd1ed1`, `55815e93-d9f9-4ce7-b55d-7ebc8f5b7b31`, `7c930e09-ba93-4fa9-b745-6f32920eefe8`, `7badffb6-0682-4977-a719-e181feb6ab0a`, `392097a2-8880-41e8-ad0e-8982f2d2a424`, `e8d12c15-ed88-46fc-b6f5-20f23d310d17`, `937857d8-ea54-40a2-b6e9-6294e7582cf4`, `0bb53520-c601-42d8-afcb-70c47265cbe4`, `cc496266-7bdd-4182-820d-bb601f340852`, `5cc8b7bf-0b74-43ad-8570-9a7b64ba372c`.

- Retained test context (2026-10-11T08:07:58.381Z): tests/integration/api/reliever-unassign-assignment.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:06.437Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_signatures; references `86593142-894a-413f-83c9-e5d72fb81b6a`, `2bc22bfa-a33d-486f-966f-421cc1d7aab3`.

- Retained test context (2026-10-11T08:08:06.438Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_signature_attachments; references `86593142-894a-413f-83c9-e5d72fb81b6a`, `2bc22bfa-a33d-486f-966f-421cc1d7aab3`.

- Retained test context (2026-10-11T08:08:06.438Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_answers; references `9df70b1b-3e5b-46ba-ad76-c5df6756dd6c`, `d339f808-e6b7-4e2e-8176-a3b5a007f60a`, `5b3542fa-d4bb-483f-a35c-e5e4d248a3da`, `3bfa6d18-0a4e-4a43-a2d9-d5d305bdeb23`.

- Retained test context (2026-10-11T08:08:06.439Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_states; references `9df70b1b-3e5b-46ba-ad76-c5df6756dd6c`, `d339f808-e6b7-4e2e-8176-a3b5a007f60a`, `5b3542fa-d4bb-483f-a35c-e5e4d248a3da`, `3bfa6d18-0a4e-4a43-a2d9-d5d305bdeb23`.

- Retained test context (2026-10-11T08:08:06.439Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_answers; references `3a034b20-a388-4caf-bc63-c94f849c60e6`.

- Retained test context (2026-10-11T08:08:06.439Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_states; references `3a034b20-a388-4caf-bc63-c94f849c60e6`.

- Retained test context (2026-10-11T08:08:06.440Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_company_submission_assignments; references `d79c5644-f35e-4027-98f3-e070799defd3`, `9f04e56f-15a5-4cb6-955e-0bf19a3731dc`, `21e30963-aded-416d-b668-76a383d9323e`, `51aaa993-85e4-46dd-b31b-0aef5ae974fd`, `a6684398-885d-4221-9a87-839f6db09f14`.

- Retained test context (2026-10-11T08:08:06.440Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_company_submissions; references `d79c5644-f35e-4027-98f3-e070799defd3`, `9f04e56f-15a5-4cb6-955e-0bf19a3731dc`, `21e30963-aded-416d-b668-76a383d9323e`, `51aaa993-85e4-46dd-b31b-0aef5ae974fd`, `a6684398-885d-4221-9a87-839f6db09f14`.

- Retained test context (2026-10-11T08:08:06.441Z): tests/integration/api/company-form-submission-starts.test.ts; target crew_assignments; references `d79c5644-f35e-4027-98f3-e070799defd3`, `9f04e56f-15a5-4cb6-955e-0bf19a3731dc`, `21e30963-aded-416d-b668-76a383d9323e`, `51aaa993-85e4-46dd-b31b-0aef5ae974fd`, `a6684398-885d-4221-9a87-839f6db09f14`.

- Retained test context (2026-10-11T08:08:06.441Z): tests/integration/api/company-form-submission-starts.test.ts; target crew_members_v2; references `131379f3-f3eb-40c7-b8db-41a8f3c5241b`.

- Retained test context (2026-10-11T08:08:06.442Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_questions; references `79690038-38ff-41cc-8872-6f0fbff72029`, `32299ef0-ab84-474a-b7d1-e6148f332da3`, `8c7ff623-7684-4df7-88b8-7867c28ea165`, `ecb8452e-eadb-4a92-ac47-af6fb6049bcb`.

- Retained test context (2026-10-11T08:08:06.442Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_sections; references `79690038-38ff-41cc-8872-6f0fbff72029`, `32299ef0-ab84-474a-b7d1-e6148f332da3`, `8c7ff623-7684-4df7-88b8-7867c28ea165`, `ecb8452e-eadb-4a92-ac47-af6fb6049bcb`.

- Retained test context (2026-10-11T08:08:06.442Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_options; references `613105e3-0b27-4f07-951d-653441df2923`, `98d9fcf7-337e-4712-83aa-1dc83ba9aa79`, `a821c934-e080-4dc9-9c0c-568a12da8b05`, `028fb172-9d4a-44a7-a801-bb3474c893bb`.

- Retained test context (2026-10-11T08:08:06.443Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_option_sets; references `613105e3-0b27-4f07-951d-653441df2923`, `98d9fcf7-337e-4712-83aa-1dc83ba9aa79`, `a821c934-e080-4dc9-9c0c-568a12da8b05`, `028fb172-9d4a-44a7-a801-bb3474c893bb`.

- Retained test context (2026-10-11T08:08:06.443Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_form_parts; references `58edbed4-e849-412f-a481-c30045692808`, `6686bc9f-aee4-46c2-aa70-13addc929019`, `1f4d737d-d095-40d6-9d4b-3e93444a4ad6`, `02bc7cb1-04e4-4827-bc32-d3b68fcf290f`.

- Retained test context (2026-10-11T08:08:06.444Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessel_types; references `16877b4d-248b-4524-bdd3-68d61628dba3`.

- Retained test context (2026-10-11T08:08:06.444Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_form_versions_v2; references `6de67188-4ea7-40ab-9279-6d9d84552279`, `aeef9621-57e4-41bc-b045-983b29663ebc`, `78733310-d690-4419-802c-c0178eb22650`, `e14ac01a-56c8-44b7-9b9e-f83cf543b8f9`, `a103a969-56a2-430b-8bd9-a7ab3132592f`.

- Retained test context (2026-10-11T08:08:06.444Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_forms_v2; references `c48e6854-6f0d-4b85-95c7-b1ebcb095c18`, `559502f3-a796-432a-9904-6d1c8559b35a`, `99447210-5922-44b2-9b13-dd82ac2f436a`.

- Retained test context (2026-10-11T08:08:06.445Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_resource_action_grants; references `2954b5f6-2ee3-4b28-8650-df23113237af`, `3a5b0d31-46fa-4751-bd72-cfc78757c273`, `123e7fea-f57d-413d-870f-f5562ce47c25`, `c88d3b58-b991-4893-b02f-4d44ab71c2c7`, `238a3dc0-0824-4f86-abd0-3c38c981b3da`.

- Retained test context (2026-10-11T08:08:06.445Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_roleaccess_ac; references `2954b5f6-2ee3-4b28-8650-df23113237af`, `3a5b0d31-46fa-4751-bd72-cfc78757c273`, `123e7fea-f57d-413d-870f-f5562ce47c25`, `c88d3b58-b991-4893-b02f-4d44ab71c2c7`, `238a3dc0-0824-4f86-abd0-3c38c981b3da`.

- Retained test context (2026-10-11T08:08:06.446Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_rolemaster_ac; references `2954b5f6-2ee3-4b28-8650-df23113237af`, `3a5b0d31-46fa-4751-bd72-cfc78757c273`, `123e7fea-f57d-413d-870f-f5562ce47c25`, `c88d3b58-b991-4893-b02f-4d44ab71c2c7`, `238a3dc0-0824-4f86-abd0-3c38c981b3da`.

- Retained test context (2026-10-11T08:08:06.446Z): tests/integration/api/company-form-submission-starts.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:06.447Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessels; references `89eacfab-8dec-402c-80a4-5c65089f0494`.

- Retained test context (2026-10-11T08:08:06.447Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessels; references `344b3ece-700b-439b-a4f3-d4e2ccbca886`.

- Retained test context (2026-10-11T08:08:06.452Z): tests/integration/api/company-form-submission-starts.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:13.495Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:13.496Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:13.497Z): tests/integration/api/company-form-signing-and-completion.test.ts; target cleanup context; references `988890f7-fb78-4677-a7d0-e2f73d285933`, `1135a674-8d64-4284-9e3c-addb76988de9`, `dbf52882-8b15-4569-ab81-ca240d773b10`, `a6c1438a-ef04-434a-88e2-9e4deba09087`, `0928676d-4c1b-4556-8180-9894d7ca6aa9`.

- Retained test context (2026-10-11T08:08:13.498Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_signatures; references `988890f7-fb78-4677-a7d0-e2f73d285933`, `1135a674-8d64-4284-9e3c-addb76988de9`, `dbf52882-8b15-4569-ab81-ca240d773b10`, `a6c1438a-ef04-434a-88e2-9e4deba09087`, `0928676d-4c1b-4556-8180-9894d7ca6aa9`.

- Retained test context (2026-10-11T08:08:13.498Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_signature_attachments; references `9ca86b39-4fb8-4f54-8d04-3e0a167e9798`, `3b9b0992-7737-4ae2-863d-49dd153b4326`, `0546f63d-eebd-407a-97fa-71c4d8d47a70`, `7d3b674b-510a-43bc-9545-2b40e8ad797b`, `40b894e8-caf6-488f-8ed7-9ee64f25b873`, `48af25cf-0084-40fb-9330-2bf9efdf9d87`.

- Retained test context (2026-10-11T08:08:13.499Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references `988890f7-fb78-4677-a7d0-e2f73d285933`, `1135a674-8d64-4284-9e3c-addb76988de9`, `dbf52882-8b15-4569-ab81-ca240d773b10`, `a6c1438a-ef04-434a-88e2-9e4deba09087`, `0928676d-4c1b-4556-8180-9894d7ca6aa9`.

- Retained test context (2026-10-11T08:08:13.499Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_answers; references `988890f7-fb78-4677-a7d0-e2f73d285933`, `1135a674-8d64-4284-9e3c-addb76988de9`, `dbf52882-8b15-4569-ab81-ca240d773b10`, `a6c1438a-ef04-434a-88e2-9e4deba09087`, `0928676d-4c1b-4556-8180-9894d7ca6aa9`.

- Retained test context (2026-10-11T08:08:13.499Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_states; references `988890f7-fb78-4677-a7d0-e2f73d285933`, `1135a674-8d64-4284-9e3c-addb76988de9`, `dbf52882-8b15-4569-ab81-ca240d773b10`, `a6c1438a-ef04-434a-88e2-9e4deba09087`, `0928676d-4c1b-4556-8180-9894d7ca6aa9`.

- Retained test context (2026-10-11T08:08:13.500Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_assignments; references `988890f7-fb78-4677-a7d0-e2f73d285933`, `1135a674-8d64-4284-9e3c-addb76988de9`, `dbf52882-8b15-4569-ab81-ca240d773b10`, `a6c1438a-ef04-434a-88e2-9e4deba09087`, `0928676d-4c1b-4556-8180-9894d7ca6aa9`.

- Retained test context (2026-10-11T08:08:13.500Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references `988890f7-fb78-4677-a7d0-e2f73d285933`, `1135a674-8d64-4284-9e3c-addb76988de9`, `dbf52882-8b15-4569-ab81-ca240d773b10`, `a6c1438a-ef04-434a-88e2-9e4deba09087`, `0928676d-4c1b-4556-8180-9894d7ca6aa9`.

- Retained test context (2026-10-11T08:08:13.501Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_questions; references `b5d7436e-ea43-45c3-b83f-93870e211c6b`, `b4d01cb0-ee9c-4e9e-9c11-7c8b9e9ba066`, `6400edf8-0d41-486c-bb70-dc8f7ffd5387`, `546da675-fd87-45cb-85ae-43257b0e8253`.

- Retained test context (2026-10-11T08:08:13.501Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_sections; references `b5d7436e-ea43-45c3-b83f-93870e211c6b`, `b4d01cb0-ee9c-4e9e-9c11-7c8b9e9ba066`, `6400edf8-0d41-486c-bb70-dc8f7ffd5387`, `546da675-fd87-45cb-85ae-43257b0e8253`.

- Retained test context (2026-10-11T08:08:13.502Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_form_parts; references `b5d7436e-ea43-45c3-b83f-93870e211c6b`, `b4d01cb0-ee9c-4e9e-9c11-7c8b9e9ba066`, `6400edf8-0d41-486c-bb70-dc8f7ffd5387`, `546da675-fd87-45cb-85ae-43257b0e8253`.

- Retained test context (2026-10-11T08:08:13.504Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_form_versions_v2; references `b5d7436e-ea43-45c3-b83f-93870e211c6b`, `b4d01cb0-ee9c-4e9e-9c11-7c8b9e9ba066`, `6400edf8-0d41-486c-bb70-dc8f7ffd5387`, `546da675-fd87-45cb-85ae-43257b0e8253`.

- Retained test context (2026-10-11T08:08:13.504Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_forms_v2; references `d3f5049b-0243-40a0-be7d-bdf7cbb68963`, `3bde17fc-0889-49e2-b4a7-39f66c6a17b0`.

- Retained test context (2026-10-11T08:08:13.505Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_assignments; references `7f0a20eb-ec31-45de-b6c1-85619195531a`, `21ed2384-8a9e-447e-86d0-da841554cc5f`, `8d678240-6cea-4f46-be93-0c976957f1b4`, `f78def2e-8fb9-4f7e-bbf8-1bcc7be073b3`.

- Retained test context (2026-10-11T08:08:13.505Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_members_v2; references `941e7fc7-037d-4fae-ba62-092218ea164b`.

- Retained test context (2026-10-11T08:08:13.506Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `a80e8035-691c-4c61-aa60-50588ad8872a`.

- Retained test context (2026-10-11T08:08:13.506Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `6aff8aa8-1ee1-49d4-b616-e04f6ff54671`.

- Retained test context (2026-10-11T08:08:13.507Z): tests/integration/api/company-form-signing-and-completion.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:13.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_resource_action_grants; references `4ce9cb04-5ae5-4835-9cf1-b9465803c049`, `8d4bdfc7-f231-422b-a283-d9ce3b03b6eb`, `9a3a2b39-7440-491a-b1a1-bcdb79c4830a`, `c0701ab3-3bc5-4935-be10-dafd0270b270`.

- Retained test context (2026-10-11T08:08:13.509Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_roleaccess_ac; references `4ce9cb04-5ae5-4835-9cf1-b9465803c049`, `8d4bdfc7-f231-422b-a283-d9ce3b03b6eb`, `9a3a2b39-7440-491a-b1a1-bcdb79c4830a`, `c0701ab3-3bc5-4935-be10-dafd0270b270`.

- Retained test context (2026-10-11T08:08:13.510Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:13.510Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_rolemaster_ac; references `4ce9cb04-5ae5-4835-9cf1-b9465803c049`, `8d4bdfc7-f231-422b-a283-d9ce3b03b6eb`, `9a3a2b39-7440-491a-b1a1-bcdb79c4830a`, `c0701ab3-3bc5-4935-be10-dafd0270b270`.

- Retained test context (2026-10-11T08:08:17.201Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `20261f25-5457-4515-9af4-179a49148708`.

- Retained test context (2026-10-11T08:08:17.203Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `20261f25-5457-4515-9af4-179a49148708`.

- Retained test context (2026-10-11T08:08:17.203Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `20261f25-5457-4515-9af4-179a49148708`.

- Retained test context (2026-10-11T08:08:17.204Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `20261f25-5457-4515-9af4-179a49148708`.

- Retained test context (2026-10-11T08:08:17.205Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `20261f25-5457-4515-9af4-179a49148708`.

- Retained test context (2026-10-11T08:08:17.206Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `2ef633fb-a193-425f-ae41-4288c0122681`.

- Retained test context (2026-10-11T08:08:17.207Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `2ef633fb-a193-425f-ae41-4288c0122681`.

- Retained test context (2026-10-11T08:08:17.208Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `2ef633fb-a193-425f-ae41-4288c0122681`.

- Retained test context (2026-10-11T08:08:17.208Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `2ef633fb-a193-425f-ae41-4288c0122681`.

- Retained test context (2026-10-11T08:08:17.209Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `2ef633fb-a193-425f-ae41-4288c0122681`.

- Retained test context (2026-10-11T08:08:17.209Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `f6a1e111-5942-41d1-a712-2b38cfb5f354`.

- Retained test context (2026-10-11T08:08:17.210Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `f6a1e111-5942-41d1-a712-2b38cfb5f354`.

- Retained test context (2026-10-11T08:08:17.211Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `f6a1e111-5942-41d1-a712-2b38cfb5f354`.

- Retained test context (2026-10-11T08:08:17.211Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `f6a1e111-5942-41d1-a712-2b38cfb5f354`.

- Retained test context (2026-10-11T08:08:17.211Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `f6a1e111-5942-41d1-a712-2b38cfb5f354`.

- Retained test context (2026-10-11T08:08:17.212Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `d4948ae5-ce07-45a3-83bb-e5e7a560558f`.

- Retained test context (2026-10-11T08:08:17.213Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `d4948ae5-ce07-45a3-83bb-e5e7a560558f`.

- Retained test context (2026-10-11T08:08:17.213Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `d4948ae5-ce07-45a3-83bb-e5e7a560558f`.

- Retained test context (2026-10-11T08:08:17.214Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `d4948ae5-ce07-45a3-83bb-e5e7a560558f`.

- Retained test context (2026-10-11T08:08:17.214Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `d4948ae5-ce07-45a3-83bb-e5e7a560558f`.

- Retained test context (2026-10-11T08:08:17.215Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `06c31d6b-586f-4ffa-a6db-a28b1ffb122e`.

- Retained test context (2026-10-11T08:08:17.215Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `06c31d6b-586f-4ffa-a6db-a28b1ffb122e`.

- Retained test context (2026-10-11T08:08:17.216Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `06c31d6b-586f-4ffa-a6db-a28b1ffb122e`.

- Retained test context (2026-10-11T08:08:17.216Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `06c31d6b-586f-4ffa-a6db-a28b1ffb122e`.

- Retained test context (2026-10-11T08:08:17.217Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `06c31d6b-586f-4ffa-a6db-a28b1ffb122e`.

- Retained test context (2026-10-11T08:08:17.217Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `8f2f1c57-7730-414e-ada9-4b62c308cf23`.

- Retained test context (2026-10-11T08:08:17.218Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `8f2f1c57-7730-414e-ada9-4b62c308cf23`.

- Retained test context (2026-10-11T08:08:17.218Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `8f2f1c57-7730-414e-ada9-4b62c308cf23`.

- Retained test context (2026-10-11T08:08:17.219Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `8f2f1c57-7730-414e-ada9-4b62c308cf23`.

- Retained test context (2026-10-11T08:08:17.219Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `8f2f1c57-7730-414e-ada9-4b62c308cf23`.

- Retained test context (2026-10-11T08:08:17.220Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `b1bed20f-52bd-4f23-8cea-c48f838adb2e`.

- Retained test context (2026-10-11T08:08:17.220Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `b1bed20f-52bd-4f23-8cea-c48f838adb2e`.

- Retained test context (2026-10-11T08:08:17.221Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `b1bed20f-52bd-4f23-8cea-c48f838adb2e`.

- Retained test context (2026-10-11T08:08:17.221Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `b1bed20f-52bd-4f23-8cea-c48f838adb2e`.

- Retained test context (2026-10-11T08:08:17.221Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `b1bed20f-52bd-4f23-8cea-c48f838adb2e`.

- Retained test context (2026-10-11T08:08:17.222Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `d33626d2-994b-4d5f-bada-24e70a368c2b`.

- Retained test context (2026-10-11T08:08:17.222Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `d33626d2-994b-4d5f-bada-24e70a368c2b`.

- Retained test context (2026-10-11T08:08:17.222Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `d33626d2-994b-4d5f-bada-24e70a368c2b`.

- Retained test context (2026-10-11T08:08:17.223Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `d33626d2-994b-4d5f-bada-24e70a368c2b`.

- Retained test context (2026-10-11T08:08:17.223Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `d33626d2-994b-4d5f-bada-24e70a368c2b`.

- Retained test context (2026-10-11T08:08:17.224Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `69e5b589-c968-40af-a181-b4db04165134`.

- Retained test context (2026-10-11T08:08:17.225Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `69e5b589-c968-40af-a181-b4db04165134`.

- Retained test context (2026-10-11T08:08:17.225Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `69e5b589-c968-40af-a181-b4db04165134`.

- Retained test context (2026-10-11T08:08:17.226Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `69e5b589-c968-40af-a181-b4db04165134`.

- Retained test context (2026-10-11T08:08:17.226Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `69e5b589-c968-40af-a181-b4db04165134`.

- Retained test context (2026-10-11T08:08:17.227Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `8ebde531-2397-48a2-8af5-d8878a2e5386`.

- Retained test context (2026-10-11T08:08:17.227Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `8ebde531-2397-48a2-8af5-d8878a2e5386`.

- Retained test context (2026-10-11T08:08:17.228Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `8ebde531-2397-48a2-8af5-d8878a2e5386`.

- Retained test context (2026-10-11T08:08:17.229Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `8ebde531-2397-48a2-8af5-d8878a2e5386`.

- Retained test context (2026-10-11T08:08:17.230Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `8ebde531-2397-48a2-8af5-d8878a2e5386`.

- Retained test context (2026-10-11T08:08:20.012Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_section_signatures; references `cf67921d-4561-4864-9eef-5d25cfc4f69e`, `de62c643-9697-48c7-9c83-6c3c55d81c88`.

- Retained test context (2026-10-11T08:08:20.013Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_answers; references `cf67921d-4561-4864-9eef-5d25cfc4f69e`, `de62c643-9697-48c7-9c83-6c3c55d81c88`.

- Retained test context (2026-10-11T08:08:20.014Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_section_states; references `cf67921d-4561-4864-9eef-5d25cfc4f69e`, `de62c643-9697-48c7-9c83-6c3c55d81c88`.

- Retained test context (2026-10-11T08:08:20.014Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_company_submission_assignments; references `cf67921d-4561-4864-9eef-5d25cfc4f69e`, `de62c643-9697-48c7-9c83-6c3c55d81c88`.

- Retained test context (2026-10-11T08:08:20.015Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_company_submissions; references `cf67921d-4561-4864-9eef-5d25cfc4f69e`, `de62c643-9697-48c7-9c83-6c3c55d81c88`.

- Retained test context (2026-10-11T08:08:20.016Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_signature_attachments; references `1d19a521-6489-498d-a773-d97333b9a13a`.

- Retained test context (2026-10-11T08:08:20.016Z): tests/integration/api/company-form-submission-boundary.test.ts; target crew_assignments; references `35d40f4e-87bc-48f1-a073-c1e1519ba59e`, `90503fe8-1ea6-444f-b7de-3cd3b181d199`.

- Retained test context (2026-10-11T08:08:20.017Z): tests/integration/api/company-form-submission-boundary.test.ts; target crew_members_v2; references `60eb44b6-7c7c-4cdd-9d9c-485c8cb4f118`.

- Retained test context (2026-10-11T08:08:20.017Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_questions; references `6c78efd1-8b0c-46f4-b0f7-f2d47551fea8`.

- Retained test context (2026-10-11T08:08:20.018Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_sections; references `ef23ce92-19bc-4e82-8013-d720523d6c99`.

- Retained test context (2026-10-11T08:08:20.018Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_form_parts; references `9273f113-ba2d-4f2b-b36e-dfb565c493c2`.

- Retained test context (2026-10-11T08:08:20.019Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_options; references `b45696b9-50f2-4190-8f4a-6924baed5425`.

- Retained test context (2026-10-11T08:08:20.019Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_option_sets; references `b45696b9-50f2-4190-8f4a-6924baed5425`.

- Retained test context (2026-10-11T08:08:20.020Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_form_versions_v2; references `fa14fb68-6d47-492e-8c44-adf587d56401`.

- Retained test context (2026-10-11T08:08:20.020Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_forms_v2; references `c77a115a-94de-4528-bd93-c27e6071923f`.

- Retained test context (2026-10-11T08:08:20.021Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_resource_action_grants; references `6f127f37-9cea-47dc-a02d-4d637f8236a7`, `6ff0f7cf-e0ea-4e14-9f12-648403d78597`, `814b7210-08a4-44ed-bda0-c735789cd448`, `b140589c-de6d-4437-8e8f-ad6db89e2e6b`, `35a63f85-b17d-4588-ab29-f882000d2f91`, `cad0ccb7-14ad-44de-a6ba-077a301a8080`, `74af8555-0f5d-4a33-9a77-843d07c2afa1`.

- Retained test context (2026-10-11T08:08:20.021Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_roleaccess_ac; references `6f127f37-9cea-47dc-a02d-4d637f8236a7`, `6ff0f7cf-e0ea-4e14-9f12-648403d78597`, `814b7210-08a4-44ed-bda0-c735789cd448`, `b140589c-de6d-4437-8e8f-ad6db89e2e6b`, `35a63f85-b17d-4588-ab29-f882000d2f91`, `cad0ccb7-14ad-44de-a6ba-077a301a8080`, `74af8555-0f5d-4a33-9a77-843d07c2afa1`.

- Retained test context (2026-10-11T08:08:20.022Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_rolemaster_ac; references `6f127f37-9cea-47dc-a02d-4d637f8236a7`, `6ff0f7cf-e0ea-4e14-9f12-648403d78597`, `814b7210-08a4-44ed-bda0-c735789cd448`, `b140589c-de6d-4437-8e8f-ad6db89e2e6b`, `35a63f85-b17d-4588-ab29-f882000d2f91`, `cad0ccb7-14ad-44de-a6ba-077a301a8080`, `74af8555-0f5d-4a33-9a77-843d07c2afa1`.

- Retained test context (2026-10-11T08:08:20.022Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:20.023Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessels; references `24c5269d-53fb-4ae7-b6e8-82284b98549a`.

- Retained test context (2026-10-11T08:08:20.023Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessels; references `e7f6150f-43d0-488c-b83c-171a5fc47962`.

- Retained test context (2026-10-11T08:08:20.023Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessel_types; references `2825d496-6a13-486f-a396-4cbb0a9b286d`.

- Retained test context (2026-10-11T08:08:20.028Z): tests/integration/api/company-form-submission-boundary.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:22.423Z): tests/integration/api/company-form-submission-void-races.test.ts; target cleanup context; references `d933e5ef-6d8d-460b-aa06-dc044e333ebf`.

- Retained test context (2026-10-11T08:08:22.512Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_section_signatures; references `fefd9293-ddb0-4c61-9e5a-ea88f733c2fb`, `c274250c-8b91-47bc-b323-eba6caa42b21`, `ca13b8b0-b750-48c7-b075-a5413447e1d8`, `731ee774-48f4-4f66-9ca3-41d6658707cf`.

- Retained test context (2026-10-11T08:08:22.512Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_answers; references `fefd9293-ddb0-4c61-9e5a-ea88f733c2fb`, `c274250c-8b91-47bc-b323-eba6caa42b21`, `ca13b8b0-b750-48c7-b075-a5413447e1d8`, `731ee774-48f4-4f66-9ca3-41d6658707cf`.

- Retained test context (2026-10-11T08:08:22.513Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submission_system_snapshots; references `fefd9293-ddb0-4c61-9e5a-ea88f733c2fb`, `c274250c-8b91-47bc-b323-eba6caa42b21`, `ca13b8b0-b750-48c7-b075-a5413447e1d8`, `731ee774-48f4-4f66-9ca3-41d6658707cf`.

- Retained test context (2026-10-11T08:08:22.513Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_section_states; references `fefd9293-ddb0-4c61-9e5a-ea88f733c2fb`, `c274250c-8b91-47bc-b323-eba6caa42b21`, `ca13b8b0-b750-48c7-b075-a5413447e1d8`, `731ee774-48f4-4f66-9ca3-41d6658707cf`.

- Retained test context (2026-10-11T08:08:22.513Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submission_assignments; references `fefd9293-ddb0-4c61-9e5a-ea88f733c2fb`, `c274250c-8b91-47bc-b323-eba6caa42b21`, `ca13b8b0-b750-48c7-b075-a5413447e1d8`, `731ee774-48f4-4f66-9ca3-41d6658707cf`.

- Retained test context (2026-10-11T08:08:22.514Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submissions; references `fefd9293-ddb0-4c61-9e5a-ea88f733c2fb`, `c274250c-8b91-47bc-b323-eba6caa42b21`, `ca13b8b0-b750-48c7-b075-a5413447e1d8`, `731ee774-48f4-4f66-9ca3-41d6658707cf`.

- Retained test context (2026-10-11T08:08:22.514Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_signature_attachments; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:22.515Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_questions; references `d655bb74-1ce0-4fea-8ece-248dd226e87b`.

- Retained test context (2026-10-11T08:08:22.515Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_sections; references `b55ccd53-c3ff-4cc1-95b6-ce64af0401c3`.

- Retained test context (2026-10-11T08:08:22.516Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_form_parts; references `8aec0758-f901-47e2-95f1-df17888a291c`.

- Retained test context (2026-10-11T08:08:22.516Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_form_versions_v2; references `7532c376-888f-4da7-a99a-a44b15ba65b0`.

- Retained test context (2026-10-11T08:08:22.516Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_forms_v2; references `5dd2ba75-47b0-414c-94d9-804641f3ac44`.

- Retained test context (2026-10-11T08:08:22.517Z): tests/integration/api/company-form-submission-void-races.test.ts; target crew_assignments; references `b2575571-1075-4ca1-bac0-ded618fb493c`, `0d381cef-1fea-4d68-8b30-cfd1ead933a9`, `9712015b-ba56-4bfe-94fd-329c839fb5a5`, `e01a737b-f1e2-40c2-b65b-e4b101be05d4`.

- Retained test context (2026-10-11T08:08:22.517Z): tests/integration/api/company-form-submission-void-races.test.ts; target crew_members_v2; references `2e414628-f511-4259-b965-ae6768803806`.

- Retained test context (2026-10-11T08:08:22.518Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_resource_action_grants; references `d933e5ef-6d8d-460b-aa06-dc044e333ebf`, `b4119ab9-2400-4b8a-bd8b-452694ea5397`.

- Retained test context (2026-10-11T08:08:22.518Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_roleaccess_ac; references `d933e5ef-6d8d-460b-aa06-dc044e333ebf`.

- Retained test context (2026-10-11T08:08:22.519Z): tests/integration/api/company-form-submission-void-races.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:22.519Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_rolemaster_ac; references `d933e5ef-6d8d-460b-aa06-dc044e333ebf`, `b4119ab9-2400-4b8a-bd8b-452694ea5397`.

- Retained test context (2026-10-11T08:08:22.519Z): tests/integration/api/company-form-submission-void-races.test.ts; target master_vessels; references `d0e10147-9d0f-416d-b65f-59213a40ab24`.

- Retained test context (2026-10-11T08:08:22.523Z): tests/integration/api/company-form-submission-void-races.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:25.254Z): tests/integration/company-form-stage-less-runtime.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:25.354Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submission_system_snapshots; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:25.355Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submission_system_snapshots; references `10bef26c-e193-4b73-8e25-f03ae3b3473a`, `7ccb20c6-b134-4395-8304-049f0319f349`, `57c13057-e94e-466f-8b71-47b87a8d69c5`, `d5881f5a-d2d5-4a82-af07-09856b15eb3d`, `333bb83d-e86f-4800-9581-1149852ff359`.

- Retained test context (2026-10-11T08:08:25.356Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_section_signatures; references `10bef26c-e193-4b73-8e25-f03ae3b3473a`, `7ccb20c6-b134-4395-8304-049f0319f349`, `57c13057-e94e-466f-8b71-47b87a8d69c5`, `d5881f5a-d2d5-4a82-af07-09856b15eb3d`, `333bb83d-e86f-4800-9581-1149852ff359`.

- Retained test context (2026-10-11T08:08:25.358Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_answers; references `10bef26c-e193-4b73-8e25-f03ae3b3473a`, `7ccb20c6-b134-4395-8304-049f0319f349`, `57c13057-e94e-466f-8b71-47b87a8d69c5`, `d5881f5a-d2d5-4a82-af07-09856b15eb3d`, `333bb83d-e86f-4800-9581-1149852ff359`.

- Retained test context (2026-10-11T08:08:25.359Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_section_states; references `10bef26c-e193-4b73-8e25-f03ae3b3473a`, `7ccb20c6-b134-4395-8304-049f0319f349`, `57c13057-e94e-466f-8b71-47b87a8d69c5`, `d5881f5a-d2d5-4a82-af07-09856b15eb3d`, `333bb83d-e86f-4800-9581-1149852ff359`.

- Retained test context (2026-10-11T08:08:25.359Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submissions; references `10bef26c-e193-4b73-8e25-f03ae3b3473a`, `7ccb20c6-b134-4395-8304-049f0319f349`, `57c13057-e94e-466f-8b71-47b87a8d69c5`, `d5881f5a-d2d5-4a82-af07-09856b15eb3d`, `333bb83d-e86f-4800-9581-1149852ff359`.

- Retained test context (2026-10-11T08:08:25.360Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_signature_attachments; references `fc37893d-240e-474b-b22c-00c3140084be`, `e567e6a6-5af6-448f-951e-2f71ffc2ba75`, `baefe33a-cafd-422c-ac94-2948dd69addc`, `7d5e296c-d54f-4b5e-af9d-d1e3708e714a`, `7d4258f2-dd51-4bff-a0f3-24ab4a982a15`, `e74a0029-ee3f-4563-859a-e1629486a7f2`.

- Retained test context (2026-10-11T08:08:25.360Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_questions; references `7774335a-7ec3-4efb-9ea4-cac1b47ce00a`, `91116315-1bbe-47f4-8723-e89cfb6f4b16`, `df966e0f-fc20-44e8-badd-bf89d39b7efa`, `dc4ecd0f-5b51-4b18-97d5-f44770341735`, `b9e22f4e-8ac5-4031-be10-8384909942bf`, `84689d68-9bde-4a57-bdb4-2585a09dbb23`, `10fbd948-c95f-4f00-87ae-e8fedb05340d`.

- Retained test context (2026-10-11T08:08:25.361Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_sections; references `fd24c5bd-1e88-4d16-9078-14915a1605df`, `ae2eb036-b0ab-48e6-9c82-26df845923f1`, `8dcbd555-6634-40e1-8d1b-a4b39ad137c6`, `d3384e26-8376-472e-8298-7264bd31b6b2`, `1a772829-f335-47ff-a8a6-d63218569193`.

- Retained test context (2026-10-11T08:08:25.361Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_form_parts; references `c0b49045-22ed-4831-a6d2-ac53b880d478`.

- Retained test context (2026-10-11T08:08:25.361Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_form_versions_v2; references `7fa5d42f-46f4-436a-8f68-ea8d6bd74d10`.

- Retained test context (2026-10-11T08:08:25.362Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_forms_v2; references `ece2db6b-4a67-48f5-a9fa-745f29753c10`.

- Retained test context (2026-10-11T08:08:25.362Z): tests/integration/company-form-stage-less-runtime.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:25.363Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_roleaccess_ac; references `a18ba004-13ff-49e6-82bf-41fb4f7c7a8f`.

- Retained test context (2026-10-11T08:08:25.363Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_rolemaster_ac; references `a18ba004-13ff-49e6-82bf-41fb4f7c7a8f`.

- Retained test context (2026-10-11T08:08:25.364Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_subject_types; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:28.275Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_answers; references `021fe737-c041-4508-9636-3f70c9da5fa7`.

- Retained test context (2026-10-11T08:08:28.276Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_section_states; references `021fe737-c041-4508-9636-3f70c9da5fa7`.

- Retained test context (2026-10-11T08:08:28.276Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_company_submission_assignments; references `021fe737-c041-4508-9636-3f70c9da5fa7`.

- Retained test context (2026-10-11T08:08:28.277Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_company_submissions; references `021fe737-c041-4508-9636-3f70c9da5fa7`.

- Retained test context (2026-10-11T08:08:28.277Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_questions; references `b887e707-7e89-49fc-bb3b-27e9431e3714`, `01ff4651-4ccb-4964-a825-9027032143a4`, `8828d977-9381-43fe-8e9b-db0cc20b76cc`, `e20cca17-b786-457c-8dff-86b8c625db37`, `4b3f333d-753a-4e63-86fd-ebf5dcf53d25`, `352b82be-7891-4ea8-9700-cfeca8802dbd`, `813b8828-2e32-4739-88cd-6317984005b9`, `578c787c-c735-45cc-a9da-6c954617e39e`, `51eb0325-489b-4ce4-83e6-82e2e52d0e42`, `640dae8e-7335-4d8b-b52b-0360117c9fef`, `cfad6bd9-1925-488b-a0a5-0aaf57f7ebbc`, `e3302973-7ab8-487e-bf71-8883359b49af`, `95f1df5c-a24a-4f5f-a080-c43fa4e2bfd8`.

- Retained test context (2026-10-11T08:08:28.278Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_sections; references `b92d1d96-98c7-4144-bb91-a9ae24c9101b`.

- Retained test context (2026-10-11T08:08:28.278Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_form_parts; references `b91317a4-b56b-472a-9313-d4ba7af4249a`.

- Retained test context (2026-10-11T08:08:28.278Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_options; references `65b5013b-7987-463d-8fa0-be7126b1c3e7`.

- Retained test context (2026-10-11T08:08:28.279Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_option_sets; references `65b5013b-7987-463d-8fa0-be7126b1c3e7`.

- Retained test context (2026-10-11T08:08:28.279Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_form_versions_v2; references `33936027-d545-49fd-b960-ac7a65345167`.

- Retained test context (2026-10-11T08:08:28.279Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_forms_v2; references `2287c6cb-e466-411f-a927-fd8bc22f256d`.

- Retained test context (2026-10-11T08:08:28.280Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target crew_assignments; references `d7295e2c-dfcc-47bf-893b-3a8c41b4852a`.

- Retained test context (2026-10-11T08:08:28.280Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target crew_members_v2; references `b10b3db4-d25b-44a0-b436-4711931672dc`.

- Retained test context (2026-10-11T08:08:28.280Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:28.280Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_resource_action_grants; references `903fe277-87f4-4a35-88a9-5743479f0e77`.

- Retained test context (2026-10-11T08:08:28.281Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_roleaccess_ac; references `903fe277-87f4-4a35-88a9-5743479f0e77`.

- Retained test context (2026-10-11T08:08:28.281Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_rolemaster_ac; references `903fe277-87f4-4a35-88a9-5743479f0e77`.

- Retained test context (2026-10-11T08:08:29.914Z): tests/integration/api/crew-finance.test.ts; target acc_settlement_adjustments_v2; references `14542b4d-c172-43cd-8037-09a0ef4deac9`, `54b03dd5-8df6-4c56-8d9a-1c9b8c8cd567`, `c6347653-9164-44c6-a3c5-3f79351475f4`, `aa95fd52-d9aa-4c04-8e67-b28ac5c01a7e`.

- Retained test context (2026-10-11T08:08:29.915Z): tests/integration/api/crew-finance.test.ts; target acc_settlement_approvals_v2; references `14542b4d-c172-43cd-8037-09a0ef4deac9`, `54b03dd5-8df6-4c56-8d9a-1c9b8c8cd567`, `c6347653-9164-44c6-a3c5-3f79351475f4`, `aa95fd52-d9aa-4c04-8e67-b28ac5c01a7e`.

- Retained test context (2026-10-11T08:08:29.916Z): tests/integration/api/crew-finance.test.ts; target acc_settlements_v2; references `14542b4d-c172-43cd-8037-09a0ef4deac9`, `54b03dd5-8df6-4c56-8d9a-1c9b8c8cd567`, `c6347653-9164-44c6-a3c5-3f79351475f4`, `aa95fd52-d9aa-4c04-8e67-b28ac5c01a7e`.

- Retained test context (2026-10-11T08:08:29.917Z): tests/integration/api/crew-finance.test.ts; target acc_wage_ledger_v2; references `14542b4d-c172-43cd-8037-09a0ef4deac9`, `54b03dd5-8df6-4c56-8d9a-1c9b8c8cd567`, `c6347653-9164-44c6-a3c5-3f79351475f4`, `aa95fd52-d9aa-4c04-8e67-b28ac5c01a7e`.

- Retained test context (2026-10-11T08:08:29.917Z): tests/integration/api/crew-finance.test.ts; target acc_calculation_runs_v2; references `35cadde8-c777-4a66-ad73-792389c8a4ab`, `de65f5ca-7052-4388-ad5c-2cc1cbfeff77`, `fd12d176-eca2-48a3-85cc-b85029595446`, `a1cc5601-9add-495f-aedc-a2e05d7fd0de`, `be0be7fc-cd10-46c1-b63b-939b0df2c173`, `97a63166-6232-470e-9371-0762e128b982`, `553d4c55-76b2-44a6-922e-61283bb82aef`, `d60d8663-111f-4651-9d48-07a682422385`, `648f0d85-86c0-4425-af60-5213518438b0`, `b9e695d1-552b-469d-9f6b-0b47ddff5857`, `a9cc833b-9eb2-4303-abc7-f007d846177a`, `13507794-4ce6-4db3-8362-8338605beeb2`, `e81b0d44-c110-4c74-96eb-3a3f26e6ed7e`, `c69b04b8-1624-42d5-9f96-371cc1422867`.

- Retained test context (2026-10-11T08:08:29.918Z): tests/integration/api/crew-finance.test.ts; target acc_calculation_runs_v2; references `14542b4d-c172-43cd-8037-09a0ef4deac9`, `54b03dd5-8df6-4c56-8d9a-1c9b8c8cd567`, `c6347653-9164-44c6-a3c5-3f79351475f4`, `aa95fd52-d9aa-4c04-8e67-b28ac5c01a7e`.

- Retained test context (2026-10-11T08:08:29.918Z): tests/integration/api/crew-finance.test.ts; target acc_monthly_transactions_v2; references `3b4aa655-b7e7-4f85-866c-9aa5064821c9`, `8116c447-bed7-4545-9923-2bf835c6ae0e`, `37d5e1ea-44ec-4dc6-b452-acba45713f82`, `d64ced86-3811-4d10-bd2b-be7d9c43bdf8`.

- Retained test context (2026-10-11T08:08:29.919Z): tests/integration/api/crew-finance.test.ts; target acc_bond_items_v2; references `3b4aa655-b7e7-4f85-866c-9aa5064821c9`, `d64ced86-3811-4d10-bd2b-be7d9c43bdf8`.

- Retained test context (2026-10-11T08:08:29.919Z): tests/integration/api/crew-finance.test.ts; target acc_advances_v2; references `8116c447-bed7-4545-9923-2bf835c6ae0e`, `d64ced86-3811-4d10-bd2b-be7d9c43bdf8`.

- Retained test context (2026-10-11T08:08:29.920Z): tests/integration/api/crew-finance.test.ts; target acc_allotments_v2; references `37d5e1ea-44ec-4dc6-b452-acba45713f82`, `d64ced86-3811-4d10-bd2b-be7d9c43bdf8`.

- Retained test context (2026-10-11T08:08:29.920Z): tests/integration/api/crew-finance.test.ts; target acc_engagements_v2; references `14542b4d-c172-43cd-8037-09a0ef4deac9`, `54b03dd5-8df6-4c56-8d9a-1c9b8c8cd567`, `c6347653-9164-44c6-a3c5-3f79351475f4`, `aa95fd52-d9aa-4c04-8e67-b28ac5c01a7e`.

- Retained test context (2026-10-11T08:08:29.921Z): tests/integration/api/crew-finance.test.ts; target crew_members_v2; references `3b4aa655-b7e7-4f85-866c-9aa5064821c9`, `8116c447-bed7-4545-9923-2bf835c6ae0e`, `37d5e1ea-44ec-4dc6-b452-acba45713f82`, `d64ced86-3811-4d10-bd2b-be7d9c43bdf8`.

- Retained test context (2026-10-11T08:08:29.921Z): tests/integration/api/crew-finance.test.ts; target acc_wage_scale_lines_v2; references `789f84d7-09c3-453a-9a0c-d06f9d04af8a`.

- Retained test context (2026-10-11T08:08:29.922Z): tests/integration/api/crew-finance.test.ts; target acc_wage_scales_v2; references `789f84d7-09c3-453a-9a0c-d06f9d04af8a`.

- Retained test context (2026-10-11T08:08:29.922Z): tests/integration/api/crew-finance.test.ts; target acc_pay_elements_v2; references `b573ea62-c2c5-471c-97d9-6cd668a5aafa`, `44376fb3-932d-4b4c-a73e-51a3b94de79f`, `e583745a-2914-4b6f-b53e-c40c52e7773e`, `696b0ea2-3974-4539-9757-53e083729477`.

- Retained test context (2026-10-11T08:08:35.039Z): tests/integration/api/company-form-submission-races.test.ts; target frm_answers; references `daf01fd6-ec87-4d0b-87f7-bad2606345d9`, `e3d77506-3de6-4c93-ba65-f84da5010233`, `6182c309-62d8-4742-97a6-bd1cc0e498d0`.

- Retained test context (2026-10-11T08:08:35.040Z): tests/integration/api/company-form-submission-races.test.ts; target frm_section_states; references `daf01fd6-ec87-4d0b-87f7-bad2606345d9`, `e3d77506-3de6-4c93-ba65-f84da5010233`, `6182c309-62d8-4742-97a6-bd1cc0e498d0`.

- Retained test context (2026-10-11T08:08:35.041Z): tests/integration/api/company-form-submission-races.test.ts; target frm_company_submission_assignments; references `daf01fd6-ec87-4d0b-87f7-bad2606345d9`, `e3d77506-3de6-4c93-ba65-f84da5010233`, `6182c309-62d8-4742-97a6-bd1cc0e498d0`.

- Retained test context (2026-10-11T08:08:35.041Z): tests/integration/api/company-form-submission-races.test.ts; target frm_company_submissions; references `daf01fd6-ec87-4d0b-87f7-bad2606345d9`, `e3d77506-3de6-4c93-ba65-f84da5010233`, `6182c309-62d8-4742-97a6-bd1cc0e498d0`.

- Retained test context (2026-10-11T08:08:35.042Z): tests/integration/api/company-form-submission-races.test.ts; target crew_assignments; references `9f469730-9433-4cc1-bf4a-71d9af4d158a`, `b193c392-0c9e-4109-b46c-7d3b8a6229f4`, `f147d5f1-ceaf-4f4c-8f07-c890586764ad`, `73e0cf85-7ba7-41b3-86e7-9afed19688ee`, `4b75daa1-4da2-40b8-8060-be131e7aab0c`.

- Retained test context (2026-10-11T08:08:35.042Z): tests/integration/api/company-form-submission-races.test.ts; target frm_questions; references `0d6b3e6b-4aa2-401c-8ed5-a92a0504eec8`.

- Retained test context (2026-10-11T08:08:35.043Z): tests/integration/api/company-form-submission-races.test.ts; target frm_sections; references `e185b9c3-0bf5-403f-a264-981b83c92975`.

- Retained test context (2026-10-11T08:08:35.043Z): tests/integration/api/company-form-submission-races.test.ts; target frm_form_parts; references `c2ab5af4-2db0-4cf8-ae13-a089d7bd08e2`.

- Retained test context (2026-10-11T08:08:35.043Z): tests/integration/api/company-form-submission-races.test.ts; target adm_form_versions_v2; references `f4677d00-065c-4335-b714-9fd84e62361f`.

- Retained test context (2026-10-11T08:08:35.044Z): tests/integration/api/company-form-submission-races.test.ts; target adm_forms_v2; references `bc803350-8499-4eb5-998f-5c9ed5668171`.

- Retained test context (2026-10-11T08:08:35.044Z): tests/integration/api/company-form-submission-races.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:35.045Z): tests/integration/api/company-form-submission-races.test.ts; target adm_resource_action_grants; references `b8286d3a-cb07-4800-bc26-2e0303783ec0`.

- Retained test context (2026-10-11T08:08:35.046Z): tests/integration/api/company-form-submission-races.test.ts; target adm_roleaccess_ac; references `b8286d3a-cb07-4800-bc26-2e0303783ec0`.

- Retained test context (2026-10-11T08:08:35.046Z): tests/integration/api/company-form-submission-races.test.ts; target adm_rolemaster_ac; references `b8286d3a-cb07-4800-bc26-2e0303783ec0`.

- Retained test context (2026-10-11T08:08:38.520Z): tests/integration/api/accounts-reports.test.ts; target cleanup context; references `64fe0f62-d6c1-4ae1-96f3-06836b2f4ed9`.

- Retained test context (2026-10-11T08:08:38.556Z): tests/integration/api/accounts-reports.test.ts; target acc_wage_ledger_v2; references `ad9e2662-46f0-43c2-9c18-f3563752ae7d`, `e2bf0e55-e90a-457e-bd85-6dd3f2270f17`, `f5d31055-09a4-4e63-b250-35e1ab405c81`, `c2506c51-56d2-4277-995f-8d049a65148b`, `9be83baf-a386-40e4-928a-44124f3ed409`, `d344b38c-634f-497d-9b46-ac3581364f00`, `54f2eca3-712a-4843-a8a1-1f21c4ad3bf5`, `151505b1-f230-493f-a8be-d577041c5601`, `778fc660-ee0c-48df-ae04-9b090219d813`, `641bc324-1822-4a67-8369-23716b1a4596`, `d168aed0-db2d-4694-acf7-516aae148477`, `cefa5e71-509b-45ca-b74e-d37806bbb9be`, `06f6a7c0-0814-468e-a965-d9c6c86e87b3`.

- Retained test context (2026-10-11T08:08:38.556Z): tests/integration/api/accounts-reports.test.ts; target acc_portage_bills_v2; references `25cebae7-f750-4ea7-a281-5cd79b5b5b36`.

- Retained test context (2026-10-11T08:08:38.557Z): tests/integration/api/accounts-reports.test.ts; target acc_engagements_v2; references `7ee9793f-789d-496f-aeda-9d810dbf63a9`, `6cecb750-f7a5-4ef9-bb47-0d3370f2b21c`, `aae88201-4109-482f-8f02-e3e5f0276210`, `8848486a-4c58-4d3b-b913-afd52fd3e1cf`.

- Retained test context (2026-10-11T08:08:38.557Z): tests/integration/api/accounts-reports.test.ts; target crew_members_v2; references `568263a0-8ddb-44e3-9c29-8d8fd10343a6`, `5200dae4-707c-4488-a514-d86bd437a664`, `e36c7323-cb47-40be-aaa5-9505c05ac8a2`.

- Retained test context (2026-10-11T08:08:38.558Z): tests/integration/api/accounts-reports.test.ts; target acc_pay_elements_v2; references `9bd41465-c4c1-4a95-b306-99bc6f3eda95`, `0a2718f4-ac0a-4a2b-8b89-63e6362481a7`, `9f762286-2bd6-4062-951e-9294d5135577`, `ff435f8e-d109-41ea-a6ea-3d3e3c460261`, `730cf281-df4c-4da0-b129-baa6813a678c`.

- Retained test context (2026-10-11T08:08:39.633Z): dimension context cf_dimensions_2337515b; target registered_fixture_context; references `9318750e-86c8-494b-acb7-a316c6cb5b93`, `acb8fe3c-81b8-43f3-9df6-1c96d4707dee`, `b2d5be68-37a6-4034-b266-3e2a682f13a4`, `569836ec-c5fe-4db0-9cb8-a89d1e05992a`.

- Retained test context (2026-10-11T08:08:39.856Z): cf_dimensions_2337515b.adm_available_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:39.875Z): cf_dimensions_2337515b.adm_company_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:39.899Z): cf_dimensions_2337515b.master_vessels canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:39.917Z): cf_dimensions_2337515b.master_vessel_types canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:39.937Z): cf_dimensions_2337515b.master_nationalities canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:39.952Z): cf_dimensions_2337515b.master_manning_agents canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:39.968Z): cf_dimensions_2337515b.master_crew_pools canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:39.987Z): cf_dimensions_2337515b.master_fleet_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:40.007Z): cf_dimensions_2337515b.master_additional_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:40.033Z): canonical master copies cf_dimensions_2337515b; target registered_fixture_context; references `55d4c4b0-8e9c-479c-a9f0-9f3fbe95e0e5`, `743feb08-841a-11ed-aa7c-7003bca91a86`.

- Retained test context (2026-10-11T08:08:43.770Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_section_signatures; references `81f3f722-a53a-424f-b57d-d78459627e22`.

- Retained test context (2026-10-11T08:08:43.771Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_signature_attachments; references `525271df-80e6-4a19-981e-573b6abfd775`, `02c321f9-d0d7-49be-84e9-2729653a2863`.

- Retained test context (2026-10-11T08:08:43.772Z): tests/integration/debriefing-submission.acceptance.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:43.773Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_answers; references `81f3f722-a53a-424f-b57d-d78459627e22`.

- Retained test context (2026-10-11T08:08:43.773Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_section_states; references `81f3f722-a53a-424f-b57d-d78459627e22`.

- Retained test context (2026-10-11T08:08:43.774Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_debriefing_submissions; references `81f3f722-a53a-424f-b57d-d78459627e22`.

- Retained test context (2026-10-11T08:08:43.774Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_questions; references `9b3b256f-af39-4dc7-adae-4aea40f9c85f`.

- Retained test context (2026-10-11T08:08:43.775Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_sections; references `1c996f7c-16a2-4f39-a7b2-55b19d397791`, `50459a5b-41ae-4802-b6eb-0da84db23271`, `6b36f2c4-c2a9-4bb0-9168-b94cf9cf9dad`.

- Retained test context (2026-10-11T08:08:43.776Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_form_parts; references `23ded09d-5a14-4938-92fc-9c8a38ae9d49`.

- Retained test context (2026-10-11T08:08:43.776Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_form_versions_v2; references `234725ed-a18c-48c5-b9e3-86be13aabea7`, `31acf431-99b1-473b-9b2d-ab872891fbfa`.

- Retained test context (2026-10-11T08:08:43.777Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_rank_groups_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:43.777Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_forms_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:43.777Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_debriefings; references `50c8dad9-e87b-4e14-b180-496476cdc7a1`, `4ff4a56c-8672-4bf7-8eda-db4a9e0fcf54`, `6172b3bd-468b-462e-ab4d-52844f22e2de`.

- Retained test context (2026-10-11T08:08:43.778Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_members_v2; references `ee01bfeb-4f24-413f-8f14-21114ad8807c`.

- Retained test context (2026-10-11T08:08:43.778Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_vessels; references `8f572270-0f98-4db1-b857-dc0e7ffc3499`.

- Retained test context (2026-10-11T08:08:43.779Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_vessel_types; references `68151d2c-42e4-4b6e-927b-6c8e7240192f`.

- Retained test context (2026-10-11T08:08:43.779Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:51.144Z): dimension release definition; target registered_fixture_context; references `88fffa78-a96a-473e-874e-ecc4b6b352fe`, `bcd996b0-706e-4d4c-a337-642f4d5344a9`.

- Retained test context (2026-10-11T08:08:51.236Z): dimension release draft content; target registered_fixture_context; references `5cc732f6-85c5-4185-875e-e17c68af6d12`, `32dacc19-2422-4e1e-9f70-eba7a7abd429`, `50b39671-851b-4380-872b-63ec17d1a994`, `654e2afa-5e27-4b04-b93d-880a7e293a20`.

- Retained test context (2026-10-11T08:08:51.281Z): dimension release condition data; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:51.410Z): dimension release copied draft; target registered_fixture_context; references `aee2b619-181b-4c62-8c50-987a4f564a5e`.

- Retained test context (2026-10-11T08:08:53.941Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_settlements_v2; references `a5f8d619-3703-42a4-b192-f34f349af688`, `3643fafa-50d5-4f30-a8e6-0f6db678ef8f`, `2577aee7-34d2-4899-b7d4-bdcba1b48742`.

- Retained test context (2026-10-11T08:08:53.943Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_wage_ledger_v2; references `a5f8d619-3703-42a4-b192-f34f349af688`, `3643fafa-50d5-4f30-a8e6-0f6db678ef8f`, `2577aee7-34d2-4899-b7d4-bdcba1b48742`.

- Retained test context (2026-10-11T08:08:53.943Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_calculation_runs_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:53.944Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_calculation_runs_v2; references `a5f8d619-3703-42a4-b192-f34f349af688`, `3643fafa-50d5-4f30-a8e6-0f6db678ef8f`, `2577aee7-34d2-4899-b7d4-bdcba1b48742`.

- Retained test context (2026-10-11T08:08:53.944Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:08:53.945Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_monthly_transactions_v2; references `d1b92745-2f89-4287-bbdb-bce08a0c42cb`.

- Retained test context (2026-10-11T08:08:53.945Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_engagements_v2; references `a5f8d619-3703-42a4-b192-f34f349af688`, `3643fafa-50d5-4f30-a8e6-0f6db678ef8f`, `2577aee7-34d2-4899-b7d4-bdcba1b48742`.

- Retained test context (2026-10-11T08:08:53.946Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_wage_scale_lines_v2; references `7287e353-89f9-416e-8b46-39d73b796171`.

- Retained test context (2026-10-11T08:08:53.946Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_wage_scales_v2; references `7287e353-89f9-416e-8b46-39d73b796171`.

- Retained test context (2026-10-11T08:08:53.947Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_pay_elements_v2; references `f572f402-201a-40c1-add4-79b3e6d7f537`, `2bb9e2db-baa6-4f2c-bfbf-b1321c144cf6`.

- Retained test context (2026-10-11T08:08:53.947Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target cleanup context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:26.272Z): tests/integration/api/obsolete-crew-assignment-paths.test.ts; target vessel_planning_v2; references `50d139cf-d4d5-4f06-b3c7-24b57628a3f8`.

- Retained test context (2026-10-11T08:12:26.273Z): tests/integration/api/obsolete-crew-assignment-paths.test.ts; target crew_members_v2; references `86be442c-f36c-408d-b8b2-f630d860ca2d`.

- Retained test context (2026-10-11T08:12:28.752Z): tests/integration/api/ship-reference-reads.test.ts; target acc_allotments_v2; references `734e7ab5-e544-43ac-86fd-469d4e50d63b`, `911379fd-0b37-4b5e-af7d-5e2cc753e275`, `edeebf72-34cc-43ea-bb32-f40f049f9cc2`.

- Retained test context (2026-10-11T08:12:28.753Z): tests/integration/api/ship-reference-reads.test.ts; target acc_engagements_v2; references `ea399735-396d-4cd5-8509-ce5bb8d646a7`, `947f5e6e-bacd-4337-8bce-123c78dfba50`.

- Retained test context (2026-10-11T08:12:28.754Z): tests/integration/api/ship-reference-reads.test.ts; target acc_wage_scale_lines_v2; references `45d8d8c6-4184-46ee-94ea-42fb15179345`, `540daf8f-8f29-4772-8217-f9f38024b04e`.

- Retained test context (2026-10-11T08:12:28.754Z): tests/integration/api/ship-reference-reads.test.ts; target acc_wage_scales_v2; references `45d8d8c6-4184-46ee-94ea-42fb15179345`, `540daf8f-8f29-4772-8217-f9f38024b04e`.

- Retained test context (2026-10-11T08:12:28.755Z): tests/integration/api/ship-reference-reads.test.ts; target acc_pay_elements_v2; references `8cb4cc56-8f07-4818-897d-3db3ab03afda`, `cb1a5c7c-8f60-47cf-91fd-872b14a55dd9`, `1e9e679c-e61f-4384-b78f-c6b64b1d219b`, `55b32612-3221-4f8c-b75a-b7ee7950781a`, `78f4c49e-46b9-46f9-93d1-768c957b0127`, `b926c6d7-8256-4814-8e21-01ddde3ed603`.

- Retained test context (2026-10-11T08:12:33.060Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_ctm_lines_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:33.062Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_ctm_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:33.063Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_monthly_transactions_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:33.063Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_wage_ledger_v2; references `96c98386-f9af-4d4c-b40c-cd03529679b0`.

- Retained test context (2026-10-11T08:12:33.064Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_calculation_runs_v2; references `e1d773b9-e241-4665-86b1-e0a38ee73f42`, `a10e285e-5aba-432a-84e1-5616a86083e3`, `4a3e07fa-679b-4b55-bc4e-8e19359cffde`, `5a8c0a96-e144-4f59-969c-77f76bf59316`.

- Retained test context (2026-10-11T08:12:33.065Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:33.066Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_allotments_v2; references `dfc5bf95-286e-4562-85dc-c6c796fec96e`.

- Retained test context (2026-10-11T08:12:33.066Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_engagements_v2; references `96c98386-f9af-4d4c-b40c-cd03529679b0`.

- Retained test context (2026-10-11T08:12:33.067Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_wage_scale_lines_v2; references `694f6395-312a-444e-b89d-d1d3314392a7`.

- Retained test context (2026-10-11T08:12:33.068Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_wage_scales_v2; references `694f6395-312a-444e-b89d-d1d3314392a7`.

- Retained test context (2026-10-11T08:12:33.068Z): tests/integration/api/vessel-portage-category-grids.test.ts; target acc_pay_elements_v2; references `fb23b476-8b54-48c2-915c-728d2889ce0b`, `e105a88f-d2de-4f28-8227-407e45de3173`, `a60bff0c-8c6e-4657-8b3e-2647325b86fe`, `2437685b-fe8b-4564-ae4c-f0c6307e5e65`, `22f44596-333d-4a9e-9009-81971737cabb`.

- Retained test context (2026-10-11T08:12:34.914Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_wage_ledger_v2; references `402bccd7-b9f2-4e8f-89c9-c2a9d137c3fa`, `a49a6359-ec18-454c-94eb-f46389dc7859`.

- Retained test context (2026-10-11T08:12:34.916Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_calculation_runs_v2; references `402bccd7-b9f2-4e8f-89c9-c2a9d137c3fa`, `a49a6359-ec18-454c-94eb-f46389dc7859`.

- Retained test context (2026-10-11T08:12:34.916Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_monthly_transactions_v2; references `402bccd7-b9f2-4e8f-89c9-c2a9d137c3fa`, `a49a6359-ec18-454c-94eb-f46389dc7859`.

- Retained test context (2026-10-11T08:12:34.917Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_ctm_lines_v2; references `402bccd7-b9f2-4e8f-89c9-c2a9d137c3fa`, `a49a6359-ec18-454c-94eb-f46389dc7859`.

- Retained test context (2026-10-11T08:12:34.917Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_ctm_v2; references `402bccd7-b9f2-4e8f-89c9-c2a9d137c3fa`, `a49a6359-ec18-454c-94eb-f46389dc7859`.

- Retained test context (2026-10-11T08:12:34.918Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_portage_bills_v2; references `402bccd7-b9f2-4e8f-89c9-c2a9d137c3fa`, `a49a6359-ec18-454c-94eb-f46389dc7859`.

- Retained test context (2026-10-11T08:12:34.919Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_settlements_v2; references `4876b596-2ca4-4403-958c-51d90ad3e61a`.

- Retained test context (2026-10-11T08:12:34.919Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_allotments_v2; references `6232b170-7ee3-4655-b176-920c44e0465d`, `9c6cce94-9e2f-4076-88e9-96005de74b48`, `c72f2458-9aee-4067-9320-32f33f147b7c`, `2a9a2588-433d-4a6e-b8c8-a3c1a3243da4`.

- Retained test context (2026-10-11T08:12:34.920Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_engagements_v2; references `402bccd7-b9f2-4e8f-89c9-c2a9d137c3fa`, `a49a6359-ec18-454c-94eb-f46389dc7859`.

- Retained test context (2026-10-11T08:12:34.920Z): tests/integration/api/vessel-initiated-workflow.test.ts; target crew_assignments; references `b352cdb7-2645-44d9-ba45-6d551b304b74`, `31cac182-66ed-460e-8233-097270114f11`.

- Retained test context (2026-10-11T08:12:34.921Z): tests/integration/api/vessel-initiated-workflow.test.ts; target crew_members_v2; references `6232b170-7ee3-4655-b176-920c44e0465d`, `9c6cce94-9e2f-4076-88e9-96005de74b48`, `c72f2458-9aee-4067-9320-32f33f147b7c`, `2a9a2588-433d-4a6e-b8c8-a3c1a3243da4`.

- Retained test context (2026-10-11T08:12:34.921Z): tests/integration/api/vessel-initiated-workflow.test.ts; target adm_company_ranks_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:34.921Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_wage_scale_lines_v2; references `1432612f-0b76-4e6c-8f3b-2f3df0ad90e3`.

- Retained test context (2026-10-11T08:12:34.922Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_wage_scales_v2; references `1432612f-0b76-4e6c-8f3b-2f3df0ad90e3`.

- Retained test context (2026-10-11T08:12:34.922Z): tests/integration/api/vessel-initiated-workflow.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:34.923Z): tests/integration/api/vessel-initiated-workflow.test.ts; target master_vessels; references `402bccd7-b9f2-4e8f-89c9-c2a9d137c3fa`, `a49a6359-ec18-454c-94eb-f46389dc7859`.

- Retained test context (2026-10-11T08:12:34.923Z): tests/integration/api/vessel-initiated-workflow.test.ts; target master_vessel_types; references `3b3dc5ea-b636-4c12-9247-9a75ebf27012`.

- Retained test context (2026-10-11T08:12:34.923Z): tests/integration/api/vessel-initiated-workflow.test.ts; target acc_pay_elements_v2; references `2963d3ff-fea0-42d2-b2d1-d820e84b8653`, `43fc2aeb-78b8-4afe-b843-20e574093e0a`.

- Retained test context (2026-10-11T08:12:34.924Z): tests/integration/api/vessel-initiated-workflow.test.ts; target cleanup context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:36.207Z): tests/integration/api/wage-engine.test.ts; target acc_settlement_approvals_v2; references `7b5c01ca-1cbd-47ed-9a21-79f706863ba6`, `751c59cb-b2d2-443a-9be9-6d9d8c131ff4`, `b56c0954-be52-4115-96cd-f28cf678f432`, `8c0ecc96-64c6-482a-b963-97536f4005be`, `681984e6-df47-42d2-8997-eb24baaafce3`, `e2af51a0-2208-4c9e-8393-8e8fdd6c08ec`, `c0a00a48-8d4d-4bc3-9c0a-537c5634304d`, `917de53f-d839-4056-8f8c-9edeafb11ff3`, `ebbe8dc2-5967-45d6-8110-6f1ecd68d751`, `b35d5c66-b0a7-457f-a69d-83af2616278a`, `7788dc32-c44d-45ab-9892-e2c8907ca4b9`, `cb22e53c-6b53-4522-b853-19cec0a63966`, `69eb2a31-ec13-4562-91f6-d21024ce2bdf`, `a86d6ef5-008d-461b-b5f2-1fd2ba894efe`, `11bc6a67-79bf-408d-8bfe-354ff6a61180`, `b592ea80-daf4-4d62-92a7-91d889c61f17`, `3eaf6039-6a7f-4405-8819-a80827847f9b`, `b2f1d6fa-a377-41e7-8cba-b964a0ac6ed4`, `3b5bd817-4742-4877-a1c6-11e3e92fed6c`, `dd43f18c-b0fe-47f3-9191-e73c7f1e3f75`, `1a5348cc-692b-45d7-a76e-83f192608755`.

- Retained test context (2026-10-11T08:12:36.209Z): tests/integration/api/wage-engine.test.ts; target acc_settlement_adjustments_v2; references `7b5c01ca-1cbd-47ed-9a21-79f706863ba6`, `751c59cb-b2d2-443a-9be9-6d9d8c131ff4`, `b56c0954-be52-4115-96cd-f28cf678f432`, `8c0ecc96-64c6-482a-b963-97536f4005be`, `681984e6-df47-42d2-8997-eb24baaafce3`, `e2af51a0-2208-4c9e-8393-8e8fdd6c08ec`, `c0a00a48-8d4d-4bc3-9c0a-537c5634304d`, `917de53f-d839-4056-8f8c-9edeafb11ff3`, `ebbe8dc2-5967-45d6-8110-6f1ecd68d751`, `b35d5c66-b0a7-457f-a69d-83af2616278a`, `7788dc32-c44d-45ab-9892-e2c8907ca4b9`, `cb22e53c-6b53-4522-b853-19cec0a63966`, `69eb2a31-ec13-4562-91f6-d21024ce2bdf`, `a86d6ef5-008d-461b-b5f2-1fd2ba894efe`, `11bc6a67-79bf-408d-8bfe-354ff6a61180`, `b592ea80-daf4-4d62-92a7-91d889c61f17`, `3eaf6039-6a7f-4405-8819-a80827847f9b`, `b2f1d6fa-a377-41e7-8cba-b964a0ac6ed4`, `3b5bd817-4742-4877-a1c6-11e3e92fed6c`, `dd43f18c-b0fe-47f3-9191-e73c7f1e3f75`, `1a5348cc-692b-45d7-a76e-83f192608755`.

- Retained test context (2026-10-11T08:12:36.210Z): tests/integration/api/wage-engine.test.ts; target acc_settlements_v2; references `7b5c01ca-1cbd-47ed-9a21-79f706863ba6`, `751c59cb-b2d2-443a-9be9-6d9d8c131ff4`, `b56c0954-be52-4115-96cd-f28cf678f432`, `8c0ecc96-64c6-482a-b963-97536f4005be`, `681984e6-df47-42d2-8997-eb24baaafce3`, `e2af51a0-2208-4c9e-8393-8e8fdd6c08ec`, `c0a00a48-8d4d-4bc3-9c0a-537c5634304d`, `917de53f-d839-4056-8f8c-9edeafb11ff3`, `ebbe8dc2-5967-45d6-8110-6f1ecd68d751`, `b35d5c66-b0a7-457f-a69d-83af2616278a`, `7788dc32-c44d-45ab-9892-e2c8907ca4b9`, `cb22e53c-6b53-4522-b853-19cec0a63966`, `69eb2a31-ec13-4562-91f6-d21024ce2bdf`, `a86d6ef5-008d-461b-b5f2-1fd2ba894efe`, `11bc6a67-79bf-408d-8bfe-354ff6a61180`, `b592ea80-daf4-4d62-92a7-91d889c61f17`, `3eaf6039-6a7f-4405-8819-a80827847f9b`, `b2f1d6fa-a377-41e7-8cba-b964a0ac6ed4`, `3b5bd817-4742-4877-a1c6-11e3e92fed6c`, `dd43f18c-b0fe-47f3-9191-e73c7f1e3f75`, `1a5348cc-692b-45d7-a76e-83f192608755`.

- Retained test context (2026-10-11T08:12:36.210Z): tests/integration/api/wage-engine.test.ts; target crew_assignments; references `f3a814de-85b1-48da-bee3-9ea02cec8bdd`.

- Retained test context (2026-10-11T08:12:36.211Z): tests/integration/api/wage-engine.test.ts; target acc_engagements_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:36.211Z): tests/integration/api/wage-engine.test.ts; target acc_wage_ledger_v2; references `7b5c01ca-1cbd-47ed-9a21-79f706863ba6`, `751c59cb-b2d2-443a-9be9-6d9d8c131ff4`, `b56c0954-be52-4115-96cd-f28cf678f432`, `8c0ecc96-64c6-482a-b963-97536f4005be`, `681984e6-df47-42d2-8997-eb24baaafce3`, `e2af51a0-2208-4c9e-8393-8e8fdd6c08ec`, `c0a00a48-8d4d-4bc3-9c0a-537c5634304d`, `917de53f-d839-4056-8f8c-9edeafb11ff3`, `ebbe8dc2-5967-45d6-8110-6f1ecd68d751`, `b35d5c66-b0a7-457f-a69d-83af2616278a`, `7788dc32-c44d-45ab-9892-e2c8907ca4b9`, `cb22e53c-6b53-4522-b853-19cec0a63966`, `69eb2a31-ec13-4562-91f6-d21024ce2bdf`, `a86d6ef5-008d-461b-b5f2-1fd2ba894efe`, `11bc6a67-79bf-408d-8bfe-354ff6a61180`, `b592ea80-daf4-4d62-92a7-91d889c61f17`, `3eaf6039-6a7f-4405-8819-a80827847f9b`, `b2f1d6fa-a377-41e7-8cba-b964a0ac6ed4`, `3b5bd817-4742-4877-a1c6-11e3e92fed6c`, `dd43f18c-b0fe-47f3-9191-e73c7f1e3f75`, `1a5348cc-692b-45d7-a76e-83f192608755`.

- Retained test context (2026-10-11T08:12:36.212Z): tests/integration/api/wage-engine.test.ts; target acc_calculation_runs_v2; references `7b5c01ca-1cbd-47ed-9a21-79f706863ba6`, `751c59cb-b2d2-443a-9be9-6d9d8c131ff4`, `b56c0954-be52-4115-96cd-f28cf678f432`, `8c0ecc96-64c6-482a-b963-97536f4005be`, `681984e6-df47-42d2-8997-eb24baaafce3`, `e2af51a0-2208-4c9e-8393-8e8fdd6c08ec`, `c0a00a48-8d4d-4bc3-9c0a-537c5634304d`, `917de53f-d839-4056-8f8c-9edeafb11ff3`, `ebbe8dc2-5967-45d6-8110-6f1ecd68d751`, `b35d5c66-b0a7-457f-a69d-83af2616278a`, `7788dc32-c44d-45ab-9892-e2c8907ca4b9`, `cb22e53c-6b53-4522-b853-19cec0a63966`, `69eb2a31-ec13-4562-91f6-d21024ce2bdf`, `a86d6ef5-008d-461b-b5f2-1fd2ba894efe`, `11bc6a67-79bf-408d-8bfe-354ff6a61180`, `b592ea80-daf4-4d62-92a7-91d889c61f17`, `3eaf6039-6a7f-4405-8819-a80827847f9b`, `b2f1d6fa-a377-41e7-8cba-b964a0ac6ed4`, `3b5bd817-4742-4877-a1c6-11e3e92fed6c`, `dd43f18c-b0fe-47f3-9191-e73c7f1e3f75`, `1a5348cc-692b-45d7-a76e-83f192608755`.

- Retained test context (2026-10-11T08:12:36.212Z): tests/integration/api/wage-engine.test.ts; target acc_portage_bills_v2; references `17aa5d86-ea34-4d9e-aeba-b4b993cd83e6`.

- Retained test context (2026-10-11T08:12:36.212Z): tests/integration/api/wage-engine.test.ts; target acc_engagement_pay_elements_v2; references `4b48052d-5376-4c4d-86be-b6b4405ae709`, `934b2710-e0ab-4afa-9c2a-576320fac661`, `bd0de5b1-d6c0-493d-980d-b9e810661d04`, `20ae4884-2863-462e-85a7-7e80bea4ad62`, `961ecdcc-0135-4137-9a62-07d690d570b7`.

- Retained test context (2026-10-11T08:12:36.213Z): tests/integration/api/wage-engine.test.ts; target acc_monthly_transactions_v2; references `eb5e4f51-72e3-47c1-93db-a964e0d20cfa`, `f4f21a1b-6027-47be-9fe0-abf6a5e471ce`, `a74cc662-39d1-4f64-bf65-4ddaef25f036`, `f7202fa3-bcf5-450d-b877-fb701788f847`.

- Retained test context (2026-10-11T08:12:36.213Z): tests/integration/api/wage-engine.test.ts; target acc_allotments_v2; references `18a2c8d4-2348-42b1-a1d6-2af6f7e6b6de`.

- Retained test context (2026-10-11T08:12:36.214Z): tests/integration/api/wage-engine.test.ts; target acc_advances_v2; references `7b39e3ca-3a41-4fd3-886e-304c493c7fe0`.

- Retained test context (2026-10-11T08:12:36.214Z): tests/integration/api/wage-engine.test.ts; target acc_bond_items_v2; references `7fe011d0-a680-4fd2-969e-6f8f5fdd064a`.

- Retained test context (2026-10-11T08:12:36.214Z): tests/integration/api/wage-engine.test.ts; target promo_execution_ledger_v2; references `24a1b393-02d8-458b-a09f-f6dd572f5b7a`.

- Retained test context (2026-10-11T08:12:36.215Z): tests/integration/api/wage-engine.test.ts; target acc_engagements_v2; references `7b5c01ca-1cbd-47ed-9a21-79f706863ba6`, `751c59cb-b2d2-443a-9be9-6d9d8c131ff4`, `b56c0954-be52-4115-96cd-f28cf678f432`, `8c0ecc96-64c6-482a-b963-97536f4005be`, `681984e6-df47-42d2-8997-eb24baaafce3`, `e2af51a0-2208-4c9e-8393-8e8fdd6c08ec`, `c0a00a48-8d4d-4bc3-9c0a-537c5634304d`, `917de53f-d839-4056-8f8c-9edeafb11ff3`, `ebbe8dc2-5967-45d6-8110-6f1ecd68d751`, `b35d5c66-b0a7-457f-a69d-83af2616278a`, `7788dc32-c44d-45ab-9892-e2c8907ca4b9`, `cb22e53c-6b53-4522-b853-19cec0a63966`, `69eb2a31-ec13-4562-91f6-d21024ce2bdf`, `a86d6ef5-008d-461b-b5f2-1fd2ba894efe`, `11bc6a67-79bf-408d-8bfe-354ff6a61180`, `b592ea80-daf4-4d62-92a7-91d889c61f17`, `3eaf6039-6a7f-4405-8819-a80827847f9b`, `b2f1d6fa-a377-41e7-8cba-b964a0ac6ed4`, `3b5bd817-4742-4877-a1c6-11e3e92fed6c`, `dd43f18c-b0fe-47f3-9191-e73c7f1e3f75`, `1a5348cc-692b-45d7-a76e-83f192608755`.

- Retained test context (2026-10-11T08:12:36.215Z): tests/integration/api/wage-engine.test.ts; target crew_members_v2; references `27b41e21-0b9d-426e-b4d5-708a439d4fa0`.

- Retained test context (2026-10-11T08:12:36.216Z): tests/integration/api/wage-engine.test.ts; target acc_wage_scale_lines_v2; references `fb719b3e-2c0c-405b-a1ae-d858472d3cde`, `5c151693-1d39-4c93-9301-b9aaab070669`, `9a784d2e-3e78-4ab5-aeab-389bd5d9ebaf`, `86e1d50d-54fa-4d4c-8213-8cff00ad646b`.

- Retained test context (2026-10-11T08:12:36.216Z): tests/integration/api/wage-engine.test.ts; target acc_wage_scales_v2; references `fb719b3e-2c0c-405b-a1ae-d858472d3cde`, `5c151693-1d39-4c93-9301-b9aaab070669`, `9a784d2e-3e78-4ab5-aeab-389bd5d9ebaf`, `86e1d50d-54fa-4d4c-8213-8cff00ad646b`.

- Retained test context (2026-10-11T08:12:36.216Z): tests/integration/api/wage-engine.test.ts; target acc_pay_elements_v2; references `16f10433-9cf7-46de-84a4-c6c5d5d0217f`, `6459cb0b-624e-43c5-9a4a-d184cfe00515`, `2baaa1c1-7796-488e-86da-22001e31a989`, `eaf7cb4a-8710-41b4-ab90-d6089e9f1db1`, `a737e226-25a7-4806-8493-2d5c621f4706`, `21ecf74b-ba5b-4632-8cf6-ad141b4cba63`, `e707590e-f964-478e-bf66-cfa6fd71b8f6`, `740b48c6-9ed7-464d-97aa-4ec243a9fb32`, `6b13b557-af06-4c76-a542-981a0e7ac859`, `f32d7cae-6013-4eb1-b8e5-229a2f87ac9a`, `917ad859-4c27-4525-849c-175981078eb6`, `75736d94-99dc-47a5-a4f7-2cfe5fa578dc`, `b12a03fa-14f0-4a13-b62d-94a96efa62ec`, `ccfe1cd4-20aa-4a47-8867-27d43e1c9f48`.

- Retained test context (2026-10-11T08:12:36.217Z): tests/integration/api/wage-engine.test.ts; target cleanup context; references `64fe0f62-d6c1-4ae1-96f3-06836b2f4ed9`.

- Retained test context (2026-10-11T08:12:37.446Z): tests/integration/api/portage-auto-lock.test.ts; target cleanup context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:37.505Z): tests/integration/api/portage-auto-lock.test.ts; target acc_wage_ledger_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:37.506Z): tests/integration/api/portage-auto-lock.test.ts; target acc_portage_approvals_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:37.506Z): tests/integration/api/portage-auto-lock.test.ts; target acc_monthly_transactions_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:37.507Z): tests/integration/api/portage-auto-lock.test.ts; target acc_ctm_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:37.507Z): tests/integration/api/portage-auto-lock.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:37.507Z): tests/integration/api/portage-auto-lock.test.ts; target acc_engagements_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:37.508Z): tests/integration/api/portage-auto-lock.test.ts; target acc_pay_elements_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:38.874Z): tests/integration/api/vessel-portage.test.ts; target acc_ctm_lines_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:38.875Z): tests/integration/api/vessel-portage.test.ts; target acc_ctm_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:38.876Z): tests/integration/api/vessel-portage.test.ts; target acc_monthly_transactions_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:38.876Z): tests/integration/api/vessel-portage.test.ts; target acc_wage_ledger_v2; references `445e0ba6-66d5-44a8-b2df-3d449fbe6f17`.

- Retained test context (2026-10-11T08:12:38.877Z): tests/integration/api/vessel-portage.test.ts; target acc_calculation_runs_v2; references `b7605a2f-4aa2-4f72-9c4a-0b5f3992208f`.

- Retained test context (2026-10-11T08:12:38.877Z): tests/integration/api/vessel-portage.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:38.878Z): tests/integration/api/vessel-portage.test.ts; target acc_engagements_v2; references `445e0ba6-66d5-44a8-b2df-3d449fbe6f17`.

- Retained test context (2026-10-11T08:12:38.878Z): tests/integration/api/vessel-portage.test.ts; target acc_wage_scale_lines_v2; references `de290ab9-e410-4aa4-bda0-ae52bbdbd8f2`.

- Retained test context (2026-10-11T08:12:38.879Z): tests/integration/api/vessel-portage.test.ts; target acc_wage_scales_v2; references `de290ab9-e410-4aa4-bda0-ae52bbdbd8f2`.

- Retained test context (2026-10-11T08:12:38.879Z): tests/integration/api/vessel-portage.test.ts; target acc_pay_elements_v2; references `a118d22d-acf1-4685-910c-cbdeaa0aec16`, `a0383c75-1fba-4f2c-b7e9-23ff936e6605`, `b4ea48dd-35a9-4b69-9222-df4cc2857ecd`, `8c36ce90-3fc3-45fa-a3cc-59e78098a95e`, `717f57e2-d0f5-4c8e-9a6b-25dc61a6a73d`.

- Retained test context (2026-10-11T08:12:41.630Z): tests/integration/api/contract-detail.test.ts; target acc_wage_ledger_v2; references `f22628cc-701b-4b7b-a8b9-5102ccd94a99`, `9032161b-98d7-4635-91b9-deacb38b8b37`, `4b9c360d-5121-46a1-b10c-303308f364dc`, `10302f89-d9bb-4bc2-a3b7-793f055a253a`.

- Retained test context (2026-10-11T08:12:41.631Z): tests/integration/api/contract-detail.test.ts; target acc_engagement_pay_elements_v2; references `f22628cc-701b-4b7b-a8b9-5102ccd94a99`, `9032161b-98d7-4635-91b9-deacb38b8b37`, `4b9c360d-5121-46a1-b10c-303308f364dc`, `10302f89-d9bb-4bc2-a3b7-793f055a253a`.

- Retained test context (2026-10-11T08:12:41.632Z): tests/integration/api/contract-detail.test.ts; target acc_portage_bills_v2; references `3e4698d2-09d0-4216-aa16-df098bc0b4d6`.

- Retained test context (2026-10-11T08:12:41.632Z): tests/integration/api/contract-detail.test.ts; target acc_engagements_v2; references `f22628cc-701b-4b7b-a8b9-5102ccd94a99`, `9032161b-98d7-4635-91b9-deacb38b8b37`, `4b9c360d-5121-46a1-b10c-303308f364dc`, `10302f89-d9bb-4bc2-a3b7-793f055a253a`.

- Retained test context (2026-10-11T08:12:41.633Z): tests/integration/api/contract-detail.test.ts; target crew_assignments; references `950d7a93-58b5-4bbe-b7ba-4ec5540da5fd`.

- Retained test context (2026-10-11T08:12:41.633Z): tests/integration/api/contract-detail.test.ts; target acc_wage_scale_lines_v2; references `bce11a49-3e98-4af9-a713-6573fe077b4b`.

- Retained test context (2026-10-11T08:12:41.634Z): tests/integration/api/contract-detail.test.ts; target acc_wage_scales_v2; references `bce11a49-3e98-4af9-a713-6573fe077b4b`.

- Retained test context (2026-10-11T08:12:41.634Z): tests/integration/api/contract-detail.test.ts; target acc_pay_elements_v2; references `f0b9d9e9-41e7-430b-bbe9-db8391474a3c`, `75d4c45d-783b-4532-915c-ca8a6079e327`, `82831d32-7dee-4cbc-a897-e118d7327a0f`, `a170f101-cd0d-4949-a488-fac369fb8c98`, `97b58437-eba2-49a2-afac-39382f2331b9`.

- Retained test context (2026-10-11T08:12:41.635Z): tests/integration/api/contract-detail.test.ts; target cleanup context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:47.828Z): tests/integration/api/ctm-carry-forward.test.ts; target acc_ctm_lines_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:12:47.830Z): tests/integration/api/ctm-carry-forward.test.ts; target acc_ctm_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:19.289Z): tests/integration/access-control-management.test.ts; target test_ac_181bc535b5be471fbf1fa9e9237aebdc; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:23.973Z): tests/unit/company-form-planning-lock-order.test.ts; target "cf_lock_29a008e7985547528c10925c4c973232"; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:32.744Z): tests/integration/api/reliever-unassign-assignment.test.ts; target rotation_archive_v2; references `829466ea-7e96-4bc2-892b-0538c67e5cb7`, `5c40cc65-eb4d-4e07-945d-9d62f7a338b2`, `bae60178-0769-49e9-a15b-ec53ca874e50`, `29c89c45-1061-4ccf-808d-5fd816a0ad02`, `99bbfd8b-880c-4514-9a14-9452b173631f`, `c0c25e9c-0209-4bb5-adff-800f61b8972e`, `ec6be8c2-7db1-4374-8c29-6c2bf813c363`, `0a408469-6d39-4f05-989f-5fd5c1bbe049`, `f7cfa60b-0d31-4b47-8b37-2c02bdf2f254`.

- Retained test context (2026-10-11T08:13:32.745Z): tests/integration/api/reliever-unassign-assignment.test.ts; target rotation_entries_v2; references `829466ea-7e96-4bc2-892b-0538c67e5cb7`, `5c40cc65-eb4d-4e07-945d-9d62f7a338b2`, `bae60178-0769-49e9-a15b-ec53ca874e50`, `29c89c45-1061-4ccf-808d-5fd816a0ad02`, `99bbfd8b-880c-4514-9a14-9452b173631f`, `c0c25e9c-0209-4bb5-adff-800f61b8972e`, `ec6be8c2-7db1-4374-8c29-6c2bf813c363`, `0a408469-6d39-4f05-989f-5fd5c1bbe049`, `f7cfa60b-0d31-4b47-8b37-2c02bdf2f254`.

- Retained test context (2026-10-11T08:13:32.745Z): tests/integration/api/reliever-unassign-assignment.test.ts; target vessel_planning_reliever_clear_audit; references `322e848e-bb34-4ce7-93f1-76fb6c9058e3`, `118930f1-9f2e-4b0d-b4c9-c005094c2f0c`, `0200919d-2863-4e9b-bb47-883f6517cbae`, `b153b813-2f29-4049-a775-b256f777ef8e`, `8e08bb83-4a10-4255-a482-cd2191f3455d`, `eebbaca5-100d-4328-bbfc-40fdd5f1112e`, `7717b051-22ce-438c-8efa-29b61d483c6c`, `a23126bb-5c54-4bd4-8c26-441bbc5e2012`, `36c2af98-9216-4942-b4d3-0a7d2b1cb425`, `45f9e141-4d0b-4ddd-ad3f-ede10123f7e5`, `1e0408f5-2bbb-45a6-8091-99c81b5bed6d`, `70f434f4-5ae9-4eb4-84fd-8a388f910d8e`, `63ef06a2-f80d-491d-9236-23395f0c0d98`, `873b596a-1ff0-477e-b0a2-eb5e8ac821cd`, `404e4438-a056-45da-9ad1-59ccc8165b34`, `3f76844c-1ce9-45c2-9fb9-481b8c20b0b6`, `5b829e86-5d26-4ef8-91a1-0392c35eb051`, `673bc130-5e40-41f8-beac-0b483b1302ed`, `2a94efe5-b67e-4596-834c-ad0c7280cd19`, `3cc6ec45-f124-4a9d-a562-9fdc8a621fd4`, `56e3f836-2b5b-4cb1-9a5d-7909503d35fb`, `768dd409-db20-437e-bc6c-76853648ae3d`, `25aa529b-6dbd-43fd-afa4-d6e576f58b83`, `fad51d2b-ac4f-4610-b424-d772e6b05446`, `d6973d1e-ffe0-4cc0-bb4d-fcd876359c00`, `3165aa28-8de1-4658-96cd-eea832172207`, `48657e76-fbc7-49f6-a28b-d72429bc620f`, `4e14a8fd-8ee0-4f22-a786-79afe6760315`, `82f117b3-76f2-446c-8ce5-780f39619178`, `88f0d6d6-0aa3-434b-8966-075715b960bd`, `097f9f9e-ebb4-4513-9f45-19829fd096c3`, `e8c473ef-33a8-48ff-982d-3ee73a83b348`, `da78fd54-a44e-4d8c-84ca-ce5f5614942d`, `fdaf8409-2e84-41af-951d-26d2bd011310`, `b4071254-05b6-4cde-a593-080378e1a35e`, `4aa4121c-182e-4ee7-925a-14e4b1fad5be`, `c86614f3-fb57-468e-926f-b80c57c121a7`, `54853fbb-c743-419e-8de2-841849f89112`, `a2cf534c-2b74-49e4-bd0b-61b9b1124c6d`, `c6177427-c9b8-4d49-9553-0e48a253783d`, `c66a9cf6-3f39-479f-b444-4eea9a2269aa`, `a72fa5cb-2465-47f6-ab9d-cc8dc8345b84`.

- Retained test context (2026-10-11T08:13:32.746Z): tests/integration/api/reliever-unassign-assignment.test.ts; target vessel_planning_assignment_reconciliations; references `322e848e-bb34-4ce7-93f1-76fb6c9058e3`, `118930f1-9f2e-4b0d-b4c9-c005094c2f0c`, `0200919d-2863-4e9b-bb47-883f6517cbae`, `b153b813-2f29-4049-a775-b256f777ef8e`, `8e08bb83-4a10-4255-a482-cd2191f3455d`, `eebbaca5-100d-4328-bbfc-40fdd5f1112e`, `7717b051-22ce-438c-8efa-29b61d483c6c`, `a23126bb-5c54-4bd4-8c26-441bbc5e2012`, `36c2af98-9216-4942-b4d3-0a7d2b1cb425`, `45f9e141-4d0b-4ddd-ad3f-ede10123f7e5`, `1e0408f5-2bbb-45a6-8091-99c81b5bed6d`, `70f434f4-5ae9-4eb4-84fd-8a388f910d8e`, `63ef06a2-f80d-491d-9236-23395f0c0d98`, `873b596a-1ff0-477e-b0a2-eb5e8ac821cd`, `404e4438-a056-45da-9ad1-59ccc8165b34`, `3f76844c-1ce9-45c2-9fb9-481b8c20b0b6`, `5b829e86-5d26-4ef8-91a1-0392c35eb051`, `673bc130-5e40-41f8-beac-0b483b1302ed`, `2a94efe5-b67e-4596-834c-ad0c7280cd19`, `3cc6ec45-f124-4a9d-a562-9fdc8a621fd4`, `56e3f836-2b5b-4cb1-9a5d-7909503d35fb`, `768dd409-db20-437e-bc6c-76853648ae3d`, `25aa529b-6dbd-43fd-afa4-d6e576f58b83`, `fad51d2b-ac4f-4610-b424-d772e6b05446`, `d6973d1e-ffe0-4cc0-bb4d-fcd876359c00`, `3165aa28-8de1-4658-96cd-eea832172207`, `48657e76-fbc7-49f6-a28b-d72429bc620f`, `4e14a8fd-8ee0-4f22-a786-79afe6760315`, `82f117b3-76f2-446c-8ce5-780f39619178`, `88f0d6d6-0aa3-434b-8966-075715b960bd`, `097f9f9e-ebb4-4513-9f45-19829fd096c3`, `e8c473ef-33a8-48ff-982d-3ee73a83b348`, `da78fd54-a44e-4d8c-84ca-ce5f5614942d`, `fdaf8409-2e84-41af-951d-26d2bd011310`, `b4071254-05b6-4cde-a593-080378e1a35e`, `4aa4121c-182e-4ee7-925a-14e4b1fad5be`, `c86614f3-fb57-468e-926f-b80c57c121a7`, `54853fbb-c743-419e-8de2-841849f89112`, `a2cf534c-2b74-49e4-bd0b-61b9b1124c6d`, `c6177427-c9b8-4d49-9553-0e48a253783d`, `c66a9cf6-3f39-479f-b444-4eea9a2269aa`, `a72fa5cb-2465-47f6-ab9d-cc8dc8345b84`.

- Retained test context (2026-10-11T08:13:32.746Z): tests/integration/api/reliever-unassign-assignment.test.ts; target vessel_planning_v2; references `322e848e-bb34-4ce7-93f1-76fb6c9058e3`, `118930f1-9f2e-4b0d-b4c9-c005094c2f0c`, `0200919d-2863-4e9b-bb47-883f6517cbae`, `b153b813-2f29-4049-a775-b256f777ef8e`, `8e08bb83-4a10-4255-a482-cd2191f3455d`, `eebbaca5-100d-4328-bbfc-40fdd5f1112e`, `7717b051-22ce-438c-8efa-29b61d483c6c`, `a23126bb-5c54-4bd4-8c26-441bbc5e2012`, `36c2af98-9216-4942-b4d3-0a7d2b1cb425`, `45f9e141-4d0b-4ddd-ad3f-ede10123f7e5`, `1e0408f5-2bbb-45a6-8091-99c81b5bed6d`, `70f434f4-5ae9-4eb4-84fd-8a388f910d8e`, `63ef06a2-f80d-491d-9236-23395f0c0d98`, `873b596a-1ff0-477e-b0a2-eb5e8ac821cd`, `404e4438-a056-45da-9ad1-59ccc8165b34`, `3f76844c-1ce9-45c2-9fb9-481b8c20b0b6`, `5b829e86-5d26-4ef8-91a1-0392c35eb051`, `673bc130-5e40-41f8-beac-0b483b1302ed`, `2a94efe5-b67e-4596-834c-ad0c7280cd19`, `3cc6ec45-f124-4a9d-a562-9fdc8a621fd4`, `56e3f836-2b5b-4cb1-9a5d-7909503d35fb`, `768dd409-db20-437e-bc6c-76853648ae3d`, `25aa529b-6dbd-43fd-afa4-d6e576f58b83`, `fad51d2b-ac4f-4610-b424-d772e6b05446`, `d6973d1e-ffe0-4cc0-bb4d-fcd876359c00`, `3165aa28-8de1-4658-96cd-eea832172207`, `48657e76-fbc7-49f6-a28b-d72429bc620f`, `4e14a8fd-8ee0-4f22-a786-79afe6760315`, `82f117b3-76f2-446c-8ce5-780f39619178`, `88f0d6d6-0aa3-434b-8966-075715b960bd`, `097f9f9e-ebb4-4513-9f45-19829fd096c3`, `e8c473ef-33a8-48ff-982d-3ee73a83b348`, `da78fd54-a44e-4d8c-84ca-ce5f5614942d`, `fdaf8409-2e84-41af-951d-26d2bd011310`, `b4071254-05b6-4cde-a593-080378e1a35e`, `4aa4121c-182e-4ee7-925a-14e4b1fad5be`, `c86614f3-fb57-468e-926f-b80c57c121a7`, `54853fbb-c743-419e-8de2-841849f89112`, `a2cf534c-2b74-49e4-bd0b-61b9b1124c6d`, `c6177427-c9b8-4d49-9553-0e48a253783d`, `c66a9cf6-3f39-479f-b444-4eea9a2269aa`, `a72fa5cb-2465-47f6-ab9d-cc8dc8345b84`.

- Retained test context (2026-10-11T08:13:32.747Z): tests/integration/api/reliever-unassign-assignment.test.ts; target crew_assignments; references `21f8b805-95d6-439e-909d-dfea4d3e4861`, `aca9f575-f197-4334-bcb6-90dfe0238298`, `d53de285-c7b7-403a-ac47-3ceaeae762b6`, `fc638202-eac4-4447-9137-1e0425455962`, `1972b8aa-d5f4-4e18-9545-5f4c7a7d5fe3`, `ae5d5d6d-cd94-4349-a56f-0f2a0becc20e`, `d3d0f3f6-a4b9-4698-8ae2-aa0c6c7c0ca2`, `92b58747-2b83-420a-8bcc-d77117da4145`, `2fb81ac3-5c21-4858-891c-26165deadd82`, `a29d7952-d77a-47d3-afa1-6c8e77c68421`, `ff60fc43-5faa-4e49-b31c-5244fc15ccd2`, `0564eebe-6b57-41f3-b3d5-9cb3c4692ecb`, `519abc2e-6e17-477f-8528-b65f9a5bc8ac`, `451a932b-3c4c-4571-8402-93496386800f`, `a96648d5-7e67-4108-8e69-0a38fe64ba8f`, `d108968c-f143-4b04-a203-8585e956e8e9`, `e468f344-0724-4058-a67d-2eba86dea2b9`, `cb63353b-f169-4dec-b955-9322fef59515`, `e841c928-4d5b-49f7-8e8b-3bc8c2067943`, `1f15e3ee-a999-45e5-9386-5d5a1a6f3d98`, `47f8c4f4-b7e0-4d61-8e1a-27203eb1b095`, `db533462-1cc6-40af-8fe1-ab3b7fa23780`, `3f4bc4d3-8b38-4e6b-a81a-d42357e6aead`, `ec5cda3b-c6d0-4317-8d7f-d5db07735c0e`, `06a4a3c6-8a6f-482d-89bd-5593557185fb`, `07ff6691-929a-4da2-b27e-07392a4fe5c6`, `4929c2b8-b7b0-4c4c-99d6-2781763037bd`, `dc55527d-eb00-46e2-9ef1-2391ef29634c`, `72791924-cfac-482c-bdbc-4aa877aa42f8`, `3440cd7e-784c-4056-b216-763b864f2f11`, `66b30ff2-ebde-4ad6-9b0b-682770fb1b5b`, `c1e7aab2-6246-4c63-a14f-d5b2541977f2`, `465515cf-b6c1-4326-ad8a-9ec58e0d21cb`, `c587cca4-4935-432c-a8f7-06055f80d827`, `93292e06-65d0-4025-b932-9a53148c6285`, `9534b70c-3a37-4db2-ab48-ea9384a1dd2d`, `b664fceb-9387-4604-a344-25a849a8600d`, `cefc6857-56ff-4e80-be32-63be569088f3`, `008bb604-d25b-4bb5-ad34-b6be0284273f`, `e1fb409e-a0bd-4c46-b5ed-6a65be7bcd8e`, `c3be4d00-9091-41f9-9a54-477ff172b642`, `9738e561-c3c2-4e68-8617-43b075b445b8`, `143ee55d-c280-4d56-88ae-ff9274b76028`, `64d75615-557e-4d3d-96d0-9a6ded71f6c6`, `07c85f38-67ec-475d-bd6f-90a76eb7ede5`.

- Retained test context (2026-10-11T08:13:32.747Z): tests/integration/api/reliever-unassign-assignment.test.ts; target crew_sea_service; references `e86a1f8a-e6bb-4368-86b8-ed110b64deda`, `c7cf10f5-b955-440b-80de-569a02ac6281`, `eaa7b4fc-b413-46db-bc29-4718f9ac7356`, `e315b1de-5944-4970-9514-748bf299ca23`, `6bc0b59e-b01a-4e84-a554-70e9263c9297`, `5d84e20d-25db-4d29-91e1-725f95179aa2`, `c7086034-8337-4242-928a-3afd2de948ec`, `5b560c83-79c3-408d-9166-f580a4029246`, `6761e052-1209-4935-827d-5b1bb18248d3`, `87f8b62a-92eb-4e53-87ab-2e901802e70e`, `0380f371-7a96-491b-9874-07217e93b821`, `2f6942cd-4979-42e4-91eb-ac808cecfb9d`, `22f7e57f-d787-4ea0-aae9-9c02adb11811`, `922cc267-fae2-4693-b103-ce49cdcf6602`, `b5620c84-2e1f-4000-841e-4c88ce1bcfe6`, `3fc879e6-0c66-4b99-bcc4-b7443d6a9c42`, `ee6aa2e4-b3f4-41c0-81e0-8a642a8cee16`, `9886d826-2a2e-4fe5-9ec8-94c1cf210d91`, `2ff3245f-b0a2-46bd-9dde-73c66854e844`, `9b8053e0-4f7c-45c5-920d-465d7bbc2631`, `7a5d9dc1-6edb-480b-8b32-60338694a998`, `b478a437-08e7-40f2-aab8-219bdd54ebe6`, `67a1ec6c-a7f7-446e-8664-85ca6f0ed59d`, `542ca9d2-73db-40fa-9b49-f585195f747b`, `58849f52-aea9-4aff-893c-dd6ae7e73f51`, `c618db55-c889-441b-ac98-528f4daf517b`, `11050ffb-a77b-4d40-84d1-5e87144203af`.

- Retained test context (2026-10-11T08:13:32.747Z): tests/integration/api/reliever-unassign-assignment.test.ts; target crew_members_v2; references `e86a1f8a-e6bb-4368-86b8-ed110b64deda`, `c7cf10f5-b955-440b-80de-569a02ac6281`, `eaa7b4fc-b413-46db-bc29-4718f9ac7356`, `e315b1de-5944-4970-9514-748bf299ca23`, `6bc0b59e-b01a-4e84-a554-70e9263c9297`, `5d84e20d-25db-4d29-91e1-725f95179aa2`, `c7086034-8337-4242-928a-3afd2de948ec`, `5b560c83-79c3-408d-9166-f580a4029246`, `6761e052-1209-4935-827d-5b1bb18248d3`, `87f8b62a-92eb-4e53-87ab-2e901802e70e`, `0380f371-7a96-491b-9874-07217e93b821`, `2f6942cd-4979-42e4-91eb-ac808cecfb9d`, `22f7e57f-d787-4ea0-aae9-9c02adb11811`, `922cc267-fae2-4693-b103-ce49cdcf6602`, `b5620c84-2e1f-4000-841e-4c88ce1bcfe6`, `3fc879e6-0c66-4b99-bcc4-b7443d6a9c42`, `ee6aa2e4-b3f4-41c0-81e0-8a642a8cee16`, `9886d826-2a2e-4fe5-9ec8-94c1cf210d91`, `2ff3245f-b0a2-46bd-9dde-73c66854e844`, `9b8053e0-4f7c-45c5-920d-465d7bbc2631`, `7a5d9dc1-6edb-480b-8b32-60338694a998`, `b478a437-08e7-40f2-aab8-219bdd54ebe6`, `67a1ec6c-a7f7-446e-8664-85ca6f0ed59d`, `542ca9d2-73db-40fa-9b49-f585195f747b`, `58849f52-aea9-4aff-893c-dd6ae7e73f51`, `c618db55-c889-441b-ac98-528f4daf517b`, `11050ffb-a77b-4d40-84d1-5e87144203af`.

- Retained test context (2026-10-11T08:13:32.747Z): tests/integration/api/reliever-unassign-assignment.test.ts; target master_vessels; references `ed89e50f-37dd-4f17-9628-64e232a4b7eb`, `8a6f8462-3b80-46df-9548-6ff50f572b69`, `eef3a8f9-d7ac-40b2-9b78-acccdf6f2a0e`, `0233a862-79ce-44a8-9ea0-12dbbe43479f`, `7397b1ea-8544-42c2-b96d-27a59f782ff6`, `8377447b-b970-4f9a-8396-8d5d0aa23445`, `8c8390e1-4f3e-4833-bc2f-d18cec4f5131`, `e3b45477-c5d3-4481-9437-270ad45a22f5`, `c212da4b-f995-46a7-9264-6bb726431e55`, `bf4f7163-bd74-48e6-ab6f-df23d79797bf`, `e744fffb-8306-4295-bdba-c779cb6f15d8`, `4d1905be-43e1-4cf2-b5ee-eedb4d5e00a9`, `353981af-2886-42ca-b18d-1e36ba2af71b`, `e15881c7-adc2-41ad-ad04-ee01db4586ad`, `51113480-4d1b-4ea6-9ba2-2e732f43c11d`, `507f9414-1ff1-4d9c-84b3-755357f6fd8a`, `c4e4f07b-5080-4da3-a327-ef5529109a2b`, `7aac1ea2-addd-45f8-b959-c3090342eb9d`, `c0f5e234-800a-4046-85bb-c25fe89f8a5e`, `f99cc69d-09f7-4f16-aee5-11afa9d2fa92`, `fe6e6d5d-aa27-4c0c-ba5f-44c2e4970b20`, `90b1dc48-16b6-4db0-9ad5-cfa4d2ff37b2`, `b91e7d3e-4681-4ca8-9fa8-6c4ca1f36dfe`, `0faef79b-31c8-41d2-bb27-bd79d12e5b3f`, `d32685f8-a738-4f2a-a92d-68721cea24b5`, `a25dd5ae-b97d-4e00-8c41-bda4b7fe4535`, `14f085c0-ae13-4bf2-a0a7-831d2ceb7265`, `d01e5423-a5c0-4429-a3e3-0a926010d707`, `0f1aa8c9-d910-4ffc-92c3-97f4dc9b7e23`, `9c5ac983-4acd-451f-a2fb-456bdc8cf19b`, `23a72d0f-d898-42f7-8782-3e86e9404602`, `97208c9b-d021-4deb-9732-42837b9d80dc`, `c0435181-d1b0-4cbc-bf46-a5b9c8ff5852`, `1d19c626-af95-497c-bda0-ae1f739047c0`, `93b17075-f973-4f68-a5e7-c84e8c266e73`.

- Retained test context (2026-10-11T08:13:32.748Z): tests/integration/api/reliever-unassign-assignment.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:39.614Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_signatures; references `837000d3-782a-47ed-bcf3-c20722f9c142`, `c1e7b05e-d81f-479d-b72f-1d415140671d`.

- Retained test context (2026-10-11T08:13:39.615Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_signature_attachments; references `837000d3-782a-47ed-bcf3-c20722f9c142`, `c1e7b05e-d81f-479d-b72f-1d415140671d`.

- Retained test context (2026-10-11T08:13:39.615Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_answers; references `a43d07ce-4d5c-4890-b8a4-a8166b8570d6`, `6948dba7-89d0-4434-8b4f-2b70a7264157`, `62347110-12ea-4ff0-b4ce-4be902758163`, `d46b80c6-c148-4f5a-9710-b200405ba88f`.

- Retained test context (2026-10-11T08:13:39.615Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_states; references `a43d07ce-4d5c-4890-b8a4-a8166b8570d6`, `6948dba7-89d0-4434-8b4f-2b70a7264157`, `62347110-12ea-4ff0-b4ce-4be902758163`, `d46b80c6-c148-4f5a-9710-b200405ba88f`.

- Retained test context (2026-10-11T08:13:39.616Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_answers; references `59e939c8-87bf-4c42-a4d9-3b45cd973ebe`.

- Retained test context (2026-10-11T08:13:39.616Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_section_states; references `59e939c8-87bf-4c42-a4d9-3b45cd973ebe`.

- Retained test context (2026-10-11T08:13:39.616Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_company_submission_assignments; references `4f2ec690-3a5f-4eab-9135-394ad3527df8`, `db072222-20da-4533-966b-f57ff821436c`, `0f086b94-55d2-4192-82f3-f2a9ab5651f4`, `07d09517-7d37-4ccc-9ed7-bb21a0beef8e`, `bac12449-50c2-48b0-b9c6-1d5c2836a8dc`.

- Retained test context (2026-10-11T08:13:39.617Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_company_submissions; references `4f2ec690-3a5f-4eab-9135-394ad3527df8`, `db072222-20da-4533-966b-f57ff821436c`, `0f086b94-55d2-4192-82f3-f2a9ab5651f4`, `07d09517-7d37-4ccc-9ed7-bb21a0beef8e`, `bac12449-50c2-48b0-b9c6-1d5c2836a8dc`.

- Retained test context (2026-10-11T08:13:39.617Z): tests/integration/api/company-form-submission-starts.test.ts; target crew_assignments; references `4f2ec690-3a5f-4eab-9135-394ad3527df8`, `db072222-20da-4533-966b-f57ff821436c`, `0f086b94-55d2-4192-82f3-f2a9ab5651f4`, `07d09517-7d37-4ccc-9ed7-bb21a0beef8e`, `bac12449-50c2-48b0-b9c6-1d5c2836a8dc`.

- Retained test context (2026-10-11T08:13:39.617Z): tests/integration/api/company-form-submission-starts.test.ts; target crew_members_v2; references `a7f28e8a-54c9-4d1d-8e92-6e8be74b6146`.

- Retained test context (2026-10-11T08:13:39.618Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_questions; references `ec91e1cf-a851-42cd-ab0b-29eff0bfcf42`, `97420152-485b-49c4-9ae3-49a60900034a`, `bf66097e-c432-446e-ae40-9e0934d1eab3`, `73ef9146-2f0d-4444-aae6-a8cf58f82ee8`.

- Retained test context (2026-10-11T08:13:39.618Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_sections; references `ec91e1cf-a851-42cd-ab0b-29eff0bfcf42`, `97420152-485b-49c4-9ae3-49a60900034a`, `bf66097e-c432-446e-ae40-9e0934d1eab3`, `73ef9146-2f0d-4444-aae6-a8cf58f82ee8`.

- Retained test context (2026-10-11T08:13:39.618Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_options; references `9dd081db-32f7-4203-9363-8771b7dc5d0c`, `8d2b1210-f934-4c1c-a86a-7b0f02bc603d`, `9fa639a7-0227-4908-8e7b-877fd64d793e`, `0b29f6fe-933e-4138-babd-2a27c6807edb`.

- Retained test context (2026-10-11T08:13:39.619Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_option_sets; references `9dd081db-32f7-4203-9363-8771b7dc5d0c`, `8d2b1210-f934-4c1c-a86a-7b0f02bc603d`, `9fa639a7-0227-4908-8e7b-877fd64d793e`, `0b29f6fe-933e-4138-babd-2a27c6807edb`.

- Retained test context (2026-10-11T08:13:39.619Z): tests/integration/api/company-form-submission-starts.test.ts; target frm_form_parts; references `6e466d0e-f32b-4033-98ef-928976da56ed`, `07b7754d-61fe-45ab-87fc-a1fb1a1a7749`, `4ff89b37-4019-4f91-a7c4-dc8d6e5496c3`, `3263a33b-ce52-4b24-b9ff-917f9a68e65b`.

- Retained test context (2026-10-11T08:13:39.619Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessel_types; references `67e93015-36c0-41e2-b5f4-d7cfdb49bf30`.

- Retained test context (2026-10-11T08:13:39.619Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_form_versions_v2; references `a8cc52ba-8b00-4e5a-909b-653ad37a90ce`, `573ff10e-0f6f-4606-b612-862d4b2679e0`, `cf8a7f7c-130b-45d0-b962-85fc59507cef`, `e0befdf9-59a3-4da1-85f0-ab7cbf8fae12`, `e6ec06bf-c046-4000-8682-aff3d759fae7`.

- Retained test context (2026-10-11T08:13:39.620Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_forms_v2; references `02a1eb32-2646-4fe3-849d-5c313d1ab0cf`, `78243ea5-1792-4401-b4b4-4587228a13f3`, `42b7b180-352b-44e8-bb0b-d599780fc4b2`.

- Retained test context (2026-10-11T08:13:39.620Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_resource_action_grants; references `00f6d5bb-3765-4918-a73f-1fb852ea063a`, `46407372-bf83-4701-9fb5-3d053c3b014b`, `0bcf2d7d-1a82-441a-b1ea-5ce00ceeb993`, `9e82462e-2089-463f-b0e2-6094ed31627c`, `1de08b2a-e1d3-48dd-a96d-eb51951716ab`.

- Retained test context (2026-10-11T08:13:39.620Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_roleaccess_ac; references `00f6d5bb-3765-4918-a73f-1fb852ea063a`, `46407372-bf83-4701-9fb5-3d053c3b014b`, `0bcf2d7d-1a82-441a-b1ea-5ce00ceeb993`, `9e82462e-2089-463f-b0e2-6094ed31627c`, `1de08b2a-e1d3-48dd-a96d-eb51951716ab`.

- Retained test context (2026-10-11T08:13:39.621Z): tests/integration/api/company-form-submission-starts.test.ts; target adm_rolemaster_ac; references `00f6d5bb-3765-4918-a73f-1fb852ea063a`, `46407372-bf83-4701-9fb5-3d053c3b014b`, `0bcf2d7d-1a82-441a-b1ea-5ce00ceeb993`, `9e82462e-2089-463f-b0e2-6094ed31627c`, `1de08b2a-e1d3-48dd-a96d-eb51951716ab`.

- Retained test context (2026-10-11T08:13:39.621Z): tests/integration/api/company-form-submission-starts.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:39.621Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessels; references `eed30f61-a397-4ed1-8c3b-33088178c671`.

- Retained test context (2026-10-11T08:13:39.621Z): tests/integration/api/company-form-submission-starts.test.ts; target master_vessels; references `87dee103-4bed-4249-beb8-f9be4c2421b3`.

- Retained test context (2026-10-11T08:13:39.625Z): tests/integration/api/company-form-submission-starts.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:45.549Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:45.550Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:45.550Z): tests/integration/api/company-form-signing-and-completion.test.ts; target cleanup context; references `9234b316-ad6b-4c24-9954-e35298a9ae0f`, `443d475b-10f9-4e02-929a-110a4d97cf08`, `8aecb6d5-6f85-42c6-8145-22b1f3b054eb`, `f214af73-13f7-4771-a966-f8e424dc51c5`, `700e9e88-a6ad-4279-9eec-ae94be893ec3`.

- Retained test context (2026-10-11T08:13:45.551Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_signatures; references `9234b316-ad6b-4c24-9954-e35298a9ae0f`, `443d475b-10f9-4e02-929a-110a4d97cf08`, `8aecb6d5-6f85-42c6-8145-22b1f3b054eb`, `f214af73-13f7-4771-a966-f8e424dc51c5`, `700e9e88-a6ad-4279-9eec-ae94be893ec3`.

- Retained test context (2026-10-11T08:13:45.551Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_signature_attachments; references `ef056c3d-8bf5-43dc-ae97-eba8935b0105`, `03b5d6c5-55f5-4fa3-91d2-8eed740e33d5`, `bd13e134-c803-41ec-ba54-f5d82b3341a9`, `430204f0-00e3-4ed4-b0cd-63da1c13130f`, `13e0adac-c382-4592-8ea5-dee0b6e98acc`, `505c0837-2b92-4458-a0cc-ad044716226f`.

- Retained test context (2026-10-11T08:13:45.552Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_system_snapshots; references `9234b316-ad6b-4c24-9954-e35298a9ae0f`, `443d475b-10f9-4e02-929a-110a4d97cf08`, `8aecb6d5-6f85-42c6-8145-22b1f3b054eb`, `f214af73-13f7-4771-a966-f8e424dc51c5`, `700e9e88-a6ad-4279-9eec-ae94be893ec3`.

- Retained test context (2026-10-11T08:13:45.552Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_answers; references `9234b316-ad6b-4c24-9954-e35298a9ae0f`, `443d475b-10f9-4e02-929a-110a4d97cf08`, `8aecb6d5-6f85-42c6-8145-22b1f3b054eb`, `f214af73-13f7-4771-a966-f8e424dc51c5`, `700e9e88-a6ad-4279-9eec-ae94be893ec3`.

- Retained test context (2026-10-11T08:13:45.552Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_section_states; references `9234b316-ad6b-4c24-9954-e35298a9ae0f`, `443d475b-10f9-4e02-929a-110a4d97cf08`, `8aecb6d5-6f85-42c6-8145-22b1f3b054eb`, `f214af73-13f7-4771-a966-f8e424dc51c5`, `700e9e88-a6ad-4279-9eec-ae94be893ec3`.

- Retained test context (2026-10-11T08:13:45.553Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submission_assignments; references `9234b316-ad6b-4c24-9954-e35298a9ae0f`, `443d475b-10f9-4e02-929a-110a4d97cf08`, `8aecb6d5-6f85-42c6-8145-22b1f3b054eb`, `f214af73-13f7-4771-a966-f8e424dc51c5`, `700e9e88-a6ad-4279-9eec-ae94be893ec3`.

- Retained test context (2026-10-11T08:13:45.553Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_company_submissions; references `9234b316-ad6b-4c24-9954-e35298a9ae0f`, `443d475b-10f9-4e02-929a-110a4d97cf08`, `8aecb6d5-6f85-42c6-8145-22b1f3b054eb`, `f214af73-13f7-4771-a966-f8e424dc51c5`, `700e9e88-a6ad-4279-9eec-ae94be893ec3`.

- Retained test context (2026-10-11T08:13:45.554Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_questions; references `9ec38517-0714-4218-8bd8-d41b57c76c37`, `df92dc53-dae5-4a9a-9c5d-4fbbc2f94029`, `578b2315-9dd4-4197-bdd7-07c11370b5a1`, `3dfe8aef-f0c0-4dfd-87e1-1ae1b3503512`.

- Retained test context (2026-10-11T08:13:45.554Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_sections; references `9ec38517-0714-4218-8bd8-d41b57c76c37`, `df92dc53-dae5-4a9a-9c5d-4fbbc2f94029`, `578b2315-9dd4-4197-bdd7-07c11370b5a1`, `3dfe8aef-f0c0-4dfd-87e1-1ae1b3503512`.

- Retained test context (2026-10-11T08:13:45.555Z): tests/integration/api/company-form-signing-and-completion.test.ts; target frm_form_parts; references `9ec38517-0714-4218-8bd8-d41b57c76c37`, `df92dc53-dae5-4a9a-9c5d-4fbbc2f94029`, `578b2315-9dd4-4197-bdd7-07c11370b5a1`, `3dfe8aef-f0c0-4dfd-87e1-1ae1b3503512`.

- Retained test context (2026-10-11T08:13:45.555Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_form_versions_v2; references `9ec38517-0714-4218-8bd8-d41b57c76c37`, `df92dc53-dae5-4a9a-9c5d-4fbbc2f94029`, `578b2315-9dd4-4197-bdd7-07c11370b5a1`, `3dfe8aef-f0c0-4dfd-87e1-1ae1b3503512`.

- Retained test context (2026-10-11T08:13:45.555Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_forms_v2; references `29382e28-1cc3-4b21-8d45-74b67f0f3dd3`, `53aea1ea-7b21-4272-aaeb-15c512f3aa45`.

- Retained test context (2026-10-11T08:13:45.555Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_assignments; references `ad71c77b-0e40-44e0-919c-0d9ca9aa55fe`, `eac29664-faa5-459b-bdd8-bd89743f5812`, `934d964c-0f21-42a3-9873-20a219ba64ac`, `43d87fdb-6479-47ab-bbd0-bbc15cae862b`.

- Retained test context (2026-10-11T08:13:45.556Z): tests/integration/api/company-form-signing-and-completion.test.ts; target crew_members_v2; references `7c38346b-18e7-433e-b85e-0103cdad41de`.

- Retained test context (2026-10-11T08:13:45.556Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `b23ec750-3f0f-49f5-8e94-ba73ea0d0a74`.

- Retained test context (2026-10-11T08:13:45.556Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_vessels; references `bc1c80e6-be2d-4ac1-a0b2-f4f2a8c95723`.

- Retained test context (2026-10-11T08:13:45.557Z): tests/integration/api/company-form-signing-and-completion.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:45.559Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_resource_action_grants; references `513a9245-369a-416d-98c9-3b456a44a896`, `87a300c8-7b00-4acb-9064-f0e4b473267c`, `d1551b88-4b9b-4f91-b9b4-7df1748213de`, `a0285e67-db08-4259-8268-5805a171ec8b`.

- Retained test context (2026-10-11T08:13:45.559Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_roleaccess_ac; references `513a9245-369a-416d-98c9-3b456a44a896`, `87a300c8-7b00-4acb-9064-f0e4b473267c`, `d1551b88-4b9b-4f91-b9b4-7df1748213de`, `a0285e67-db08-4259-8268-5805a171ec8b`.

- Retained test context (2026-10-11T08:13:45.559Z): tests/integration/api/company-form-signing-and-completion.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:45.560Z): tests/integration/api/company-form-signing-and-completion.test.ts; target adm_rolemaster_ac; references `513a9245-369a-416d-98c9-3b456a44a896`, `87a300c8-7b00-4acb-9064-f0e4b473267c`, `d1551b88-4b9b-4f91-b9b4-7df1748213de`, `a0285e67-db08-4259-8268-5805a171ec8b`.

- Retained test context (2026-10-11T08:13:48.428Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `5acf0213-f1b3-4c58-825e-805627cc5143`.

- Retained test context (2026-10-11T08:13:48.429Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `5acf0213-f1b3-4c58-825e-805627cc5143`.

- Retained test context (2026-10-11T08:13:48.429Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `5acf0213-f1b3-4c58-825e-805627cc5143`.

- Retained test context (2026-10-11T08:13:48.430Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `5acf0213-f1b3-4c58-825e-805627cc5143`.

- Retained test context (2026-10-11T08:13:48.430Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `5acf0213-f1b3-4c58-825e-805627cc5143`.

- Retained test context (2026-10-11T08:13:48.431Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `c6d2dd6e-6c36-40fa-92a7-df7d1a6a5634`.

- Retained test context (2026-10-11T08:13:48.431Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `c6d2dd6e-6c36-40fa-92a7-df7d1a6a5634`.

- Retained test context (2026-10-11T08:13:48.431Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `c6d2dd6e-6c36-40fa-92a7-df7d1a6a5634`.

- Retained test context (2026-10-11T08:13:48.432Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `c6d2dd6e-6c36-40fa-92a7-df7d1a6a5634`.

- Retained test context (2026-10-11T08:13:48.432Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `c6d2dd6e-6c36-40fa-92a7-df7d1a6a5634`.

- Retained test context (2026-10-11T08:13:48.432Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `63467b50-2516-4ecc-9d73-4040292f0544`.

- Retained test context (2026-10-11T08:13:48.433Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `63467b50-2516-4ecc-9d73-4040292f0544`.

- Retained test context (2026-10-11T08:13:48.433Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `63467b50-2516-4ecc-9d73-4040292f0544`.

- Retained test context (2026-10-11T08:13:48.434Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `63467b50-2516-4ecc-9d73-4040292f0544`.

- Retained test context (2026-10-11T08:13:48.434Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `63467b50-2516-4ecc-9d73-4040292f0544`.

- Retained test context (2026-10-11T08:13:48.435Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `b5079d04-81ac-458e-b011-13703252af8a`.

- Retained test context (2026-10-11T08:13:48.435Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `b5079d04-81ac-458e-b011-13703252af8a`.

- Retained test context (2026-10-11T08:13:48.436Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `b5079d04-81ac-458e-b011-13703252af8a`.

- Retained test context (2026-10-11T08:13:48.436Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `b5079d04-81ac-458e-b011-13703252af8a`.

- Retained test context (2026-10-11T08:13:48.436Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `b5079d04-81ac-458e-b011-13703252af8a`.

- Retained test context (2026-10-11T08:13:48.437Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `c210a877-6d48-48aa-bb12-7c4d8c76db88`.

- Retained test context (2026-10-11T08:13:48.437Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `c210a877-6d48-48aa-bb12-7c4d8c76db88`.

- Retained test context (2026-10-11T08:13:48.438Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `c210a877-6d48-48aa-bb12-7c4d8c76db88`.

- Retained test context (2026-10-11T08:13:48.438Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `c210a877-6d48-48aa-bb12-7c4d8c76db88`.

- Retained test context (2026-10-11T08:13:48.439Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `c210a877-6d48-48aa-bb12-7c4d8c76db88`.

- Retained test context (2026-10-11T08:13:48.439Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `fe9b1a6d-697e-4dd5-b5d3-bb9594addf79`.

- Retained test context (2026-10-11T08:13:48.439Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `fe9b1a6d-697e-4dd5-b5d3-bb9594addf79`.

- Retained test context (2026-10-11T08:13:48.440Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `fe9b1a6d-697e-4dd5-b5d3-bb9594addf79`.

- Retained test context (2026-10-11T08:13:48.440Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `fe9b1a6d-697e-4dd5-b5d3-bb9594addf79`.

- Retained test context (2026-10-11T08:13:48.441Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `fe9b1a6d-697e-4dd5-b5d3-bb9594addf79`.

- Retained test context (2026-10-11T08:13:48.441Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `f8cbdaca-580b-4ee2-bfda-72c490190b23`.

- Retained test context (2026-10-11T08:13:48.441Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `f8cbdaca-580b-4ee2-bfda-72c490190b23`.

- Retained test context (2026-10-11T08:13:48.441Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `f8cbdaca-580b-4ee2-bfda-72c490190b23`.

- Retained test context (2026-10-11T08:13:48.442Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `f8cbdaca-580b-4ee2-bfda-72c490190b23`.

- Retained test context (2026-10-11T08:13:48.442Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `f8cbdaca-580b-4ee2-bfda-72c490190b23`.

- Retained test context (2026-10-11T08:13:48.442Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `e17c02fb-8e01-4023-b1b4-e5574bb8672a`.

- Retained test context (2026-10-11T08:13:48.442Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `e17c02fb-8e01-4023-b1b4-e5574bb8672a`.

- Retained test context (2026-10-11T08:13:48.443Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `e17c02fb-8e01-4023-b1b4-e5574bb8672a`.

- Retained test context (2026-10-11T08:13:48.443Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `e17c02fb-8e01-4023-b1b4-e5574bb8672a`.

- Retained test context (2026-10-11T08:13:48.443Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `e17c02fb-8e01-4023-b1b4-e5574bb8672a`.

- Retained test context (2026-10-11T08:13:48.443Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `c3533775-2faa-451d-848b-4987847b6ab7`.

- Retained test context (2026-10-11T08:13:48.444Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `c3533775-2faa-451d-848b-4987847b6ab7`.

- Retained test context (2026-10-11T08:13:48.444Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `c3533775-2faa-451d-848b-4987847b6ab7`.

- Retained test context (2026-10-11T08:13:48.444Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `c3533775-2faa-451d-848b-4987847b6ab7`.

- Retained test context (2026-10-11T08:13:48.445Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `c3533775-2faa-451d-848b-4987847b6ab7`.

- Retained test context (2026-10-11T08:13:48.445Z): tests/integration/api/company-form-applicability.test.ts; target frm_questions; references `924f42a4-85e7-4077-b077-31fc86be102b`.

- Retained test context (2026-10-11T08:13:48.445Z): tests/integration/api/company-form-applicability.test.ts; target frm_sections; references `924f42a4-85e7-4077-b077-31fc86be102b`.

- Retained test context (2026-10-11T08:13:48.445Z): tests/integration/api/company-form-applicability.test.ts; target frm_form_parts; references `924f42a4-85e7-4077-b077-31fc86be102b`.

- Retained test context (2026-10-11T08:13:48.445Z): tests/integration/api/company-form-applicability.test.ts; target adm_form_versions_v2; references `924f42a4-85e7-4077-b077-31fc86be102b`.

- Retained test context (2026-10-11T08:13:48.446Z): tests/integration/api/company-form-applicability.test.ts; target adm_forms_v2; references `924f42a4-85e7-4077-b077-31fc86be102b`.

- Retained test context (2026-10-11T08:13:51.474Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_section_signatures; references `673054b2-8dc2-4363-bb8c-74118b55aa7b`, `4c895935-761e-478c-9f5e-e3f6c73db3ce`.

- Retained test context (2026-10-11T08:13:51.475Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_answers; references `673054b2-8dc2-4363-bb8c-74118b55aa7b`, `4c895935-761e-478c-9f5e-e3f6c73db3ce`.

- Retained test context (2026-10-11T08:13:51.476Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_section_states; references `673054b2-8dc2-4363-bb8c-74118b55aa7b`, `4c895935-761e-478c-9f5e-e3f6c73db3ce`.

- Retained test context (2026-10-11T08:13:51.476Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_company_submission_assignments; references `673054b2-8dc2-4363-bb8c-74118b55aa7b`, `4c895935-761e-478c-9f5e-e3f6c73db3ce`.

- Retained test context (2026-10-11T08:13:51.477Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_company_submissions; references `673054b2-8dc2-4363-bb8c-74118b55aa7b`, `4c895935-761e-478c-9f5e-e3f6c73db3ce`.

- Retained test context (2026-10-11T08:13:51.477Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_signature_attachments; references `51f4d42c-40a0-486e-88e3-4566ec74538a`.

- Retained test context (2026-10-11T08:13:51.478Z): tests/integration/api/company-form-submission-boundary.test.ts; target crew_assignments; references `dbf95a0e-86a1-4cb4-b991-6c32157f7966`, `ec64db56-08b2-4dac-ac0e-6481a1c7701b`.

- Retained test context (2026-10-11T08:13:51.478Z): tests/integration/api/company-form-submission-boundary.test.ts; target crew_members_v2; references `7bb3f917-a3c5-4b2d-bd06-711ae6bad05a`.

- Retained test context (2026-10-11T08:13:51.478Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_questions; references `b9644010-f84e-4cfa-bb9d-d4c02a90d1de`.

- Retained test context (2026-10-11T08:13:51.479Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_sections; references `3b339936-846f-4c16-9356-b7ab8b428d2f`.

- Retained test context (2026-10-11T08:13:51.479Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_form_parts; references `5a634eca-fb35-4fb0-8ab5-933f2ae90f0a`.

- Retained test context (2026-10-11T08:13:51.480Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_options; references `f6b8424f-d6cc-4706-87ee-0befe85c24e3`.

- Retained test context (2026-10-11T08:13:51.480Z): tests/integration/api/company-form-submission-boundary.test.ts; target frm_option_sets; references `f6b8424f-d6cc-4706-87ee-0befe85c24e3`.

- Retained test context (2026-10-11T08:13:51.480Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_form_versions_v2; references `521073d2-5ba2-4504-bb29-d94bd73b715a`.

- Retained test context (2026-10-11T08:13:51.481Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_forms_v2; references `018dcca8-703a-4760-a4b2-d05af117e143`.

- Retained test context (2026-10-11T08:13:51.481Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_resource_action_grants; references `6d2cb921-3abf-4908-9a54-ebcd41d01ad4`, `6bb395a7-e61e-4ad9-b362-83f9da7501b2`, `65b3b15f-16f0-4b4e-925b-8af313248eb5`, `738871ca-f668-496a-afe0-6ac1836b1843`, `b5922aba-905f-4fb9-89e3-8dd4416d7089`, `e360885a-b518-4fa3-bba9-ed364ce51441`, `1d21c353-a4bb-4c5d-a5d2-06765f029086`.

- Retained test context (2026-10-11T08:13:51.481Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_roleaccess_ac; references `6d2cb921-3abf-4908-9a54-ebcd41d01ad4`, `6bb395a7-e61e-4ad9-b362-83f9da7501b2`, `65b3b15f-16f0-4b4e-925b-8af313248eb5`, `738871ca-f668-496a-afe0-6ac1836b1843`, `b5922aba-905f-4fb9-89e3-8dd4416d7089`, `e360885a-b518-4fa3-bba9-ed364ce51441`, `1d21c353-a4bb-4c5d-a5d2-06765f029086`.

- Retained test context (2026-10-11T08:13:51.482Z): tests/integration/api/company-form-submission-boundary.test.ts; target adm_rolemaster_ac; references `6d2cb921-3abf-4908-9a54-ebcd41d01ad4`, `6bb395a7-e61e-4ad9-b362-83f9da7501b2`, `65b3b15f-16f0-4b4e-925b-8af313248eb5`, `738871ca-f668-496a-afe0-6ac1836b1843`, `b5922aba-905f-4fb9-89e3-8dd4416d7089`, `e360885a-b518-4fa3-bba9-ed364ce51441`, `1d21c353-a4bb-4c5d-a5d2-06765f029086`.

- Retained test context (2026-10-11T08:13:51.482Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:51.482Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessels; references `247ce6dc-a65b-4f0c-900b-4d607022649f`.

- Retained test context (2026-10-11T08:13:51.483Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessels; references `d478b1a3-4a94-457c-8bfa-87ae29060d69`.

- Retained test context (2026-10-11T08:13:51.483Z): tests/integration/api/company-form-submission-boundary.test.ts; target master_vessel_types; references `a748b860-6c65-401c-938c-71d1aa7f778a`.

- Retained test context (2026-10-11T08:13:51.490Z): tests/integration/api/company-form-submission-boundary.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:53.392Z): tests/integration/api/company-form-submission-void-races.test.ts; target cleanup context; references `5dfadcf9-4db2-4e4e-bef5-8204d5e37312`.

- Retained test context (2026-10-11T08:13:53.479Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_section_signatures; references `dcde05da-fa0b-4209-9399-31b91b5ee848`, `72845d55-8fef-40d5-bf6c-6c8d4b8d9f97`, `302f9207-4853-4981-aa78-410f890750af`, `9d752133-eeeb-45c9-a312-6d15136a1376`.

- Retained test context (2026-10-11T08:13:53.480Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_answers; references `dcde05da-fa0b-4209-9399-31b91b5ee848`, `72845d55-8fef-40d5-bf6c-6c8d4b8d9f97`, `302f9207-4853-4981-aa78-410f890750af`, `9d752133-eeeb-45c9-a312-6d15136a1376`.

- Retained test context (2026-10-11T08:13:53.480Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submission_system_snapshots; references `dcde05da-fa0b-4209-9399-31b91b5ee848`, `72845d55-8fef-40d5-bf6c-6c8d4b8d9f97`, `302f9207-4853-4981-aa78-410f890750af`, `9d752133-eeeb-45c9-a312-6d15136a1376`.

- Retained test context (2026-10-11T08:13:53.481Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_section_states; references `dcde05da-fa0b-4209-9399-31b91b5ee848`, `72845d55-8fef-40d5-bf6c-6c8d4b8d9f97`, `302f9207-4853-4981-aa78-410f890750af`, `9d752133-eeeb-45c9-a312-6d15136a1376`.

- Retained test context (2026-10-11T08:13:53.481Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submission_assignments; references `dcde05da-fa0b-4209-9399-31b91b5ee848`, `72845d55-8fef-40d5-bf6c-6c8d4b8d9f97`, `302f9207-4853-4981-aa78-410f890750af`, `9d752133-eeeb-45c9-a312-6d15136a1376`.

- Retained test context (2026-10-11T08:13:53.482Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_company_submissions; references `dcde05da-fa0b-4209-9399-31b91b5ee848`, `72845d55-8fef-40d5-bf6c-6c8d4b8d9f97`, `302f9207-4853-4981-aa78-410f890750af`, `9d752133-eeeb-45c9-a312-6d15136a1376`.

- Retained test context (2026-10-11T08:13:53.482Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_signature_attachments; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:53.483Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_questions; references `ee30ef71-0326-4f76-8e7e-79992f8021fe`.

- Retained test context (2026-10-11T08:13:53.483Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_sections; references `7ad7833f-3b0b-45e0-8ce4-ae6fae351d23`.

- Retained test context (2026-10-11T08:13:53.483Z): tests/integration/api/company-form-submission-void-races.test.ts; target frm_form_parts; references `dde98d8d-c93c-493e-a034-81682fc09c3a`.

- Retained test context (2026-10-11T08:13:53.484Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_form_versions_v2; references `1ca2676d-6571-41ca-966f-1b5c7e81cf32`.

- Retained test context (2026-10-11T08:13:53.484Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_forms_v2; references `f6a729b7-f8dd-4b34-87d4-148a54e8f6a1`.

- Retained test context (2026-10-11T08:13:53.485Z): tests/integration/api/company-form-submission-void-races.test.ts; target crew_assignments; references `8ce3f6e2-5ee4-461c-9563-26b112a50af1`, `341f5cc2-0a71-4387-a02e-841d78f05500`, `e7221b31-3861-4111-a419-8c74871dad39`, `a6580d51-31e5-4c30-ad10-309d982ad853`.

- Retained test context (2026-10-11T08:13:53.485Z): tests/integration/api/company-form-submission-void-races.test.ts; target crew_members_v2; references `e80cffee-3789-43b3-866c-0dc1823eaf53`.

- Retained test context (2026-10-11T08:13:53.486Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_resource_action_grants; references `5dfadcf9-4db2-4e4e-bef5-8204d5e37312`, `2b4653b1-4672-4456-a25a-c94e8674c82a`.

- Retained test context (2026-10-11T08:13:53.486Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_roleaccess_ac; references `5dfadcf9-4db2-4e4e-bef5-8204d5e37312`.

- Retained test context (2026-10-11T08:13:53.487Z): tests/integration/api/company-form-submission-void-races.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:53.487Z): tests/integration/api/company-form-submission-void-races.test.ts; target adm_rolemaster_ac; references `5dfadcf9-4db2-4e4e-bef5-8204d5e37312`, `2b4653b1-4672-4456-a25a-c94e8674c82a`.

- Retained test context (2026-10-11T08:13:53.488Z): tests/integration/api/company-form-submission-void-races.test.ts; target master_vessels; references `d79fc879-70ff-43bc-bd1d-93a92ee377c6`.

- Retained test context (2026-10-11T08:13:53.492Z): tests/integration/api/company-form-submission-void-races.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:55.686Z): tests/integration/company-form-stage-less-runtime.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:55.765Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submission_system_snapshots; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:55.765Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submission_system_snapshots; references `49f8fbff-ad9d-4e57-b15b-4671070b5c16`, `3c4d084e-d9e5-4805-87a6-348adb39a3b9`, `560c2380-8a0b-4eb7-917d-20d6301a70f0`, `b06f59a9-ba5d-4b25-bdf9-0a1e1416d0b9`, `3428221a-164c-4a1f-acfc-90af6c78f222`.

- Retained test context (2026-10-11T08:13:55.766Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_section_signatures; references `49f8fbff-ad9d-4e57-b15b-4671070b5c16`, `3c4d084e-d9e5-4805-87a6-348adb39a3b9`, `560c2380-8a0b-4eb7-917d-20d6301a70f0`, `b06f59a9-ba5d-4b25-bdf9-0a1e1416d0b9`, `3428221a-164c-4a1f-acfc-90af6c78f222`.

- Retained test context (2026-10-11T08:13:55.768Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_answers; references `49f8fbff-ad9d-4e57-b15b-4671070b5c16`, `3c4d084e-d9e5-4805-87a6-348adb39a3b9`, `560c2380-8a0b-4eb7-917d-20d6301a70f0`, `b06f59a9-ba5d-4b25-bdf9-0a1e1416d0b9`, `3428221a-164c-4a1f-acfc-90af6c78f222`.

- Retained test context (2026-10-11T08:13:55.769Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_section_states; references `49f8fbff-ad9d-4e57-b15b-4671070b5c16`, `3c4d084e-d9e5-4805-87a6-348adb39a3b9`, `560c2380-8a0b-4eb7-917d-20d6301a70f0`, `b06f59a9-ba5d-4b25-bdf9-0a1e1416d0b9`, `3428221a-164c-4a1f-acfc-90af6c78f222`.

- Retained test context (2026-10-11T08:13:55.769Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_company_submissions; references `49f8fbff-ad9d-4e57-b15b-4671070b5c16`, `3c4d084e-d9e5-4805-87a6-348adb39a3b9`, `560c2380-8a0b-4eb7-917d-20d6301a70f0`, `b06f59a9-ba5d-4b25-bdf9-0a1e1416d0b9`, `3428221a-164c-4a1f-acfc-90af6c78f222`.

- Retained test context (2026-10-11T08:13:55.769Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_signature_attachments; references `2929bbd3-ecf0-44c5-b633-5a01f1b5d93d`, `6150f827-a372-4a02-8795-ddae08e9f70e`, `ed0576f3-2736-417a-bffc-5d2f522671ee`, `2ab22469-2fff-4113-8240-4dc1b7210c78`, `5dbba124-0713-4878-9b20-aa0a4a9debda`, `1566ceb8-7353-47bc-8acf-9169044e7b35`.

- Retained test context (2026-10-11T08:13:55.770Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_questions; references `759d5f04-d3bb-4885-b65f-665920204cf2`, `5e6d630a-3806-47de-ad08-8356658347f0`, `7944277a-ef38-4a4b-8d1a-8a96d70634ed`, `829996ae-2591-42d4-a1c0-efa19334477c`, `139119f0-5e80-4e96-9569-c743a8328c5d`, `560cb4e6-b3e5-45c1-9f66-a16e00c3a8e7`, `947992c4-52d4-4c9a-b577-ca48554b7147`.

- Retained test context (2026-10-11T08:13:55.770Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_sections; references `9011f61f-43f1-4d0e-b1f3-adf55b92ca13`, `9eba72db-b31b-4d50-b43b-3f0a0c2d38de`, `b9be102b-5c9a-4905-8d8e-3b6dd468bf47`, `30c813c0-e69d-493c-924d-71e2fccaa6a5`, `e2670ac4-c1ff-443e-a1f8-c5d6680ee1a6`.

- Retained test context (2026-10-11T08:13:55.770Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_form_parts; references `f7d6239c-ceaf-4eb6-ad0c-a324529c001b`.

- Retained test context (2026-10-11T08:13:55.771Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_form_versions_v2; references `df5c71da-ec65-46dd-ae6f-fe2a3998c639`.

- Retained test context (2026-10-11T08:13:55.771Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_forms_v2; references `a7e560a4-240a-4e3f-a704-069e6ee7cb6d`.

- Retained test context (2026-10-11T08:13:55.771Z): tests/integration/company-form-stage-less-runtime.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:55.771Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_roleaccess_ac; references `40ff8945-4cdf-45df-8ae4-0bc72ec118d0`.

- Retained test context (2026-10-11T08:13:55.772Z): tests/integration/company-form-stage-less-runtime.test.ts; target adm_rolemaster_ac; references `40ff8945-4cdf-45df-8ae4-0bc72ec118d0`.

- Retained test context (2026-10-11T08:13:55.772Z): tests/integration/company-form-stage-less-runtime.test.ts; target frm_subject_types; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:58.279Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_answers; references `1c9ef2e9-0b0d-42c6-9db9-6e0a9007594d`.

- Retained test context (2026-10-11T08:13:58.280Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_section_states; references `1c9ef2e9-0b0d-42c6-9db9-6e0a9007594d`.

- Retained test context (2026-10-11T08:13:58.282Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_company_submission_assignments; references `1c9ef2e9-0b0d-42c6-9db9-6e0a9007594d`.

- Retained test context (2026-10-11T08:13:58.283Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_company_submissions; references `1c9ef2e9-0b0d-42c6-9db9-6e0a9007594d`.

- Retained test context (2026-10-11T08:13:58.283Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_questions; references `758a752b-8983-4d86-8a2e-7e2e1e0d5d6c`, `d9068c1e-5e69-4144-8419-7183f2efdeff`, `63aeffe3-a95f-4ec2-9f78-11d789f95126`, `4de7e28a-a3ba-4e4c-a8ca-91b115eb11fc`, `78aee19a-52e4-454c-a991-0f69c3727a91`, `715b6664-ea65-4b0b-b606-10c17bfa3c57`, `2d5bba14-7576-40ee-9460-2dabace95866`, `62a1a8f5-6a49-4fcd-93b7-744119743a2b`, `22965816-7c7f-423d-8fb0-4269b89c00cd`, `55fe9711-d98c-4711-a3f6-b3704f29e0ed`, `8d6fcf09-0b27-4076-a30f-86c48dca5be9`, `33e268a1-db52-4013-a79f-70221efc64b5`, `52bc80d8-58aa-4e27-9c68-fe235428477b`.

- Retained test context (2026-10-11T08:13:58.284Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_sections; references `9a69c7d0-bce6-4b13-893c-0ddccbd2844f`.

- Retained test context (2026-10-11T08:13:58.284Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_form_parts; references `8c8379a8-88c0-442e-9ee2-033c3ce48b33`.

- Retained test context (2026-10-11T08:13:58.285Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_options; references `4b47fe25-079b-46ea-9ce9-b02ac67458b9`.

- Retained test context (2026-10-11T08:13:58.286Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target frm_option_sets; references `4b47fe25-079b-46ea-9ce9-b02ac67458b9`.

- Retained test context (2026-10-11T08:13:58.286Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_form_versions_v2; references `fc87892a-1f01-45a3-8fc4-71fb2d54d75f`.

- Retained test context (2026-10-11T08:13:58.287Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_forms_v2; references `2f30bc17-8fdd-447e-862c-2ce03d050fe0`.

- Retained test context (2026-10-11T08:13:58.287Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target crew_assignments; references `ce15d12a-69e8-44bb-b399-a607e7f919cb`.

- Retained test context (2026-10-11T08:13:58.287Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target crew_members_v2; references `4289ae97-55b4-4358-8a67-d6a929d217a4`.

- Retained test context (2026-10-11T08:13:58.288Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:13:58.288Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_resource_action_grants; references `4d1683aa-8a77-496d-ae26-37d996d834e7`.

- Retained test context (2026-10-11T08:13:58.288Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_roleaccess_ac; references `4d1683aa-8a77-496d-ae26-37d996d834e7`.

- Retained test context (2026-10-11T08:13:58.289Z): tests/integration/api/company-form-submission-answer-roundtrip.test.ts; target adm_rolemaster_ac; references `4d1683aa-8a77-496d-ae26-37d996d834e7`.

- Retained test context (2026-10-11T08:13:59.977Z): tests/integration/api/crew-finance.test.ts; target acc_settlement_adjustments_v2; references `b114ec21-1e9f-4e4b-8332-980fe5afe33c`, `eb5f0879-10a6-464b-a9d2-c7d756c72cb7`, `4402e5b4-2de0-43f3-b59e-3ac842aa1202`, `e69685e2-ab7a-4be0-bf81-475b22b650d7`.

- Retained test context (2026-10-11T08:13:59.979Z): tests/integration/api/crew-finance.test.ts; target acc_settlement_approvals_v2; references `b114ec21-1e9f-4e4b-8332-980fe5afe33c`, `eb5f0879-10a6-464b-a9d2-c7d756c72cb7`, `4402e5b4-2de0-43f3-b59e-3ac842aa1202`, `e69685e2-ab7a-4be0-bf81-475b22b650d7`.

- Retained test context (2026-10-11T08:13:59.979Z): tests/integration/api/crew-finance.test.ts; target acc_settlements_v2; references `b114ec21-1e9f-4e4b-8332-980fe5afe33c`, `eb5f0879-10a6-464b-a9d2-c7d756c72cb7`, `4402e5b4-2de0-43f3-b59e-3ac842aa1202`, `e69685e2-ab7a-4be0-bf81-475b22b650d7`.

- Retained test context (2026-10-11T08:13:59.980Z): tests/integration/api/crew-finance.test.ts; target acc_wage_ledger_v2; references `b114ec21-1e9f-4e4b-8332-980fe5afe33c`, `eb5f0879-10a6-464b-a9d2-c7d756c72cb7`, `4402e5b4-2de0-43f3-b59e-3ac842aa1202`, `e69685e2-ab7a-4be0-bf81-475b22b650d7`.

- Retained test context (2026-10-11T08:13:59.980Z): tests/integration/api/crew-finance.test.ts; target acc_calculation_runs_v2; references `63ce782a-bf09-4424-910b-76b48191344e`, `3fb1233c-972a-40e1-b7bf-29441ad37be0`, `f97f1f97-2c2b-4c88-a632-d82fae0e78a4`, `ea6db892-8826-43db-a556-7bd75a2ffc39`, `9064867c-6378-42ab-bae0-65b2c6d3dd2e`, `daeb9b9f-03f9-4593-a1c5-2ba8644bc71f`, `b41d0228-a9c0-4a30-a447-530f78664cf2`, `d0848cb2-6128-40b9-b4b3-9199714ab089`, `749b5d5d-5688-4f6e-9174-eef1792fa69a`, `88d47f13-9067-4726-8468-bd18caf7cc75`, `df566392-756b-4aca-a6c4-609fd123dbc2`, `177351ee-d93c-4138-9ad8-efa79cd7fcbd`, `df8ccb95-8b8e-4cb2-9973-b623cc4c1112`, `3bc42946-1f84-4429-825b-12ab97843361`.

- Retained test context (2026-10-11T08:13:59.981Z): tests/integration/api/crew-finance.test.ts; target acc_calculation_runs_v2; references `b114ec21-1e9f-4e4b-8332-980fe5afe33c`, `eb5f0879-10a6-464b-a9d2-c7d756c72cb7`, `4402e5b4-2de0-43f3-b59e-3ac842aa1202`, `e69685e2-ab7a-4be0-bf81-475b22b650d7`.

- Retained test context (2026-10-11T08:13:59.981Z): tests/integration/api/crew-finance.test.ts; target acc_monthly_transactions_v2; references `cd06d623-1b2d-4183-95c9-8b64cc0516ec`, `49627948-7389-428d-aee9-eb9678cf25eb`, `20936bef-103f-448a-876c-17f2259ac5da`, `d59e31e6-4854-4d6b-b0a0-8b80af810527`.

- Retained test context (2026-10-11T08:13:59.982Z): tests/integration/api/crew-finance.test.ts; target acc_bond_items_v2; references `cd06d623-1b2d-4183-95c9-8b64cc0516ec`, `d59e31e6-4854-4d6b-b0a0-8b80af810527`.

- Retained test context (2026-10-11T08:13:59.982Z): tests/integration/api/crew-finance.test.ts; target acc_advances_v2; references `49627948-7389-428d-aee9-eb9678cf25eb`, `d59e31e6-4854-4d6b-b0a0-8b80af810527`.

- Retained test context (2026-10-11T08:13:59.983Z): tests/integration/api/crew-finance.test.ts; target acc_allotments_v2; references `20936bef-103f-448a-876c-17f2259ac5da`, `d59e31e6-4854-4d6b-b0a0-8b80af810527`.

- Retained test context (2026-10-11T08:13:59.983Z): tests/integration/api/crew-finance.test.ts; target acc_engagements_v2; references `b114ec21-1e9f-4e4b-8332-980fe5afe33c`, `eb5f0879-10a6-464b-a9d2-c7d756c72cb7`, `4402e5b4-2de0-43f3-b59e-3ac842aa1202`, `e69685e2-ab7a-4be0-bf81-475b22b650d7`.

- Retained test context (2026-10-11T08:13:59.984Z): tests/integration/api/crew-finance.test.ts; target crew_members_v2; references `cd06d623-1b2d-4183-95c9-8b64cc0516ec`, `49627948-7389-428d-aee9-eb9678cf25eb`, `20936bef-103f-448a-876c-17f2259ac5da`, `d59e31e6-4854-4d6b-b0a0-8b80af810527`.

- Retained test context (2026-10-11T08:13:59.984Z): tests/integration/api/crew-finance.test.ts; target acc_wage_scale_lines_v2; references `02513635-0b35-4bba-a849-7426e1000972`.

- Retained test context (2026-10-11T08:13:59.985Z): tests/integration/api/crew-finance.test.ts; target acc_wage_scales_v2; references `02513635-0b35-4bba-a849-7426e1000972`.

- Retained test context (2026-10-11T08:13:59.985Z): tests/integration/api/crew-finance.test.ts; target acc_pay_elements_v2; references `c48e81bd-fa69-4aad-8c91-6fbc07678805`, `228dc3df-4c68-4c40-bc3c-454f8d05053f`, `e474fcc1-16e6-4fd0-bd6f-74d8f6614283`, `4fe0e67f-5869-4fcc-bea3-b21407e28668`.

- Retained test context (2026-10-11T08:14:03.789Z): tests/integration/api/company-form-submission-races.test.ts; target frm_answers; references `103adfd2-fed1-43f2-b8ff-d7262f982c66`, `aaa95b8b-6108-4d9e-b302-7d149998d638`, `7384a254-cd48-47de-ae5f-ed0a65059e59`.

- Retained test context (2026-10-11T08:14:03.790Z): tests/integration/api/company-form-submission-races.test.ts; target frm_section_states; references `103adfd2-fed1-43f2-b8ff-d7262f982c66`, `aaa95b8b-6108-4d9e-b302-7d149998d638`, `7384a254-cd48-47de-ae5f-ed0a65059e59`.

- Retained test context (2026-10-11T08:14:03.791Z): tests/integration/api/company-form-submission-races.test.ts; target frm_company_submission_assignments; references `103adfd2-fed1-43f2-b8ff-d7262f982c66`, `aaa95b8b-6108-4d9e-b302-7d149998d638`, `7384a254-cd48-47de-ae5f-ed0a65059e59`.

- Retained test context (2026-10-11T08:14:03.791Z): tests/integration/api/company-form-submission-races.test.ts; target frm_company_submissions; references `103adfd2-fed1-43f2-b8ff-d7262f982c66`, `aaa95b8b-6108-4d9e-b302-7d149998d638`, `7384a254-cd48-47de-ae5f-ed0a65059e59`.

- Retained test context (2026-10-11T08:14:03.792Z): tests/integration/api/company-form-submission-races.test.ts; target crew_assignments; references `407d1918-011c-4962-bc5f-0cd070b691ac`, `16677bc0-5f8c-4fda-914b-466f8d469ad7`, `00c8df9a-3ea4-4fad-940b-c96000148ead`, `37cc945b-9a1d-48b9-8962-b1052f1d2896`, `07ac9cba-1091-4e82-83fb-28863c5085df`.

- Retained test context (2026-10-11T08:14:03.792Z): tests/integration/api/company-form-submission-races.test.ts; target frm_questions; references `7734a155-14ce-4ba0-b3ad-d09cf71775e9`.

- Retained test context (2026-10-11T08:14:03.793Z): tests/integration/api/company-form-submission-races.test.ts; target frm_sections; references `bc1c64a7-c16b-4192-a367-1a7b818ba200`.

- Retained test context (2026-10-11T08:14:03.793Z): tests/integration/api/company-form-submission-races.test.ts; target frm_form_parts; references `1811731f-ee23-4dbc-b1bb-c6c7062ebcb0`.

- Retained test context (2026-10-11T08:14:03.793Z): tests/integration/api/company-form-submission-races.test.ts; target adm_form_versions_v2; references `8c6f9cd4-2861-44f5-a715-6c6c0723bced`.

- Retained test context (2026-10-11T08:14:03.794Z): tests/integration/api/company-form-submission-races.test.ts; target adm_forms_v2; references `740c47f1-4538-4c0c-9fc7-93e210cd8a3b`.

- Retained test context (2026-10-11T08:14:03.794Z): tests/integration/api/company-form-submission-races.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:03.795Z): tests/integration/api/company-form-submission-races.test.ts; target adm_resource_action_grants; references `77fe23fc-4454-4659-baf4-f27456c50248`.

- Retained test context (2026-10-11T08:14:03.795Z): tests/integration/api/company-form-submission-races.test.ts; target adm_roleaccess_ac; references `77fe23fc-4454-4659-baf4-f27456c50248`.

- Retained test context (2026-10-11T08:14:03.795Z): tests/integration/api/company-form-submission-races.test.ts; target adm_rolemaster_ac; references `77fe23fc-4454-4659-baf4-f27456c50248`.

- Retained test context (2026-10-11T08:14:06.539Z): tests/integration/api/accounts-reports.test.ts; target cleanup context; references `64fe0f62-d6c1-4ae1-96f3-06836b2f4ed9`.

- Retained test context (2026-10-11T08:14:06.569Z): tests/integration/api/accounts-reports.test.ts; target acc_wage_ledger_v2; references `f129cdb0-2c74-48bc-a834-36fc7e3e2126`, `d2b0d30f-ae22-491e-a484-cfa882a54113`, `206e76fc-330b-4b82-b0dd-a332310b8e2a`, `8374f929-fea2-4f88-9606-af35ba441239`, `66926075-8ef2-4938-971d-7d9add4d2814`, `6998feef-2065-4076-943d-a3c513fc22bd`, `15430fb7-aed9-4475-a44b-5612f835c006`, `c2158e68-a3b2-441b-ad3b-3a96edda7a93`, `f524909e-ee42-40c1-b94d-d5da9eb5a42d`, `98c0b55c-e94d-42b1-813f-00e04c4d1ecb`, `e15da47d-9f61-402c-a9aa-ff57108f0ab2`, `ea3f45dc-0a3a-45b3-a456-5ac12a892f72`, `87e93670-f663-4b26-9b71-0a3002257f57`.

- Retained test context (2026-10-11T08:14:06.569Z): tests/integration/api/accounts-reports.test.ts; target acc_portage_bills_v2; references `82da02c6-4b0c-4c66-b447-6e523a2f939d`.

- Retained test context (2026-10-11T08:14:06.570Z): tests/integration/api/accounts-reports.test.ts; target acc_engagements_v2; references `cd7eb4d9-866d-4f43-97f0-689f91c00a03`, `1b725428-f934-4f6f-9f60-62862852a57a`, `9d980d3f-0f7e-4214-bea1-e70bb983c15c`, `0fc537c4-1e52-40da-a514-155877ded385`.

- Retained test context (2026-10-11T08:14:06.570Z): tests/integration/api/accounts-reports.test.ts; target crew_members_v2; references `13fa82d6-fdc3-4498-85e1-ac5a7d172298`, `c6e82f4c-f92f-40ff-91f4-854539526725`, `ee3f7482-d191-4082-a45b-e21c1fab7e64`.

- Retained test context (2026-10-11T08:14:06.571Z): tests/integration/api/accounts-reports.test.ts; target acc_pay_elements_v2; references `7cf277d5-21e7-4667-95ca-1db15a70107d`, `e53310f4-b35d-4aae-b6b2-802ba8b15275`, `4f48fc4f-3566-481d-87d5-3926ce42d7a0`, `1a665dda-a98e-41b0-aa1d-7a4ae357af8e`, `ce4443b8-aacb-4ea5-ad78-df887e5cab0f`.

- Retained test context (2026-10-11T08:14:07.584Z): dimension context cf_dimensions_12c1076d; target registered_fixture_context; references `01a330fa-4cd8-4e39-914b-6fa14e78bc7a`, `00bc9274-da8c-41f9-97de-35c91a66269a`, `393cb1cc-5873-469e-8e91-a6091676457c`, `68ff1c15-17a4-4a39-9e5f-dc3a77fea4bc`.

- Retained test context (2026-10-11T08:14:07.799Z): cf_dimensions_12c1076d.adm_available_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.817Z): cf_dimensions_12c1076d.adm_company_ranks_v2 canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.838Z): cf_dimensions_12c1076d.master_vessels canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.856Z): cf_dimensions_12c1076d.master_vessel_types canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.875Z): cf_dimensions_12c1076d.master_nationalities canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.891Z): cf_dimensions_12c1076d.master_manning_agents canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.905Z): cf_dimensions_12c1076d.master_crew_pools canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.920Z): cf_dimensions_12c1076d.master_fleet_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.937Z): cf_dimensions_12c1076d.master_additional_groups canonical master copies; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:07.963Z): canonical master copies cf_dimensions_12c1076d; target registered_fixture_context; references `55d4c4b0-8e9c-479c-a9f0-9f3fbe95e0e5`, `743feb08-841a-11ed-aa7c-7003bca91a86`.

- Retained test context (2026-10-11T08:14:11.118Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_section_signatures; references `1847c026-6940-4308-a4f0-b6eb82c54de9`.

- Retained test context (2026-10-11T08:14:11.120Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_signature_attachments; references `81f522e5-3469-4a8b-a6a1-b87c75a6522a`, `6c3d7a71-6a5c-45d7-9126-fba794ae89e8`.

- Retained test context (2026-10-11T08:14:11.120Z): tests/integration/debriefing-submission.acceptance.test.ts; target retained_file_assets; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:11.121Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_answers; references `1847c026-6940-4308-a4f0-b6eb82c54de9`.

- Retained test context (2026-10-11T08:14:11.122Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_section_states; references `1847c026-6940-4308-a4f0-b6eb82c54de9`.

- Retained test context (2026-10-11T08:14:11.122Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_debriefing_submissions; references `1847c026-6940-4308-a4f0-b6eb82c54de9`.

- Retained test context (2026-10-11T08:14:11.123Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_questions; references `90d7aef8-0fab-4969-b256-8c6c2356d1da`.

- Retained test context (2026-10-11T08:14:11.123Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_sections; references `1012cef3-afc6-4f97-b0e7-0631d4d06688`, `57ba01ff-f305-467b-bfe9-dfd2788490a9`, `21579c7e-acac-456e-8fe6-c39e80046993`.

- Retained test context (2026-10-11T08:14:11.123Z): tests/integration/debriefing-submission.acceptance.test.ts; target frm_form_parts; references `f8e09690-1e80-4b91-b4ea-4a69e2116880`.

- Retained test context (2026-10-11T08:14:11.124Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_form_versions_v2; references `4d420ce7-0eba-4c32-98ed-e2880bac8b01`, `bd3100a7-44ac-4e87-b0f6-683412ffff81`.

- Retained test context (2026-10-11T08:14:11.124Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_rank_groups_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:11.125Z): tests/integration/debriefing-submission.acceptance.test.ts; target adm_forms_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:11.125Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_debriefings; references `e5bb324e-ba9a-4e2b-84b2-8ce0af03303e`, `3f3c8bdc-7b28-4ec3-810a-a9e9f204dbcc`, `c140c624-5245-4a11-b627-59161c979177`.

- Retained test context (2026-10-11T08:14:11.125Z): tests/integration/debriefing-submission.acceptance.test.ts; target crew_members_v2; references `136ad6d4-0994-4507-a8d2-c9a6c693b357`.

- Retained test context (2026-10-11T08:14:11.126Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_vessels; references `dbb96024-10f6-4591-bcf7-2cc9a014a8fc`.

- Retained test context (2026-10-11T08:14:11.126Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_vessel_types; references `5e689803-f29d-434a-b191-5f5d7586ed2d`.

- Retained test context (2026-10-11T08:14:11.127Z): tests/integration/debriefing-submission.acceptance.test.ts; target master_users; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:17.514Z): dimension release definition; target registered_fixture_context; references `dfc9b00c-db5e-41e5-8c4b-c96f06b1de51`, `54373163-f70d-4e3e-9610-8989465f9c8d`.

- Retained test context (2026-10-11T08:14:17.597Z): dimension release draft content; target registered_fixture_context; references `a1b5b45c-3eca-4f86-a199-76e4e994f87e`, `16ede3ca-60ba-4324-a989-223fd2c9cd8f`, `ac71e437-2ff9-4e2d-a961-b203dfcb48ea`, `e6d6f8c9-c5c5-4946-86d3-7a24c5afc84d`.

- Retained test context (2026-10-11T08:14:17.638Z): dimension release condition data; target registered_fixture_context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:17.772Z): dimension release copied draft; target registered_fixture_context; references `730dc8e9-0017-4bdb-a616-0965dd057855`.

- Retained test context (2026-10-11T08:14:20.144Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_settlements_v2; references `8cfb289c-07c3-4d4f-bf55-9c5521e192ef`, `aa2a6995-8f6d-4838-ba96-285a1cec8a54`, `2f96fe33-0cea-4120-b1f6-541fe230fbd6`.

- Retained test context (2026-10-11T08:14:20.146Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_wage_ledger_v2; references `8cfb289c-07c3-4d4f-bf55-9c5521e192ef`, `aa2a6995-8f6d-4838-ba96-285a1cec8a54`, `2f96fe33-0cea-4120-b1f6-541fe230fbd6`.

- Retained test context (2026-10-11T08:14:20.147Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_calculation_runs_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:20.147Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_calculation_runs_v2; references `8cfb289c-07c3-4d4f-bf55-9c5521e192ef`, `aa2a6995-8f6d-4838-ba96-285a1cec8a54`, `2f96fe33-0cea-4120-b1f6-541fe230fbd6`.

- Retained test context (2026-10-11T08:14:20.148Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:20.148Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_monthly_transactions_v2; references `eb8c3c98-24c4-49fd-ae64-51480d3ddd5e`.

- Retained test context (2026-10-11T08:14:20.149Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_engagements_v2; references `8cfb289c-07c3-4d4f-bf55-9c5521e192ef`, `aa2a6995-8f6d-4838-ba96-285a1cec8a54`, `2f96fe33-0cea-4120-b1f6-541fe230fbd6`.

- Retained test context (2026-10-11T08:14:20.149Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_wage_scale_lines_v2; references `9711cf4e-eece-4b0f-b7ea-b5565e837598`.

- Retained test context (2026-10-11T08:14:20.150Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_wage_scales_v2; references `9711cf4e-eece-4b0f-b7ea-b5565e837598`.

- Retained test context (2026-10-11T08:14:20.151Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target acc_pay_elements_v2; references `c5ce0bea-44e4-4ecd-be6b-ecc68ae1b8aa`, `da9be30f-7a1b-45ef-86c3-de31969aac7f`.

- Retained test context (2026-10-11T08:14:20.151Z): tests/integration/api/wage-engine-settlement-skip.test.ts; target cleanup context; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:21.421Z): tests/integration/api/approval-identity.test.ts; target acc_settlement_approvals_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:21.423Z): tests/integration/api/approval-identity.test.ts; target acc_settlements_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:21.424Z): tests/integration/api/approval-identity.test.ts; target acc_portage_approvals_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:21.424Z): tests/integration/api/approval-identity.test.ts; target acc_portage_bills_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:21.425Z): tests/integration/api/approval-identity.test.ts; target acc_engagements_v2; references schema/context retained (no UUID parameters).

- Retained test context (2026-10-11T08:14:50.229Z): tests/unit/fixture-retention.test.ts; target crew_assignments; references schema/context retained (no UUID parameters).
