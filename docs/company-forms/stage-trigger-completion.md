# Company Form stage triggers — completion evidence

## Delivered scope

- Deploy checks the exact deployed assignment's before-joining stage.
- Both occupied and vacant sign-on paths check the promoted assignment's on-board stage.
- First Planned/Confirmed relief checks the incumbent's sign-off stage, including planning created already with that status. Creation accepts an exact assignment reference only after locking and verifying its seafarer, vessel, active state and on-board status. No crew/vessel/state guess is introduced.
- Planned → Confirmed is deduplicated. Actual sign-off supplies the fallback check when no qualifying relief check occurred in the current cycle. The rank-change sign-off path is excluded.
- Business effective dates and immutable fact/policy snapshots belong to the original event. Failures do not undo the operation. Fill in on the exact assignment, not Forms authoring, authorizes retry; browser-supplied retry identity is refused.
- Explicit Defer relief requires a reason, withdraws unstarted requirements, preserves started/completed requirements, and opens a fresh additive resolution cycle when relief is replanned.
- Tenant upgrade records empty legacy checks before enabling that tenant's enforcement. A failed activation rolls back and leaves enforcement off; its server audit and visible warning record the failure. Only this particular activation migration may be deferred by the shared runner. Other migration errors remain fatal. The failed tenant's next upgrade retries.
- Stage availability, visible reasons, failed/pending states, retry controls and required-form exclusions in manual pickers are integrated. Standard Forms and the later Checklist/report task are unchanged.

## Seven commit boundaries

| Step | Scope | Commit | UTC time |
| --- | --- | --- | --- |
| 1 | Foundation | `5320577615dd7cb9dbcd8b19997495f9e234b9c2` | 2026-10-12 04:59:32 |
| 2 | Frozen resolution | `4486dca2af18e33f396d3be5b254d121435cfd62` | 2026-10-12 05:00:54 |
| 3 | Operational hooks | `5d0971dae4124ea30f73191885230d3b2f006787` | 2026-10-12 05:02:08 |
| 4 | Deferral | `b5fa24c50ca58193caa6af89ab826958e5b6d155` | 2026-10-12 05:03:25 |
| 5 | Per-tenant go-live | `4002693d558841643f64845d569c6e77bbd2ce22` | 2026-10-12 05:04:30 |
| 6 | Operational UI and readiness | `fad100cae111640177555c58ea65cae9e3a670ca` | 2026-10-12 05:12:09 |
| 7 | Failure hardening, retained evidence and closing gates | See final HEAD in closing evidence | Recorded after this report is committed |

Final HEAD, commit time, backend PID/start time and the stable-head/process assertions are recorded after the final commit and restart in `.local/verification/company-form-stage-triggers/closing-evidence.json`.

## Standing checks

Measured against the final functional changes:

- Company Forms: **77 suites, 472 passed, zero skipped**. Authoritative report: `.local/verification/company-forms-all-tests-2026-10-12T05-46-11-689Z.json`.
- Full project: **1,195 passed, 161 failed, 67 pending/skipped**, 1,423 total; within the agreed failure and pending budgets. This is not a clean full-suite result. Report: `.local/verification/full-stage-final-tests.json`.
- TypeScript: **222 diagnostics**, within the agreed ceiling; `/tmp/company-stage-final-tsc2.log`. This is not a clean TypeScript result.
- Production build: passed; `/tmp/company-stage-final-build2.log`.
- API/SQL lifecycle integration covers both sign-on branches, creation already Planned, first relief transition, deduplication, reasoned deferral, preserved started requirements, fresh replanning, real sign-off fallback, rank-change exclusion, immutable retry snapshots and Fill in-only retry.
- Isolated retained tenant schemas cover independent activation, atomic failure, audit, resume/idempotency, and append-only event/attempt enforcement.

## Main-preview evidence and limits

Run `node scripts/verify-company-form-stage-triggers.mjs --initial` for a new retained synthetic journey. Before the final commit, `--register-related` adds retained real-operation fallback/rank-change subjects and registers generated child records. After the final commit/restart, run without flags for read-only closing evidence.

- Deploy was clicked through the Approval screen.
- The same synthetic journey's real sign-on, Planned/Confirmed, defer and replan operations were performed through authenticated browser API calls, then displayed in G3. They were not all clicked through vessel dialogs.
- Screenshots show before joining, on board, relief planned, deferred and replanned.
- Closing G3 screenshots also show an existing on-board fixture with a completed empty go-live check and no retrospective requirements; actual sign-off without relief with its sign-off check; and a rank-change assignment whose SQL has no sign-off event.
- The fresh signed-in browser reports zero page errors. Authentication configuration is not changed.
- Fixtures, related events, attempts, resolution runs, requirements, history, generated sea-service rows and archives are retained and registered in `docs/company-form-regression-fixtures.md`. No fixture crew or assignment is hard-deleted.

The final read-only pass must keep HEAD and backend PID unchanged and prove the backend started later than the final commit. Public screenshot capture uses a separate unsigned-in browser; it is not the signed-in operational evidence above.
