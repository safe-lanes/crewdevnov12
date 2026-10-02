# Retained Company Form regression fixtures

These are retained development fixtures, not disposable test data. Do not delete them during cleanup or use them as production records.

## Joining declaration regression

Prepared on 2026-10-02 for the Planning entry point. **Full acceptance remains blocked; task #356 is not complete.**

| Record | Name or purpose | UUID |
| --- | --- | --- |
| Existing vessel | vessel 04; no synthetic vessel was created | `744535d0-841a-11ed-aa7c-7003bca91a86` |
| Synthetic seafarer | TEST ONLY JOINING DECLARATION REGRESSION; employee number `TEST-JOINING-DECL-REGRESSION` | `424584fc-dc59-4f85-aa14-30781eb8477e` |
| Synthetic Office actor | TEST ONLY JOINING DECLARATION CREWING ACTOR; master user ID 99 | `fe6a15d7-489f-4b53-8f3e-12e95915cfb3` |
| Synthetic role | TEST ONLY Joining Declaration Crewing | `95a1aff2-c823-4e08-b991-97072e4ae2a0` |
| Assignment | Not created: normal Rotation deployment has no safe configured slot | None |
| Submission | Not created: synthetic seafarer has no deployed assignment | None |
| Existing released form | Pre-Employment Declaration | `1b9daec7-87f9-498d-8f0f-9f7d72e49206` |
| Existing released version | Version 02; definition unchanged | `1fcd2e8d-1f88-489b-a7cc-cf48b18a712d` |

### Scope and retention

- Leave every fixture record in place, including the actor, custom role and grants.
- **Sync All may remove the synthetic actor and/or its custom role and grants.** Check their continued existence before reusing this fixture.
- The seafarer was created through the Crew Pool API. No assignment or Planning record was inserted directly.
- Deployment must use normal Rotation. Do not invent a rank variant, create a synthetic vessel, alter vessel rank configuration, or replace an operational reliever to bypass the blocker.
- Only this synthetic seafarer's source fields may be changed for the signing snapshot test. No source field has been changed yet.
- No existing operational record or released form definition may be modified for this regression.

### Actor permissions and read-only verification

No existing crewing Office account qualified with Crew Database view/create/edit and no Forms authoring grants, so the explicitly approved synthetic actor was created.

The synthetic role has Crew Database view/create/edit, Vessel view, and Vessel Database and Officer Matrix view/edit. The existing UI requires the latter edit permissions to enter vessel details and open the reliever popup. All delete permissions and all Forms permissions remain false. No existing actor's role or grants were changed.

At 2026-10-02 15:28:01 UTC, a real browser using actor 99 opened vessel 04's actual Planning reliever popup and manually selected released version 02. Association verification, eligible forms and history returned HTTP 200 as actor 99. All were GET requests. No declaration was started on the operational assignment used for this read-only check. The Forms authoring endpoint independently returned HTTP 403.

Evidence:

- `.local/verification/joining-declaration-retained-fixtures.json`
- `.local/verification/joining-no-authoring-picker.json`
- `.local/verification/joining-no-authoring-picker.png`

### Deployment blocker and remaining acceptance

All 23 configured vessel 04 rank slots have existing operational primary Planning records. Normal Rotation deployment updates the matching primary record. There is no configured slot without an existing operational record, and no test-named incumbent was found. The empty Fifth Engineer Planning record is not a currently configured vessel rank slot and is not approved as a disposable fixture.

Deployment was therefore not attempted. Witnessed and Company Representative signing, whole-form freezing before section Submit, source-change notice after reload, automatic completion, and the final completion commit/backend/browser chronology remain unverified. Do not add a completion-ledger row based on the read-only picker check.