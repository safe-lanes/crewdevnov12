# Retained Company Form regression fixtures

These are retained development fixtures, not disposable test data. Do not delete them during cleanup or use them as production records.

## Joining declaration regression

Prepared on 2026-10-02 for the Planning entry point. Under the revised limits, normal Rotation has deployed the seafarer into a new Planning row on existing vessel 02. Closing browser signing acceptance is pending.

| Record | Name or purpose | UUID |
| --- | --- | --- |
| Existing vessel | vessel 02; configured Pumpman rank R017; no synthetic vessel was created | `743feb08-841a-11ed-aa7c-7003bca91a86` |
| Synthetic seafarer | TEST ONLY JOINING DECLARATION REGRESSION; employee number `TEST-JOINING-DECL-REGRESSION` | `424584fc-dc59-4f85-aa14-30781eb8477e` |
| Synthetic Office actor | TEST ONLY JOINING DECLARATION CREWING ACTOR; master user ID 99 | `fe6a15d7-489f-4b53-8f3e-12e95915cfb3` |
| Synthetic role | TEST ONLY Joining Declaration Crewing | `95a1aff2-c823-4e08-b991-97072e4ae2a0` |
| Assignment | Planned assignment created by normal Rotation | `10df4ffb-db61-46a9-ac7a-cc5e290b7376` |
| Planning | New row; no existing Planning row modified | `accc9d51-ea2a-4a8c-8371-91902e377d5c` |
| Rotation draft | Retained deployment fixture | `432e8d30-fde4-4bdd-bc31-a13a19087faa` |
| Rotation entry | Deployed Pumpman fixture | `c9278073-8ac3-42d0-9a1b-724adf73ebf4` |
| Submission | Pending browser creation and signing | None |
| Existing released form | Pre-Employment Declaration | `1b9daec7-87f9-498d-8f0f-9f7d72e49206` |
| Existing released version | Version 02; definition unchanged | `1fcd2e8d-1f88-489b-a7cc-cf48b18a712d` |

### Scope and retention

- Leave every fixture record in place, including the actor, custom role and grants.
- **Sync All may remove the synthetic actor and/or its custom role and grants.** Check their continued existence before reusing this fixture.
- The seafarer was created through the Crew Pool API. No assignment or Planning record was inserted directly.
- Deployment must use normal Rotation. First choose a configured rank with no Planning row on any existing vessel. Only if no such rank exists anywhere may one vessel 04 row without a current reliever be reused, with raw SQL before/after evidence. Do not invent a rank variant, create a synthetic vessel, alter vessel rank configuration, or replace a current operational reliever.
- Only this synthetic seafarer's source fields may be changed for the signing snapshot test. No source field has been changed yet.
- No released form definition may be modified. The preferred deployment path modifies no existing Planning row; the narrowly approved vessel 04 fallback was not needed.

### Actor permissions and read-only verification

No existing crewing Office account qualified with Crew Database view/create/edit and no Forms authoring grants, so the explicitly approved synthetic actor was created.

The synthetic role has Crew Database view/create/edit, Vessel view, and Vessel Database and Officer Matrix view/edit. The existing UI requires the latter edit permissions to enter vessel details and open the reliever popup. All delete permissions and all Forms permissions remain false. No existing actor's role or grants were changed.

At 2026-10-02 15:28:01 UTC, a real browser using actor 99 opened vessel 04's actual Planning reliever popup and manually selected released version 02. Association verification, eligible forms and history returned HTTP 200 as actor 99. All were GET requests. No declaration was started on the operational assignment used for this read-only check. The Forms authoring endpoint independently returned HTTP 403.

Evidence:

- `.local/verification/joining-declaration-retained-fixtures.json`
- `.local/verification/joining-no-authoring-picker.json`
- `.local/verification/joining-no-authoring-picker.png`

### Preferred deployment and remaining acceptance

The search covered existing vessel masters and their configured ranks. Vessel 02's configured Pumpman rank R017 had no Planning row, including archived/deleted rows. Normal Rotation created the retained assignment and a new Planning row. Fingerprints of all 84 pre-existing Planning rows were identical before and after deployment. No vessel 04 fallback was used.

Deployment evidence: `.local/verification/joining-vessel-slot-search.json` and `.local/verification/joining-rotation-deployment.json`.

Witnessed and Company Representative signing, whole-form freezing before section Submit, source-change notice after reload, automatic completion, and the final completion commit/backend/browser chronology still require closing browser evidence. Do not add a completion-ledger row based on the earlier read-only picker check.