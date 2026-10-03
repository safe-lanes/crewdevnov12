# Retained Company Form regression fixtures

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