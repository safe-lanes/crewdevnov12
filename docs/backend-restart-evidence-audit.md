# Backend restart evidence audit

Audit date: 2026-10-02. All timestamps below are UTC.

## Required standard

For every task changing server code, closing evidence must identify the final
implementation commit and its timestamp, the actual listening backend PID and
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