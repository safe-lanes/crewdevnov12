# Crew Mobile Maritime-Network and Performance Test Plan

Status: reproducible plan and client-side measurement harness implemented. Test execution against a deployed BFF, infrastructure metrics, and performance conclusions are **NOT VERIFIED**.

## Safety and scope

Run only in an authorized non-production environment containing synthetic crew and document data. Never run fault injection against customer ERP or production. The ERP is frozen; slow/timeout behavior must be simulated at the BFF integration-adapter boundary or a dedicated proxy. Keep ERP command dispatch disabled unless a supported non-production ERP simulator provides deterministic idempotency and reconciliation.

The harness refuses an unrecognized target unless the operator explicitly acknowledges it as non-production. It never prints the access token. Mutation probes are disabled by default and require explicit configuration.

## Test assets

- `tests/performance/maritime-network-scenarios.json`: canonical latency, throughput, loss, and disconnect scenarios.
- `tests/performance/crew-mobile-maritime.mjs`: dependency-free Node measurement harness for profile, masters, documents, notices, notifications, operation status, and an optional idempotency mutation probe.
- Existing focused tests cover request timeout, upload ambiguity, refresh coordination, pagination, and attachment retry behavior; they do not replace end-to-end impaired-network testing.

## Environment

Build a dedicated BFF instance, isolated tenant databases for Tenant A and Tenant B, private test object storage, scanner emulator, ERP adapter simulator, and monitoring for process CPU/RSS, event-loop delay, database query count/duration, pool active/waiting counts, HTTP request counts, outbox depth, and reconciliation depth.

Use a network proxy or Linux network namespace between the mobile/harness and BFF. Apply `tc netem` only to the dedicated proxy interface. Example shape (adapt interface and scenario values):

```sh
tc qdisc replace dev eth0 root netem delay 500ms rate 160kbit loss 2%
tc qdisc del dev eth0 root
```

For a temporary disconnect, drop traffic at the proxy for 30 seconds and then restore it. Record the exact commands, interface, start/end times, and proxy image/version. Do not run these commands on a shared host.

## Required network scenarios

Run all entries in the JSON scenario matrix:

| Scenario | Latency | Throughput | Packet loss | Additional action |
|---|---:|---:|---:|---|
| normal | baseline | baseline | 0% | none |
| latency-500ms | 500 ms | baseline | 0% | none |
| latency-1s | 1 second | baseline | 0% | none |
| throughput-20KBps | 500 ms | 20 KB/s | 0% | none |
| throughput-10KBps | 1 second | 10 KB/s | 0% | none |
| packet-loss-2pct | 500 ms | 20 KB/s | 2% | none |
| packet-loss-5pct | 1 second | 10 KB/s | 5% | none |
| temporary-disconnect | 500 ms | 20 KB/s | 0% | disconnect for 30 seconds during request |

Also execute controlled service faults:

- ERP simulator responds after the BFF timeout without committing.
- ERP simulator commits and then withholds/drops the response.
- ERP simulator remains unavailable for 20 bounded attempts.
- BFF restarts before accepting a mutation, after durable acceptance, and while querying operation status.
- Outbox worker restarts before ERP call, after ERP commit but before local final state, and while holding an expired lease.
- Mobile process terminates after queueing, during upload, and after an ambiguous response; then relaunch/reboot simulation.
- Switch Wi-Fi/cellular proxy paths during profile read, mutation, upload, and download.

The outbox-worker scenarios are blocked until the safe worker and authoritative ERP reconciliation contract exist. Record them as **NOT EXECUTABLE**, not passed.

## Workflows

For every applicable network and fault scenario test:

1. Profile read and masters retrieval.
2. Collection/certificate retrieval with enough synthetic rows to exercise pagination and payload limits.
3. Profile change submission with a stable operation UUID.
4. Duplicate tap using the same operation UUID.
5. Approval and rejection through an authorized office test identity.
6. Operation-status lookup after timeout before any retry.
7. Safe PDF/image upload at small, typical, and allowed-maximum sizes.
8. Owned document download, interrupted download, and cross-tenant denial.
9. Offline queue, reconnect, process termination, device-reboot simulation, and 20 bounded retry opportunities.
10. ERP ambiguity and reconciliation, without blind authoritative replay.

Expected invariants: no duplicate business operation, no lost durable operation, no silent stale overwrite, no cross-tenant data, no unscanned available file, no unbounded retry storm, and no secret/PII in measurement output.

## Harness execution

Supply secrets through the process environment or CI secret store; do not place them in shell history or committed files. Illustrative invocation:

```text
PERF_BASE_URL=<authorized-test-url>
PERF_ACCESS_TOKEN=<short-lived-synthetic-user-token>
PERF_SCENARIO=packet-loss-2pct
PERF_ITERATIONS=20
PERF_CONCURRENCY=2
node tests/performance/crew-mobile-maritime.mjs
```

For the optional synthetic mutation probe, additionally set `PERF_ENABLE_MUTATIONS=true`, `PERF_MUTATION_SECTION`, and a non-sensitive JSON `PERF_MUTATION_PAYLOAD`. The harness submits once, queries operation status, then repeats the same operation ID. Verify one pending record and one outbox command directly through approved test assertions.

Run warm-up separately and discard it. Run each measured scenario at least three times, preserving raw JSON output and server metrics under an evidence ID. Do not average away failures; report each run and aggregate percentiles.

## Measurements

Capture per operation and scenario:

- p50, p95, p99, and maximum end-to-end latency.
- HTTP/application failure and timeout rates.
- retry count, retry intervals, and maximum simultaneous retries.
- unique operation UUID count, pending-row count, outbox-command count, authoritative mutation count, and duplicate count.
- upload/download bytes, duration, completion, checksum, and resume/restart behavior.
- BFF CPU, RSS/heap, event-loop delay, restart/recovery time, and open requests.
- database query count/duration, pool active/idle/waiting, locks, and transaction duration.
- scanner duration, quarantine depth, outbox depth, dead-letter/reconciliation depth, and age of oldest item.

The client harness measures HTTP latency, status, timeout, and response bytes. CPU, memory, database, worker, scanner, and ERP measurements require infrastructure telemetry and are **NOT VERIFIED** by the harness.

## Acceptance criteria requiring approval

Business/product/SRE owners must approve quantitative latency, failure-rate, RPO, and throughput targets. Until approved, use these non-numeric safety gates:

- Every accepted mutation is discoverable by operation UUID after reconnect/restart.
- Duplicate submission produces one business mutation.
- Ambiguous ERP result enters reconciliation rather than blind retry.
- Retrying is bounded and does not synchronize across clients into a storm.
- Cross-tenant and ownership-negative requests remain denied under concurrency.
- Sensitive file checksums match and incomplete downloads are not presented as complete.
- The BFF returns to service without corrupting pending/outbox state.

Quantitative performance clearance remains **NOT DEFINED** until targets are approved.

## Static hypotheses to measure before optimization

- `getInformation` aggregates many sections concurrently and can produce a large response; measure payload size, query count, pool pressure, and memory before splitting it.
- Attachment cleanup uses `Promise.all` over a record's attachments; measure maximum observed attachment count and resource use before adding bounded concurrency.
- Uploads use memory-backed buffers capped at 5 MB each; measure concurrent-upload RSS and scanner latency before changing the pipeline.
- Notices and notifications are paginated, privacy requests are capped at 50, and the mobile query client has a bounded retry. Verify these limits under load.

Do not optimize from this review alone. Open a measured finding with raw evidence, affected scenario, threshold, proposed change, ERP-compatibility analysis, and regression plan.

## Evidence and release decision

For each run retain scenario configuration, build/commit, test-data scale, timestamps, proxy configuration, raw harness output, server/DB dashboards, operation reconciliation, failures, and corrective actions. Redact tokens and sensitive crew data.

Phase completion provides tooling and a plan only. Production performance and maritime-network readiness remain **NOT VERIFIED** until the full matrix runs against release-equivalent infrastructure and the approved acceptance criteria pass.
