# Retained Company Form regression fixtures

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
