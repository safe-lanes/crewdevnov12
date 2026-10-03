# SAIL Crew Mobile Security Remediation — Final Retest Report

Audit/retest date: 2026-10-01  
Scope: Expo Crew Mobile application and isolated `/api/crew-app` BFF boundary  
Constraint: deployed ERP is a frozen authoritative dependency

# EXECUTIVE SUMMARY

The remediation materially improves mobile authentication, tenant/file authorization, safe logging, approval durability, privacy-request intake, upload quarantine, device configuration, production configuration, CI design, monitoring interfaces, and release documentation. The ERP application, customer UI, and unrelated APIs were not intentionally redesigned.

The release is still **NOT READY**. The most important unresolved issue is the absence of a safe ERP outbox worker and a verified authoritative reconciliation contract. Approval now atomically records a decision and exactly one command, but no component safely proves and finalizes the ERP mutation. Shipping a naive worker could reintroduce duplicate authoritative writes after ambiguous failures.

Other blockers include no durable encrypted mobile outbox, no configured malware scanner, local filesystem storage, unverified encryption/IAM/backup controls, placeholder production origin, incomplete privacy/retention execution, no live SIEM delivery, no signed store artifacts, and no independent VAPT or release-equivalent maritime-network testing.

Overall Score: **5.2/10**

Security: **6/10**  
Privacy: **5/10**  
Mobile Security: **6/10**  
Backend/API: **7/10**  
Multi-Tenancy: **7/10**  
Data Protection: **5/10**  
Maritime Workflow Integrity: **4/10**  
Offline/Low-Bandwidth: **3/10**  
Google Play: **4/10**  
Apple App Store: **4/10**  
Production Readiness: **3/10**

# CLEARANCE

Production: **NOT READY**  
Security: **NOT READY**  
Privacy: **NOT READY**  
Multi-Tenant: **READY WITH CONDITIONS** — source/unit evidence exists; live two-tenant isolation is not verified  
Google Play: **NOT READY**  
Apple: **NOT READY**

No authentication bypass or confirmed cross-tenant exposure was found in the remediated mobile/BFF source. This is not equivalent to penetration-test clearance.

# RETEST RESULTS

| Test set | Result | Interpretation |
|---|---:|---|
| Consolidated focused BFF/security Vitest suite | 120/120 passed | Source/unit contracts for Phases 1–17 passed |
| Selected mobile Jest regression suite | 26/26 passed | Client auth, refresh, timeout and attachment retry behavior passed |
| Mobile TypeScript | Passed | `mobile` compiles under its configured TypeScript project |
| Expo public configuration | Passed | Source configuration resolves |
| Mobile manifest source guard | Passed | Source config rejects unsafe backup/permission settings |
| Production mobile release gate | Failed as designed | Placeholder API origin remains and blocks release |
| Repository-wide TypeScript | Timed out after 121 seconds | **NOT VERIFIED** in final run; prior runs contained pre-existing ERP/client errors |
| Git diff validation | Passed | No whitespace errors; line-ending warnings only |

The initial selected mobile run exposed an outdated password-change test mock. The fixture was updated to return the new replacement token pair required by immediate session invalidation; the rerun passed 26/26.

## Required focused retest disposition

| Required retest | Result | Evidence/limitation |
|---|---|---|
| 20 concurrent approvals | **NOT VERIFIED** | Transaction/unique-constraint contract test passed, but no live PostgreSQL 20-request race test was executed |
| Duplicate operation ID | **PARTIALLY VERIFIED** | Migration uniqueness and request ID contract tested; live transaction replay not executed |
| Revoked/stolen token | **PARTIALLY VERIFIED** | Session-version/token-type source contracts pass; live signed-token integration test not executed |
| Crew A → Crew B | **PARTIALLY VERIFIED** | Central ownership guard negative unit test passed |
| Tenant A → Tenant B | **PARTIALLY VERIFIED** | Negative authorization/context unit tests passed; live independent tenant databases not exercised |
| Tenant file traversal | **VERIFIED at unit level** | Cross-tenant path, traversal, absolute path and root containment tests passed |
| Canary PII logging | **VERIFIED at unit level** | Body/header/query/response canaries absent from captured middleware logs |
| Offline timeout after commit | **NOT VERIFIED end to end** | Ambiguous timeout and operation lookup exist; durable mobile outbox and committed-then-timeout environment test absent |
| File quarantine | **PARTIALLY VERIFIED** | Structural/scanner abstraction tests passed; real scanner and route/storage integration absent |
| Privacy request | **PARTIALLY VERIFIED** | Owner-scoped submission/status source tests pass; identity verification, office lifecycle, export/deletion execution absent |
| Concurrent tenant context | **PARTIALLY VERIFIED** | AsyncLocalStorage unit concurrency test passed; live pooled database concurrency absent |

# FINDINGS COMPARISON

| ID | Finding | Original Status | Current Status | Evidence | Remaining Risk |
|---|---|---|---|---|---|
| MOB-001 | Non-atomic approval/duplicate authoritative write | Confirmed | **PARTIALLY FIXED** | Migration 0218; transactional `approveAndEnqueue`; one review/command constraints | No worker or ERP reconciliation contract; end-to-end concurrency/ambiguity unverified |
| MOB-002 | Response-body PII/token logging | Confirmed | **FIXED** | `safeRequestLogging`; canary tests; generic error responses | Aggregator/runtime configuration still needs review |
| MOB-003 | Stale token after logout/password change/disable | Confirmed | **FIXED in source** | Migration 0219; token type/session version/current account validation; replacement tokens | Live revoke/admin incident integration not exercised |
| MOB-004 | Missing privacy deletion/retention workflow | Confirmed | **PARTIALLY FIXED** | Migration 0220; owner-scoped access/export/correction/deletion requests and status | No complete office workflow, identity verification, export/deletion engine, approved retention schedule or policy URLs |
| MOB-005 | Weak offline/retry behavior | Confirmed | **PARTIALLY FIXED** | Timeouts, operation UUID/status lookup, ambiguous-result handling, bounded query retry | No durable encrypted outbox, reboot recovery, backoff/jitter orchestration or end-to-end maritime test |
| MOB-006 | No malware scanning | Confirmed | **PARTIALLY FIXED** | Quarantine, structural validation, scanner abstraction, fail-closed tests | No real scanner registered; uploads fail closed and production upload feature is unavailable |
| MOB-007 | Missing encryption-at-rest evidence | Not Verified | **NOT VERIFIED** | SecureStore configured; design documents only | DB/object/KMS/provider controls and key governance unverified |
| MOB-008 | Weak password/MFA posture | Partially Confirmed | **NOT FIXED** | bcrypt cost and lockout exist | No breached-password screening, recovery assurance or MFA/step-up for admins/high-risk actions |
| MOB-009 | Tenant/account enumeration | Partially Confirmed | **PARTIALLY FIXED** | Generic login response, dummy bcrypt comparison, rate limits | Distributed enumeration/rate-limit behavior and tenant discovery require live testing |
| MOB-010 | Pending-change DB integrity gaps | Confirmed | **FIXED in migration design** | Unique tenant/crew/operation, one review and command, checks/FKs | Migration execution and production data compatibility not verified |
| MOB-011 | File path insufficiently tenant-bound | Confirmed | **FIXED at unit level** | Tenant-root resolution, realpath/symlink containment, owner checks, no-store behavior | Object-store/IAM implementation and live cross-tenant test absent |
| MOB-012 | Local filesystem durability/HA weakness | Confirmed | **NOT FIXED** | `.private` remains local | Host loss, scaling and DB/file consistency risk |
| MOB-013 | Incomplete mobile platform hardening | Confirmed | **PARTIALLY FIXED** | Device-only SecureStore, backup disabled, iOS protection, cache cleanup, reduced permissions | Screenshot/app-switcher protection, biometric step-up, final manifests and rooted-device risk policy absent |
| MOB-014 | No certificate pinning/compensating controls | Confirmed | **PARTIALLY FIXED** | Release runtime rejects HTTP; config gate requires HTTPS | No pinning; production TLS/domain monitoring and network-security artifacts unverified |
| MOB-015 | Insufficient security CI/CD | Confirmed | **PARTIALLY FIXED** | Workflow defines tests, audits, Gitleaks, CodeQL, SBOM, manifest/release gates | GitHub execution/results, critical SCA disposition, artifact signing/provenance not verified; root typecheck not green/verified |
| MOB-016 | Placeholder production endpoints | Confirmed | **NOT FIXED / FAIL-CLOSED** | `check:mobile-release` rejects current EAS configuration | No approved production BFF origin |
| MOB-017 | Missing store privacy artifacts | Confirmed | **PARTIALLY FIXED** | Play Data Safety/App Privacy drafts and precheck reports | No public/in-app privacy policy, external deletion page, console forms or signed artifacts |
| MOB-018 | No central production config validation | Confirmed | **FIXED in source** | Typed startup validation for secrets/origins/tenancy/storage/scanner/monitoring key | Deployed environment not exercised |
| MOB-019 | Missing security monitoring | Confirmed | **PARTIALLY FIXED** | Pseudonymized events and alert sink interfaces; threshold tests | No SIEM/on-call integration; counters process-local; ERP backlog events not connected |
| MOB-020 | Missing verified backup/DR and incident response | Confirmed | **PARTIALLY FIXED** | Nine incident runbooks; BFF backup/restore design and exercise procedure | No approved contacts/RPO/RTO, infrastructure, restore exercise or tabletop evidence |

# SEVERITY COUNTS — REMAINING RISK

Critical: **1**  
High: **8**  
Medium: **6**  
Low: **1**  
Informational/verification dependencies: **4**

The Critical item is safe ERP command execution/reconciliation. The eight High items are durable offline queueing, scanner availability, storage/at-rest controls, local-file HA, privacy/retention completion, production/store configuration, backup/restore verification, and stronger high-risk authentication.

# SECTION SCORECARD

| Area | Score /10 | Risk | Blocker | Evidence |
|---|---:|---|---|---|
| Architecture | 7 | Medium | No safe ERP worker | Isolated mobile/BFF route boundary retained |
| Multi-tenancy | 7 | Medium | Live two-tenant test | Server-derived tenant/crew context and negative unit tests |
| Authentication | 7 | Medium | MFA/recovery/live revoke test | Session version, token type, hashed rotating refresh tokens |
| Authorization | 8 | Medium | Live BOLA/VAPT | Central role/ownership guards |
| MASVS | 5.4 | High | Artifact/runtime evidence | See MASVS retest below |
| API Security | 7 | Medium | Live integration/VAPT | BFF auth, status lookup, safe errors, rate limits |
| Cryptography | 5 | High | At-rest/KMS/TLS evidence | Secret separation and SecureStore; infrastructure unknown |
| Privacy | 5 | High | Policies/retention/completion | Request foundation and draft store declarations |
| Data Flow | 6 | High | Storage/scanner/worker | BFF path improved; final downstream controls absent |
| Approval Workflow | 5 | **Critical** | ERP worker/reconciliation | Atomic review/outbox only |
| Offline | 3 | High | Durable encrypted outbox | Timeout/status foundation only |
| Files | 6 | High | Real scanner/private object storage | Tenant binding/quarantine source controls |
| Database | 7 | Medium | Applied migration/live constraints | New BFF constraints and tables |
| Maritime Rules | 5 | High | ERP reconciliation/legal retention | ERP frozen; procedures avoid unsafe changes |
| Audit | 6 | Medium | Durable centralized retention | Review records and security events |
| Logging | 8 | Low | Runtime aggregator inspection | Canary-safe middleware |
| Dependencies | 5 | Medium | CI SCA execution/disposition | Lockfiles and audit workflow defined |
| Google Play | 4 | High | Signed AAB/policy/config | Precheck completed; not ready |
| Apple | 4 | High | Signed IPA/privacy manifest/policy | Precheck completed; not ready |
| DevSecOps | 6 | Medium | Workflow execution/provenance | Security CI configured |
| Performance | 3 | Medium | Release-equivalent execution | Harness/matrix only |
| DR | 3 | High | Backup infrastructure/restore test | Design/procedure only |
| Incident Response | 5 | Medium | Contacts/tabletop/tool access | Complete draft runbooks |

# MASVS RETEST

| MASVS area | Score /10 | Evidence | Remaining gap |
|---|---:|---|---|
| MASVS-STORAGE | 6 | Device-only SecureStore; Android backup disabled; iOS complete protection; temp-file cleanup | Local BFF files, screenshots/app switcher, final device/artifact test |
| MASVS-CRYPTO | 5 | Distinct validated secrets; hashed refresh tokens; HTTPS release gate | At-rest/KMS evidence, TLS deployment, key rotation and pinning/compensating control |
| MASVS-AUTH | 7 | Token type/version/current-state checks; rotation/replay handling; lockout | MFA/step-up, recovery and live revoke tests |
| MASVS-NETWORK | 5 | Production HTTP rejected; explicit timeouts | Final ATS/network config, certificate controls, traffic inspection |
| MASVS-PLATFORM | 6 | Minimal source permissions; backup/data protection settings | Signed manifest/plist/entitlements, screenshot controls, deep-link regression |
| MASVS-CODE | 6 | Security tests and CI definitions; production config validation | Root quality gate not verified, SAST/SCA workflows not executed, independent review absent |
| MASVS-RESILIENCE | 3 | Release configuration fail-closed | No tamper/root risk controls, obfuscation/integrity evidence or release binary assessment |
| MASVS-PRIVACY | 5 | Data inventory, privacy requests, pseudonymized events, store drafts | Public policy, deletion execution, retention approval, console declarations |

Scores reflect source/test evidence only and are not MASVS certification.

# CODE CHANGE REPORT

| Phase | Files added/modified | Migrations/tests | Behavior and compatibility | Unverified/remaining |
|---|---|---|---|---|
| 1 Atomic approval | Pending repository/service/controller, shared schema/types | 0218; approval/outbox test | Approval atomically queues; ERP mutation removed from request | Worker/reconciliation and live races |
| 2 Logging | Safe logging middleware, server entry points | Canary logging tests | No request/response bodies by default; generic 500s | Runtime log pipeline |
| 3 Revocation | Mobile auth middleware/service/repositories/client/context | 0219; revocation tests | Old mobile tokens rejected after version/state change; password change returns fresh pair | Live/admin revoke exercise |
| 4 Authorization | Central authorization guards | Authorization/context tests | Server-derived identity and owner/role enforcement | Live two-tenant VAPT |
| 5 Files | Shared storage/serve helper, mobile attachment controller | Tenant-path tests | Tenant-root and symlink/path escape defenses | Object storage/IAM |
| 6 Offline foundation | Mobile client/API and operation endpoint | Offline foundation tests | Timeouts, UUID idempotency header, status lookup | Durable encrypted queue/backoff/reboot |
| 7 File pipeline | Scanner abstraction and attachment quarantine | Scanner tests | Fail-closed scan gate before availability | Scanner runtime/sanitization |
| 8 Privacy | Privacy API/routes/screen/navigation/schema | 0220; privacy tests | Request initiation and own status visibility | Full lifecycle/retention |
| 9 Device hardening | SecureStore/app config/device docs | Device-hardening tests | Device-only tokens, backup and file-protection settings | Final artifacts/screenshots/biometric |
| 10 Config | Production config and release validator | Config tests | Production fail-closed combinations | Deployed config |
| 11 CI/CD | Security workflow, Dependabot, manifest validator | Manifest tests | Automated gate definitions | GitHub execution/provenance |
| 12 Monitoring | Security events/alert interfaces and event integrations | Monitoring tests | Safe pseudonymized detections | SIEM/on-call/shared counters |
| 13 IR | Incident runbook | Runbook completeness tests | Nine scenario procedures | Tabletop/contact tree |
| 14 DR | Backup/DR design | DR completeness tests | Restore/reconciliation procedure | Infrastructure and restore exercise |
| 15 Performance | Maritime harness, matrix and plan | Plan tests | Reproducible non-production test tooling | Actual measurements |
| 16 Google | Google precheck report | Precheck tests | Data Safety/permission/AAB checklist | AAB/Console/policies |
| 17 Apple | Apple precheck report | Precheck tests | App Privacy/plist/manifest/IPA checklist | IPA/Connect/policies |
| 18 Retest | Final report; mobile password-change test fixture | Consolidated 146 passing focused tests | Evidence consolidated; no ERP behavior change | All live/infrastructure items below |

Historical migrations were not rewritten. New schema changes are mobile-specific migrations 0218–0220. Existing customer ERP business behavior was preserved; the approval endpoint now intentionally queues rather than synchronously mutating authoritative data.

# REMAINING RELEASE BLOCKERS

## P0

1. Implement a leased outbox worker only after a supported ERP idempotency/read-back/reconciliation contract is approved; test crash and ambiguous-result cases against non-production ERP.
2. Prove 20 concurrent approvals produce one transition, review, command, and authoritative mutation in live PostgreSQL/integration infrastructure.
3. Complete independent two-tenant BOLA/IDOR/file/context testing with separate tenant databases.

## P1

1. Implement durable encrypted mobile outbox, bounded jittered retry and reboot/process-death recovery.
2. Register and operate a real malware scanner; verify quarantine/clean storage and scanner failure handling.
3. Replace local private files with approved private durable storage and verify KMS/IAM/versioning.
4. Set the approved production HTTPS BFF origin; remove all placeholders.
5. Complete privacy identity verification, retention decisions, export/correction/deletion processing, public policy and deletion pages.
6. Provision centralized security event delivery/alerts and exercise response.
7. Implement and test encrypted immutable backups/PITR/object consistency; approve RPO/RTO and pass restore exercise.

## P2

1. Add MFA/step-up and approved password/recovery controls for high-risk/administrative actions.
2. Make the full typecheck/test/security CI pipeline green and capture CodeQL, Gitleaks, SCA and SBOM evidence.
3. Execute maritime network/performance matrix with BFF/DB/worker telemetry.
4. Run incident tabletop and assign controlled contacts/owners.
5. Evaluate certificate pinning versus documented compensating certificate/domain monitoring.

## P3

1. Add product-compatible screenshot/app-switcher protection and biometric local step-up.
2. Define rooted/jailbroken-device risk response without treating device integrity as authentication.
3. Complete usability/accessibility and store reviewer documentation.

# STORE REQUIREMENTS

Store requirements were checked against current official guidance. As of the audit date, Google Play requires API 36 for new apps and updates from 31 August 2026, while Apple requires Xcode 26 and the iOS 26 SDK for uploads since 28 April 2026. [Google target API requirements](https://developer.android.com/google/play/requirements/target-sdk), [Google Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469), [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/?id=02032026a), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

Google result: **4/10 — NOT READY**.  
Apple result: **4/10 — NOT READY**.

Detailed reports:

- `docs/security/google-play-release-precheck-2026-10-01.md`
- `docs/security/apple-app-store-release-precheck-2026-10-01.md`

# INDEPENDENT VERIFICATION REQUIRED

- Live penetration testing of the mobile app and `/api/crew-app` BFF.
- Two-tenant environment test with Tenant A/B crew, office identities, separate pools/databases and concurrent requests.
- ERP integration contract review and end-to-end outbox/reconciliation failure testing.
- Infrastructure/network/TLS review and production configuration startup evidence.
- Cloud/object-storage/IAM and tenant-prefix policy review.
- KMS encryption/key-rotation/recovery review.
- Backup/PITR/immutable-storage configuration and measured restore exercise.
- SIEM delivery, alert routing and incident-response tabletop.
- Release-equivalent maritime network/performance execution.
- Signed AAB inspection, Play App Signing/Console/Data Safety/pre-launch review.
- Signed IPA/archive inspection, Xcode privacy report, App Store Connect/TestFlight review.
- External SCA, artifact provenance/signing verification and independent VAPT.
- Legal/privacy review of policies, retention, deletion, health/government identity data and international processing.
- Maritime/employment compliance review of authoritative record retention and ERP reconciliation.

# FINAL CONCLUSION

The mobile/BFF codebase is substantially safer than the audited baseline, and the focused automated evidence is green. It is not a defensible production release yet. The source changes establish foundations and fail-closed blockers; they do not substitute for the missing ERP reconciliation worker, runtime scanner/storage/monitoring/backup controls, independent testing, approved privacy operations, or signed store artifacts.

Final clearance: **NOT READY**.
