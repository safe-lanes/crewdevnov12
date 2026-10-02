# Backend restart evidence audit

Audit date: 2026-10-02. All timestamps below are UTC.

## Required standard

For every task changing server code, closing evidence must identify the final
task commit and its timestamp, the actual listening backend PID and
its start timestamp, and the later browser/preview check timestamp and environment.
Required ordering: final commit < backend start <= browser/preview check.
Absent this evidence, the browser/preview claim is **NOT VERIFIED**.
Task-agent and main-workspace evidence must be distinguished. A subsequent main
merge needs a subsequent main-backend restart; an isolated restart does not prove
the main backend loaded that merge. See the standing instructions in `replit.md`.

## Sources and limits

Reviewed every completion row in `docs/task-ledger.md`, its reachable implementation
commit and file changes, retained Company Form verification documentation,
tracked screenshot references, main-workspace process information and the
available main workflow log. Generic success sentences and screenshot existence
do not supply a backend process start time. Git file/commit times are not
substitutes for browser capture or process-start times.

Task-agent historical process/tool logs are not retained in the inspected
workspace evidence. This audit cannot independently determine which process
an isolated execution restarted or its relationship to its final commit.
“Cannot establish” is an evidence finding, not a claim that no restart occurred.
Unit/API test results are not converted into browser evidence or retrospectively
invalidated by this visual-provenance audit.

## Every ledger entry

| Task | Title | Recorded completion commit | Commit time (UTC) | Browser/preview restart ordering |
| --- | --- | --- | --- | --- |
| #344 | Add Company Form Content points using proven Word paste code | `c64192a060` | 2026-09-29 13:13:56 | Frontend/shared-client change; no server-code change in the recorded implementation. Tracked screenshots exist, but no process/capture chronology establishes the requested ordering. Do not certify their backend provenance. |
| #348 | Add Company Form System Fields | `65584f0fd1` | 2026-09-29 13:55:50 | Server code changed. No retained final-commit/backend-start/browser-time chain found. Cannot establish; **NOT VERIFIED**. |
| #351 | Record Company Form entry decisions | `d62bbbc035` | 2026-10-01 03:31:53 | Documentation only; no server-code change or browser/preview evidence to certify. Not applicable. |
| #352 | Persist staged Company Form submissions | `91134424a9` | 2026-10-01 04:16:03 | Server code changed. Stage/persistence documentation does not identify a post-final-commit backend PID/start and later browser check. Cannot establish; **NOT VERIFIED**. |
| #360 | Link deployed relievers to assignments | `30a10a5a58` | 2026-09-30 07:26:31 | Server code changed. No retained timestamped process/browser chain found. Cannot establish; **NOT VERIFIED**. |
| #361 | Remove obsolete Crew assignment paths | `55a71e1b40` | 2026-09-30 07:30:54 | Server code changed. No retained timestamped process/browser chain found. Cannot establish; **NOT VERIFIED**. |
| #362 | Use assignment identity for sign-on and sign-off | `d7dbd0f111` | 2026-09-30 10:44:19 | Server code changed. No retained timestamped process/browser chain found. Cannot establish; **NOT VERIFIED**. |
| #365 | Let administrators safely clear unlinked relievers | `21cf7816cd` | 2026-09-30 11:41:18 | Server code changed. No retained timestamped process/browser chain found. Cannot establish; **NOT VERIFIED**. |
| #368 | Prevent invalid assignment vessel IDs | `7228d8d046` | 2026-09-30 13:10:56 | Server code changed. No retained timestamped process/browser chain found. Cannot establish; **NOT VERIFIED**. |
| #354 | Start and edit Company Forms safely | `281f5640ca` | 2026-10-01 07:26:47 | Report claims application restart and preview success, without PID/start/check timestamps. The Briefing/Debriefing browser baselines explicitly identify an earlier revision; later client corrections are recorded separately. Cannot establish the required chain for the final implementation; **NOT VERIFIED**. |
| #355 | Complete and sign Company Forms | `4684b96a3b` | 2026-10-02 05:32:02 | Report claims `Start application` restarted and preview rendered, without PID/start/check timestamps. Main backend remained a process started 03:42:34, older than both this final implementation and its 06:24:44 main merge. Historical task-agent restart chronology cannot be established; **NOT VERIFIED**. |

The full hashes remain in the unchanged ledger rows. The recorded implementation
time is used as the conservative final-task comparison point; where the exact
last server-only change could precede a later client correction, that distinction
does not supply the missing process/capture timestamps and cannot certify a check.

## Explanation of the signing task's restart statement

`docs/company-forms/submission-runtime-verification.md` says the existing
`Start application` workflow was restarted once after runtime/client changes,
database initialization and migrations succeeded, and the preview rendered.
That workflow's command starts the Express backend as well as the development
frontend. The document therefore **claims** a backend-inclusive workflow restart,
not merely a browser refresh.

However, it does not record the target process, backend start time, check time,
or ordering against the final implementation commit. The work was delivered
from an isolated task-agent environment; a restart there is not a main-workspace
restart. Without retained execution logs, its precise historical target cannot
be independently confirmed.

It demonstrably did **not** restart the main backend after merge: PID 129
started at 03:42:34, the signing merge occurred at 06:24:44, and that process
accepted `POST /api/v2/admin/form-versions/771/release` at 06:46:09 with HTTP 200.
The normal endpoint was executing its pre-merge stage-only handler. Current
source rejects the section-responsibility configuration, and the installed
database triggers do not enforce that lifecycle rule themselves.

The old restart/preview sentence is not sufficient verified closing evidence.
A restart now cannot retroactively certify its earlier preview.

## Current operational verification

The main `Start application` workflow was explicitly restarted on 2026-10-02.
Its new Express backend process started at 07:49:11, later than the then-current
branch commit `430f4e060d75bfb7b85620f1560227496b86f051` at 07:42:41.

Through the normal HTTP authoring/release endpoints, a separate disposable
Company Form draft was created with a valid before-joining stage and General
and Drug & Alcohol Policy sections, both requiring seafarer and officer
signatures with responsible party “not applicable.” Normal release endpoint
`POST /api/v2/admin/form-versions/1277/release` returned **HTTP 400**:

> Section "General" requires submission but has no responsible party. Assign a role, department, or seafarer. Section "Drug & Alcohol Policy" requires submission but has no responsible party. Assign a role, department, or seafarer.

The disposable version remained `draft` with `releasedAt = null`.
Pre-Employment Declaration version 01 was read before/after and remained unchanged.
No authentication setting was changed; the test used the already configured
development authentication mode and permission-checked normal route.

Final branch/process chronology, subsequent readiness, and repeat refusal
after committing these instructions/audit are reported in the closing response.
No historical task is marked visually verified by this new operational check.

## New main-workspace assignment walkthrough — 2026-10-02

This is **new runtime evidence**, not retrospective certification of the
historical table above. Before starting, the user was given main listening
backend **PID 198**, start **13:30:53.280 UTC**, and latest commit
`80248e1014e022466ac51291367efd16d3dc3cc3`, timestamp **08:01:51 UTC**.
Backend start was strictly later. The helper checked the same PID/HEAD at both
ends of every stage, from fixture setup at 14:00:22 through the final rejection
check. There was no isolated app server or workflow restart during this journey.

Dedicated fixture vessel: `VERIFY Lifecycle 211faf78`,
UUID `f90095c9-4fb6-492d-bd95-b479fd4f5ae7`. Only test-owned setup records were
created. The initially missing vessel positions were configured through the
normal Admin vessel-revision API; no SQL fabricated assignment links or states.
Lifecycle mutations used normal live HTTP endpoints. A real browser opened the
reliever popup and its **Open assignment** control; screenshots record the
actual UI after every requested stage, not a claim that every mutation was
submitted through its browser form.

| Requested stage | New main-workspace result |
| --- | --- |
| Deploy first seafarer | PASS: planning `dfaf01bb-bf13-46cf-8dc2-fe4302984c08` persisted `reliever_assign_uuid = 5a655dcb-e6e2-4281-ae04-283c69512028`; assignment is Planned and not deleted. |
| Open reliever popup | PASS: screenshot displays that UUID. Browser GET `/api/v2/vessel/planning/dfaf01bb-bf13-46cf-8dc2-fe4302984c08/reliever-assignment/5a655dcb-e6e2-4281-ae04-283c69512028` returned 200 with the exact assignment UUID. |
| Sign on | PASS: same UUID moved to planning `crew_assign_uuid`; assignment became OnBoard/current. |
| Sign off | PASS: same UUID retained; `is_current=false`, `sign_off_date=2026-10-03`, `is_deleted=false`. Its historical assignment classification remains OnBoard. |
| Deploy second seafarer | PASS: planning `87437b9f-495b-4e6e-bd4e-ba20d72424ff` persisted assignment `d027f2a4-0a16-4ed2-b603-0ff356db792d`. |
| Unassign second seafarer | PASS: the same assignment row remains Cancelled/noncurrent/**not deleted**; planning reliever crew/assignment links clear. |
| Write with `744535d0-841a-11ed-aa7c-7003bca91a866` | PASS: normal scoped assignment-create endpoint returned 400, “Assignment vessel ID must be a correctly formed UUID.” Crew history and global invalid-ID count were unchanged. |

**Existing-data finding:** three historical assignments already reference that
malformed vessel ID. The before/after count remained **3**, not 0. These records
were neither created by this walkthrough nor cleaned up as part of it.

### Scope against #360–#368

| Ledger task | What this new walkthrough verifies | Remaining limit |
| --- | --- | --- |
| #360 | Sequential deploy, persisted reliever UUID, exact popup read, linked cancellation: VERIFIED. | No concurrency race stress retest. |
| #361 | Current canonical relationship-scoped assignment write path exercised. | Retired/obsolete URL behavior was NOT TESTED here; no full-task certification. |
| #362 | Same exact assignment across sign-on and sign-off: VERIFIED. | Verification is the named fixture journey, not every import/backfill branch. |
| #365 | Normal linked unassignment works. | Exceptional administrator-only clearing of an **unlinked** legacy reliever was NOT TESTED; this is not verification of that distinct permission-sensitive behavior. |
| #368 | The user's exact malformed vessel-ID write is refused without mutation: VERIFIED. | Other missing/valid-shaped-unknown vessel cases were not retested. |

#363, #364, #366 and #367 have no completed rows in this ledger; no completion
claims are invented for them. All raw SQL, bound parameters, actual returned
rows, HTTP responses, per-stage times and seven screenshots are recorded in
[the detailed evidence](evidence/assignment-lifecycle-main-2026-10-02.md).
A self-contained downloadable copy is
`reports/assignment-lifecycle-main-2026-10-02.html`.

## Development auto-restart

The development script now uses:

```sh
NODE_ENV=development tsx watch --clear-screen=false --include 'server/**/*' --exclude 'client/**' server/index.ts
```

This watches loaded server dependencies and explicitly includes server files
outside the import graph. Frontend-only files are excluded from the backend
watcher and retain Vite hot updates. Production commands are unchanged.
Automatic restart **does not waive** the standing final-commit/backend-start/
check-time rule. Runtime file-modification proof is recorded below after the
watch-enabled main workflow is started.