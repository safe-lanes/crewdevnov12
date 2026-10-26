# Training compliance checklist gate — slice 5

## Scope and commit sequence

0. Company ID first in See Details (presentation only).
1. Independent default-deny permission, tenant-local setting, immutable evidence storage.
2. Shared training blocker/warning policy (calculator unchanged).
3. Combined checklist gate on the sole accepted Yes writer, snapshot and scoped history read.
4. Access Control settings, separate override reasons, acceptance warnings and saved history UI.
5. Regression and registered fixture browser evidence.
6. Closing full-suite, Company Forms, TypeScript and post-commit backend chronology.

## Storage and authority

Migration 0261 adds no allowed grants. `training_compliance/override` is independent
of `company_forms/override_checklist`; grant changes use the existing audited,
parent-role-UUID Access Control write path. The expiry setting is tenant-local,
default OFF, and saved through the same management authority/lock with server
identity and before/after audit. Strict input schemas reject browser audit fields.

Accepted snapshots are append-only and protected by database update/delete
triggers. Every acceptance will insert a fresh snapshot in the same transaction as
the Planning Yes write. This is not a retrospective recomputation of old checklists.

## Yes writer audit

The live V2 Planning update is the only accepting HTTP writer. Create rejects
Yes without Deploy; status/reliever shortcuts reject it. The legacy storage
methods have no mounted HTTP writer; database trigger 0262 additionally refuses
any direct Yes write without both transaction-local verification markers.
The linked update holds assignment/Planning locks, applies proposed reliever
dates inside that transaction, checks both domains, then writes Yes and a new
snapshot together. A refused combined check rolls back the proposed facts too.

Training calculation uses a savepoint: a calculation/database-read failure is
converted to an incomplete result without poisoning the outer transaction.
Missing settings/storage cannot silently bypass enforcement. Certificates,
rank context, matrix and master rows read for acceptance have shared locks.
Server-derived actor and time are stored separately from the evidence document.
The evidence includes canonical inputs, all selected revision equivalents and
rank requirements, candidate certificates, chosen results, policy/warnings and
both independent override reasons/results.

## Screens and navigation

- **Vessel → TEST ONLY PDF layout review → Planning → Chief Officer reliever**:
  choose Deployment Checklist Completed Yes. One refusal dialog contains both
  domains. Known OUTSTANDING/STARTED mandatory forms have no override route.
  Eligible forms and training each require their own permission and reason.
- **Admin → Access Control**: exact tenant setting
  “Block mandatory courses expiring during contract”, OFF by default.
  Select a parent role and find the independent **Training compliance**
  permission editor. Save permission/settings through normal audited APIs.
- **Reliever Status → Accepted checklist history**: immutable accepted inputs,
  names/rank as captured, matrix/calculation version, selected certificates and
  dates, both override reasons, actor/time and fingerprint. Reads stored evidence,
  not a fresh calculation. No expiry is labelled explicitly.

## Verification

Focused server coverage includes two isolated tenant schemas, real migration
immutability/Yes-write triggers, canonical reader, actual persisted role
resolution/default-deny training authority, management-only setting edits and
server audit before/after values. Combined gate unit tests additionally cover
both independent reasons/grants, known mandatory forms, incomplete checks,
forged identity/reasons and normal warning acceptance. Automated tests do not
write acceptance fixtures to development.

Main preview reuses the slice 4 fixture and one version of the registered
company-name sample, strictly limited to the fixture-only vessel. Exact identities
and temporary/restored permission actions are in the fixture register/manifest.
No real crew or original released Standard Forms were edited.

`initial-acceptance-evidence.json` records seven successful clicked/request checks:
named missing course; default-off authority; explicit unauthorized override
refused (negative API check); screen override accepted with a written reason;
expiry warnings accepted with policy OFF; certificate edited through normal D3
API while saved snapshot content/fingerprint remains byte-for-byte identical;
and setting ON through Access Control blocking expiring mandatory courses.
This run stopped afterwards at the automated version-creation guard. That guard
was not weakened: the single fixture draft was authored through Forms
Configuration, and its guarded release and explicit harness requirement followed.

The later browser run confirms the combined form/training refusal, including an
explicit permitted training override request still refused for the mandatory
form, plus preserved acceptance/override history. Earlier accepted scenarios
cannot be replayed as a new normal acceptance once that deliberately retained
mandatory fixture requirement exists: closing replays read their immutable
snapshots, do not delete/disable the blocker to manufacture another pass.

These are user-approved development personas with actual persisted grants,
ownership and vessel checks. Normal parent sign-in remains the developers'
production checklist item; these checks do not claim to be parent login tests.

Restoration uses normal audited APIs: training override OFF, tenant policy OFF,
fixture certificate/dates restored and checklist set No. The mandatory fixture
requirement remains outstanding, intentionally, with all history retained.

## Closing gates (21-Oct-2026)

- Full isolated suite: **1,560 passed / 162 failed / 67 pending**.
  No added or resolved failures versus the prior full-suite result. This is
  within the agreed ceiling, not a claim that the complete suite is green.
- All discovered Company Forms coverage: **97 suites / 661 tests passed**,
  zero skipped/pending/todo. Area totals are derived from the complete full run;
  the full run's unrelated failures/pending tests remain reported above.
- TypeScript: **222 diagnostics**, none in the changed implementation.
- Focused training reader/evidence/authority/settings integration: **38 passed**;
  training blocker policy **10**, combined gate **13**, settings/history UI **4**,
  compliance presentation UI **18**.
- Calculator/date/selection version stays **1.2.0**; no calculation code changed.

### Step commits

| Step | HEAD | Commit time (UTC, 21-Oct-2026) |
|---|---|---|
| 0 Company ID | dce264c7cbea4762890b12e4e6b2d5e237cff06a | 09:03:23 |
| 1 storage/authority/tenant setting | b04c0b3d6ff0fb868afb7c00dda43f3c93014960 | 09:08:15 |
| 2 training policy | 4f7af8269e680bc2e742b06f581220501bbab8f0 | 09:09:16 |
| 3 combined gate/frozen snapshot | 76544228fec2c3e02cfc5b1b9c394cfab229f546 | 09:12:22 |
| 4 UI | d3902033702b6ee382275d34669f3b4d6afc933d | 09:19:51 |
| 5 regression/fixture/browser verification | d46e9dac526a0b7cddc75ce6913fbcf62e11eb99 | 09:37:49 |

The closing report/evidence commit follows this table. Its exact hash/time and
the later backend start are recorded in `browser-closing.json` and the review
gallery after the managed workflow restarts. The browser verifier asserts HEAD
and the main listener PID are unchanged throughout that closing journey.
Screenshot files and raw gate/browser outputs remain outside git in
`generated-artifacts/training-slice5/`.
