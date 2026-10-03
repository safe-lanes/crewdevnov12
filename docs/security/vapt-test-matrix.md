# SAIL Crew Mobile VAPT test matrix

Each row requires Android and iOS execution where applicable. Use `PASS`, `FAIL`, `N/A` or `BLOCKED`; every result needs an evidence ID. This matrix uses OWASP MASVS/MASTG for the clients and OWASP API Security Top 10 2023 for remote APIs.

| ID | Area | Required independent test | Expected security result | Mapping |
|---|---|---|---|---|
| VAPT-01 | Build integrity | Hash binaries; inspect signing, debuggable/profile flags, embedded endpoints/secrets and symbol exposure | Release signed; debug disabled; no credentials or non-production endpoints | MASVS-CODE/RESILIENCE |
| VAPT-02 | Local storage | Inspect sandbox, logs, memory, cache, temp downloads, backups and uninstall residue before/after sensitive workflows | Tokens remain device-only protected; no recoverable sensitive cache/backup | MASVS-STORAGE/PRIVACY |
| VAPT-03 | Screen privacy | Attempt screenshots, recording and app-switcher snapshots on both platforms | Protected content is not captured | MASVS-PLATFORM |
| VAPT-04 | Transport | Proxy normal and hostile traffic; test cleartext, invalid/expired certificates, hostname mismatch and TLS downgrade | HTTPS only; invalid trust fails closed; no token leakage | MASVS-NETWORK |
| VAPT-05 | Authentication | Enumerate users; brute force password/TOTP/recovery codes; test MFA enrollment takeover and recovery reuse | Generic responses, effective rate/lockout controls, no MFA bypass, recovery code single use | MASVS-AUTH; API2/API4 |
| VAPT-06 | Sessions | Replay rotated refresh tokens, swap device IDs, reuse after logout-all/password reset/disable, alter JWT claims/algorithm | Replay revokes family; stale or modified tokens rejected | MASVS-AUTH; API2 |
| VAPT-07 | BOLA | Swap every crew, pending-change, notice, notification, attachment and privacy-request identifier across users and tenants | No unauthorized read/write or existence oracle | API1 |
| VAPT-08 | Property authorization | Add immutable/privileged fields, nested values, nulls and duplicates to update payloads | Server allow-list prevents over-posting and privilege changes | API3 |
| VAPT-09 | Function authorization | Invoke admin, approval, privacy, ERP operation and content-edit routes as Crew/view-only/cross-tenant users | Server-side role and tenant checks deny every unauthorized call | API5 |
| VAPT-10 | Tenant isolation | Exercise concurrent Tenant A/B requests, refreshes, downloads, worker leases, caches and failure paths | No tenant context bleed in DB, files, events or responses | API1/API5 |
| VAPT-11 | Uploads/files | Test MIME/extension mismatch, traversal names, polyglots, oversized files, EICAR, direct object keys and expired links | Quarantine/rejection before use; tenant-bound opaque access; no execution/traversal | MASVS-PLATFORM; API4/API8 |
| VAPT-12 | Offline outbox | Duplicate, reorder, alter and replay queued mutations across logout/account/tenant changes and network interruption | Idempotent processing; no cross-session replay; conflicts visible | API6 |
| VAPT-13 | Approval/ERP | Race approve/reject, duplicate commands, expire leases, simulate timeout/ambiguous ERP response and manual reconciliation | One terminal decision; idempotent commands; no direct mobile-to-ERP access | API6/API10 |
| VAPT-14 | Privacy | Forge ownership/status transitions; test export/deletion/legal-hold race and post-deletion access | Owner-only requests; office RBAC; hold respected; evidence preserved without excess PII | MASVS-PRIVACY; API1/API5 |
| VAPT-15 | Injection | Fuzz identifiers, filters, filenames, JSON and content fields for SQL/NoSQL/command/template/header injection | Inputs rejected/encoded; no stack or query disclosure | API8 |
| VAPT-16 | Resource abuse | Exercise pagination, upload count/size, authentication, privacy, worker and notification limits within RoE ceilings | Bounded cost, rate limits and stable service | API4/API6 |
| VAPT-17 | Error/log privacy | Trigger all failure classes with canary secrets/PII and inspect response, application, proxy and SIEM logs | Generic client errors; no secrets/tokens/PII in logs | MASVS-PRIVACY; API8 |
| VAPT-18 | Platform surface | Inspect Android components/permissions/network config and iOS plist/entitlements/URL handlers/pasteboard/keychain classes | Minimum permissions; no unintended exported/deep-link surface | MASVS-PLATFORM |
| VAPT-19 | Resilience | Run on rooted/jailbroken devices; instrument/hooks; modify/repackage binary | Behavior and accepted residual risk documented; signing prevents trusted distribution | MASVS-RESILIENCE |
| VAPT-20 | Dependencies | Correlate SBOMs to binaries and independently scan OS/native/JS dependencies | No unaccepted critical/high runtime vulnerability | MASVS-CODE; API9 |

## Completion record

| Test ID | Platform | Result | Finding IDs | Evidence IDs | Tester/date |
|---|---|---|---|---|---|
| `[VAPT-01]` | `[Android/iOS/API]` | `[PASS/FAIL/N/A/BLOCKED]` | `[F-###]` | `[E-###]` | `[name, UTC]` |

