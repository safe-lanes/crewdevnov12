# Combined SAIL Crew Mobile Security Audit and Frozen-ERP Remediation Plan

**Audit date:** 2026-10-01  
**Scope:** repository at `C:\SAIL\Replit\crewdevnov12`; Expo mobile client, Express APIs, PostgreSQL/Drizzle schema and migrations, private file storage, CI/release configuration.  
**Method:** static source and configuration tracing, route/data-flow analysis, focused test/configuration review, and current official store-policy review. No live production environment, database contents, compiled AAB/IPA, cloud/IAM configuration, Play Console, App Store Connect, DAST, or external VAPT evidence was supplied. Those areas are explicitly **NOT VERIFIED**.

## Executive decision

**Overall: NOT READY for production or public-store release.** No confirmed cross-tenant read was found in the reviewed crew-mobile path, and its basic isolation design is sound. Release is nevertheless blocked by a reproducible approval race/non-atomic write design, production response-body logging, absent deletion/retention implementation, incomplete mobile hardening, placeholder release endpoints, and missing operational security evidence.

### Agreed implementation constraint

The existing customer-facing ERP application is a **frozen integration dependency**. The remediation plan does not require changes to its application source, UI, schema, or deployed client instances. New controls are to be implemented in:

1. the Expo mobile client;
2. a separately deployed **Mobile Security Gateway / Backend-for-Frontend (BFF)** and its own database/workers;
3. private object storage, security scanning, monitoring and release infrastructure; and
4. the ERP's existing supported API/configuration surface, without changing ERP code.

Where a finding cannot be fixed securely in the installed mobile client alone, the BFF is mandatory. Client-side validation is not an authorization control because a modified client can bypass it.

## Target architecture: frozen ERP with compensating mobile controls

```text
[Expo Mobile App / untrusted endpoint]
  - SecureStore, biometric step-up, screenshot protection
  - encrypted durable outbox + operation UUID
  - bounded timeout/backoff + reconciliation UI
              |
              | HTTPS; mobile JWT; no direct ERP credentials
              v
[Mobile Security Gateway / BFF — separately deployed]
  - dedicated mobile authentication and immediate session revocation
  - token-derived tenant + crew ownership; request-schema allowlists
  - rate limiting, correlation IDs and redacted security logging
  - mobile_pending_changes + immutable mobile audit ledger
  - idempotency ledger + transactional state machine
  - file quarantine, AV/CDR, private object storage
  - privacy/export/deletion-request orchestration
              |
              | private network; least-privileged service identity
              v
[ERP Integration Adapter]
  - maps approved commands to existing supported ERP APIs
  - reads back authoritative state after ambiguous outcomes
  - circuit breaker, bounded retry, reconciliation/dead-letter queue
              |
              v
[Existing ERP — unchanged]
  - remains authoritative system of record
  - existing API contracts and business workflows are preserved
```

### Required network boundary

The mobile application must not call general ERP APIs directly. Only the BFF should be internet-facing for mobile traffic. Where infrastructure permits, ERP endpoints used by mobile must accept traffic only from the BFF/private network and a dedicated least-privileged service account. If direct ERP access cannot be blocked, the mobile deployment cannot claim that BFF policy is an effective security boundary.

### BFF-owned data model

The BFF should use its own database; no new tables are required in the ERP database.

| Entity | Purpose | Essential controls |
|---|---|---|
| `mobile_credentials` | Mobile-only credential/account state | bcrypt/Argon2id hash, active state, session version, lockout, no plaintext secrets |
| `mobile_sessions` | Hashed refresh tokens/devices | rotation, reuse detection, revoke-all, expiry cleanup |
| `mobile_operations` | One row per client operation UUID | unique `(tenant, crew, operation_id)`, request hash, stored response/outcome |
| `mobile_pending_changes` | Proposed changes before ERP write | tenant/crew/section/action, base version/hash, old/new snapshot, state constraint |
| `mobile_reviews` | Immutable reviewer decision | reviewer, permission snapshot, decision, reason, timestamp, correlation ID |
| `mobile_erp_commands` | Outbox for approved ERP calls | unique pending-change ID, attempt count, lease, ERP reference, final status |
| `mobile_files` | Quarantine and clean-object metadata | owner/tenant, checksum, scan state, storage key, retention/legal hold |
| `mobile_privacy_requests` | Access/correction/deletion workflow | identity verification, scope, decision/legal exception, completion evidence |
| `mobile_audit_events` | Append-only security/business history | actor, tenant, action, target, before/after hashes, source, outcome |

### Safe profile-change state machine

```text
DRAFT -> PENDING -> APPROVED -> APPLYING -> APPLIED
             |          |          |          |
             v          v          v          v
          REJECTED   CANCELLED   RETRYING   RECONCILED
                                  |
                                  v
                    RECONCILIATION_REQUIRED / DEAD_LETTER
```

Approval must only create an outbox command; it must not synchronously perform an unprotected ERP mutation. In one BFF database transaction, atomically change `PENDING -> APPROVED`, record the review, and insert exactly one command. A worker leases the command using a conditional update, calls the existing ERP API, and records its authoritative reference/result. After a timeout, it first queries ERP to determine whether the operation committed; it must not blindly retry a non-idempotent call.

If an ERP endpoint provides no stable lookup or business key by which to reconcile an ambiguous result, that write operation is **not safe for automated offline retry**. It must enter `RECONCILIATION_REQUIRED` for office handling.

### Responsibility and change-boundary matrix

| Control/finding | Mobile client | New BFF/infrastructure | Existing ERP code |
|---|---|---|---|
| Secure tokens and biometric step-up | Implement | Issue/revoke/validate | No change |
| Tenant/crew authorization | UX hints only | Authoritative enforcement | No change |
| Approval race/idempotency | Operation UUID/status UI | Transactional state machine/outbox/reconciliation | No change |
| Offline/low-bandwidth support | Encrypted durable queue/retries | Idempotency/status APIs | No change |
| File security | Picker/size UX | Quarantine, scan/CDR, private delivery | No change |
| PII-safe logging/monitoring | Scrub client telemetry | New BFF must not use ERP response-body logger; SIEM events | Existing logging remains, but mobile routes move away from it |
| Privacy/deletion requests | User request/status UI | Workflow/orchestration/evidence | Existing records changed only through supported APIs/manual authorized process |
| Database/file encryption and backup | Local protection | BFF DB/object-store KMS, backup/restore | No code change; ERP assurance remains customer/infrastructure responsibility |
| Store compliance | Manifest, permissions, disclosures | Policy URLs/support endpoints | No change |
| Maritime business rules | Display and validation guidance | Pre-submit validation; never contradict ERP | ERP remains authoritative |

### Residual risks under the frozen-ERP constraint

- Existing ERP defects remain relevant to office/web users and direct ERP API consumers; the BFF only protects mobile-originated traffic.
- A BFF cannot guarantee end-to-end tenant isolation if it calls an ERP API that itself ignores tenant/object scope. Every ERP integration call still needs two-tenant contract testing before being exposed to mobile.
- BFF logs can be fixed independently, but existing ERP logs produced while processing BFF calls must be assessed operationally. If those logs capture sensitive request/response bodies and cannot be configured safely, that remains a production blocker.
- Privacy deletion may require authorized manual action when the existing ERP has no supported deletion/anonymization API. The BFF must track the request and evidence; it cannot falsely report deletion as complete.
- The BFF cannot supply encryption at rest, backup or disaster recovery for data already stored by ERP. Those remain contractual/infrastructure assurance items.
- Business-rule defects in the ERP cannot be repaired by the mobile client. The BFF may fail closed with additional validation, but the ERP remains the authoritative source of rules and state.

The assessment found **0 confirmed Critical, 7 High, 13 Medium, 8 Low, and 6 Informational** findings. “0 Critical” does not imply clearance: multiple High findings affect sensitive maritime/health/government-ID data.

## Architecture and data flow

```text
[Crew / untrusted device]
  -> Expo React Native UI
  -> OS Keychain/Keystore via expo-secure-store (tokens and identity hints)
  -> HTTPS JSON or multipart (release client enforces https://)
       TRUST BOUNDARY: public network / reverse proxy
  -> Express /api/crew-app
  -> crewAuthMiddleware verifies dedicated HS256 access JWT
  -> JWT domain -> master tenant lookup -> AsyncLocalStorage tenant DB context
       TRUST BOUNDARY: master control DB -> isolated tenant DB/pool
  -> route -> guard (current crew/admin/reset state) -> controller/service/repository
  -> tenant PostgreSQL canonical tables or pending-change tables
  -> .private/{tenant}/{module}/ files (PDF/JPEG/PNG)
  <- scoped response -> React Query in-memory cache -> UI

[Office user / parent ERP]
  -> /api/v2 + legacy JWT + tenant middleware + requirePermission
  -> review queue -> apply canonical mutation -> approval audit fields

[Background scanners]
  -> enumerate active tenants -> tenant context -> expiry notifications/alerts
```

Sensitive data crosses device/network, application/database, database/filesystem, email (temporary credentials), and reviewer UI trust boundaries. No analytics or crash-reporting recipient is wired in source. SMTP/Google APIs may receive credential email data. Infrastructure logs receive API bodies under the current server configuration.

## Severity summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 7 |
| Medium | 13 |
| Low | 8 |
| Informational | 6 |

## Section scorecard

| # | Area | Score /10 | Risk | Release Blocker |
|---|---|---:|---|---|
| 1 | Architecture | 6 | Medium | No |
| 2 | Multi-tenancy | 7 | Medium; live isolation untested | Conditional |
| 3 | Authentication | 6 | High | Yes |
| 4 | Authorization | 7 | Medium | Conditional |
| 5 | OWASP Mobile Security | 4 | High | Yes |
| 6 | API Security | 6 | High | Yes |
| 7 | Cryptography | 5 | High | Yes |
| 8 | Privacy / PII | 3 | High | Yes |
| 9 | Data Flow | 6 | Medium | No |
| 10 | Profile Change Workflow | 4 | High | Yes |
| 11 | Offline / Low Bandwidth | 2 | High | Yes |
| 12 | Files/Documents | 6 | High | Yes |
| 13 | Database | 5 | High | Yes |
| 14 | Maritime Business Rules | 4 | High | Yes |
| 15 | Audit Trail | 4 | High | Yes |
| 16 | Logging/Monitoring | 2 | High | Yes |
| 17 | Third-party Dependencies | 5 | Medium; SCA unavailable | Conditional |
| 18 | Google Play | 3 | High | Yes |
| 19 | Apple App Store | 3 | High | Yes |
| 20 | DevSecOps | 3 | High | Yes |
| 21 | Performance/Reliability | 4 | Medium | Conditional |
| 22 | Backup/DR | 2 | High | Yes |
| 23 | Incident Response | 1 | High | Yes |
| 24 | Maritime/Regulatory Alignment | 4 | High | Yes |

### MASVS score

| Category | Score | Determination |
|---|---:|---|
| MASVS-STORAGE | 6 | Tokens use SecureStore; cache is memory-only. Screenshot/backup protection and downloaded-file lifecycle absent. |
| MASVS-CRYPTO | 5 | TLS required in release; OS storage used. No pinning, at-rest DB/file encryption evidence, or key-rotation procedure. |
| MASVS-AUTH | 6 | Strong basic rotation/lockout; no MFA/biometric, weak password policy, access-token revocation gap. |
| MASVS-NETWORK | 5 | HTTPS fail-closed in release; no pinning or network-security/ATS artifact verification. |
| MASVS-PLATFORM | 4 | Narrow picker use; no screenshot/app-switcher masking, backup rules, deep-link threat model, or exported-component review from built manifests. |
| MASVS-CODE | 5 | TypeScript and tests exist; no SAST/SCA/secret scanning and runtime payload schemas are intentionally loose in places. |
| MASVS-RESILIENCE | 2 | No root/jailbreak posture, tamper detection, obfuscation verification, or integrity attestation. |
| MASVS-PRIVACY | 3 | Draft inventory exists; notice, deletion, retention, export and consent implementation absent/not verified. |

## Detailed findings

### MOB-001 — Non-atomic approval can apply a change more than once

- **Severity / blocker:** High / YES; retest required.
- **Affected:** office review and auto-approval; `server/v2/crew-app/crew-information/pendingChangesService.ts`, `approveChange`, lines 160–167; `pendingChangesRepository.ts`, `markApproved`, lines 139–153.
- **Evidence:** status is read, the canonical mutation is applied, and only afterward is status updated. The update is not conditional on `status='pending'`; no transaction or row lock covers the sequence.
- **Attack/failure:** two reviewer requests race. Both observe pending and both create/update/delete. A crash after line 165 but before line 166 also leaves an applied row pending and retryable.
- **Impact/data:** duplicate documents/sea service/education, repeated deletes, overwritten crew records, misleading audit state.
- **Likelihood:** Medium (concurrency and retry are normal on maritime links).
- **Fix:** transactionally claim the row with `UPDATE ... SET status='processing' WHERE pending_uuid=? AND status='pending' RETURNING *`; apply and mark approved in the same transaction. Add an idempotency/operation UUID and unique constraints. For filesystem effects, use an outbox/compensation design.

### MOB-002 — Production API response bodies, including PII and tokens, are logged

- **Severity / blocker:** High / YES; retest required.
- **Affected:** `server/index.ts` lines 38–61 and `server/production.ts` lines 44–67.
- **Evidence:** every `/api` JSON response is serialized into `logLine`. Login responses contain access/refresh tokens; crew endpoints contain passport, contact, medical and family data. Truncation to 80 characters is not redaction and can still expose token prefixes or PII.
- **Attack:** log reader, support vendor, compromised aggregator, or diagnostic export retrieves authentication material/PII.
- **Impact:** account takeover and sensitive-data breach; privacy and enterprise-assessment failure.
- **Fix:** never log bodies by default. Use structured metadata only (request ID, route template, status, duration, tenant pseudonym); centrally redact Authorization, tokens, credentials and sensitive fields; define log retention/access alerts.

### MOB-003 — Access tokens remain valid after logout/password change/disable until expiry

- **Severity / blocker:** High / YES.
- **Affected:** `crewAuthMiddleware.ts` lines 43–75; `crewAuthService.ts` lines 216–244.
- **Evidence:** middleware verifies signature/expiry only and does not check credential active state, password/session version, or revocation. Logout revokes refresh rows; password change updates only the hash. Existing 15-minute access tokens continue working.
- **Attack:** a stolen token is used after user logout, administrator disablement, or password reset.
- **Impact:** continued access to passport/medical/employment data and mutation endpoints.
- **Fix:** include `sessionVersion`/credential version in tokens and verify it through a short cached lookup for sensitive calls; increment on password change, disable, all-device logout and incident response. Reduce TTL if acceptable.

### MOB-004 — No implemented account/data deletion, retention or erasure workflow

- **Severity / blocker:** High / YES for public stores/privacy clearance.
- **Affected:** mobile screens/routes and `mobile/docs/privacy-data-inventory.md` lines 24–30.
- **Evidence:** the inventory calls retention/deletion unanswerable; no deletion-request UI/API, retention schedule, legal hold, attachment purge job, or verified subject export was found.
- **Impact:** store rejection and inability to handle data-subject/customer contractual obligations. Employer record exceptions require documented legal basis; they do not remove transparency duties.
- **Fix:** define per-record retention/legal holds, expose appropriate request initiation, implement verified approval/erasure/anonymization across DB/files/backups/logs, and produce an auditable completion record.

### MOB-005 — Offline/retry architecture is not suitable for intermittent vessel links

- **Severity / blocker:** High / YES for stated maritime production use.
- **Affected:** `mobile/src/api/client.ts` lines 86–108; `crewInformationApi.ts` lines 102–137.
- **Evidence:** calls have no timeout, durable queue, idempotency key, exponential backoff, resumable upload, checkpointing or conflict protocol. Upload errors explicitly leave status ambiguous. React Query persistence is absent.
- **Attack/failure:** submit times out after server commit; user retries, producing duplicates. App termination/reboot loses unsent edits and transfer state. Upload restarts from byte zero.
- **Fix:** durable encrypted outbox; client-generated operation IDs; server idempotency ledger; bounded jittered backoff; explicit timeouts; status reconciliation; optimistic concurrency (`version`/ETag); chunked resumable transfers and checksum.

### MOB-006 — No malware scanning or content disarm for accepted PDFs/images

- **Severity / blocker:** High / YES for enterprise document handling.
- **Affected:** `server/v2/shared/fileStorageService.ts` lines 45–83 and `attachmentController.ts` lines 162–196.
- **Evidence:** size and leading magic bytes are checked, but full parsing, antivirus/sandbox scan, polyglot detection, PDF active-content handling and image re-encoding are absent.
- **Attack:** malicious PDF or polyglot passes `%PDF-`/image prefix and targets office reviewers or downstream desktop tooling.
- **Fix:** quarantine uploads, scan asynchronously, parse/rewrite allowed types, reject encrypted/active-content PDFs as policy dictates, re-encode images, and release only clean objects. Add scan status and audit events.

### MOB-007 — No demonstrated database/file encryption-at-rest and key lifecycle

- **Severity / blocker:** High / YES for sensitive enterprise data.
- **Affected:** PostgreSQL deployment and `.private` filesystem; infrastructure not supplied.
- **Evidence:** application stores passports/medical/PII in database and files in plaintext application-visible storage. No envelope encryption, managed-volume encryption evidence, KMS policy, key rotation or recovery procedure was found.
- **Fix:** document and verify managed encryption at rest; for especially sensitive fields/files consider tenant-scoped envelope encryption; enforce KMS separation, rotation, audit and restore testing.

### MOB-008 — Password policy is only eight characters; no MFA or recovery design

- **Severity:** Medium.
- **Evidence:** `shared/v2/crew-app/types.ts` lines 64–65; no MFA/recovery endpoint found. Five-attempt lockout and 8/min IP limit are positive controls.
- **Fix:** support long passwords/passphrases, breached-password screening, safe reset/recovery, and step-up/MFA for admins and high-risk actions. Avoid complexity-only rules.

### MOB-009 — Tenant/domain and account-state enumeration signals remain

- **Severity:** Medium.
- **Evidence:** `/api/v2/tenant/init` returns distinct 404/403 at `server/routes.ts` lines 59–70; mobile login returns a precise lockout timestamp at `crewAuthController.ts` lines 11–39. Login’s unknown-user timing equalization is good.
- **Fix:** use generic public responses and log precise causes internally; review whether tenant discovery is intended.

### MOB-010 — Pending-change integrity lacks DB constraints and optimistic concurrency

- **Severity:** Medium.
- **Evidence:** `app_crew_pending_changes` has free-text section/action/status and no FK/check/unique pending-slot constraint (`shared/v2/crew-app/schema.ts` lines 95–116). Stage uses select-then-insert (`pendingChangesRepository.ts` lines 23–63), allowing duplicate races. Previous values are computed at review time, not submission time.
- **Impact:** duplicate queue rows, stale approvals overwriting newer office changes, incomplete forensic history.
- **Fix:** enums/check constraints, FK where feasible, partial unique index for open changes, submitted base version/hash, immutable old/new snapshot, transactionally compare before apply.

### MOB-011 — Attachment storage authorization relies on DB metadata but file path is not tenant-bound at read

- **Severity:** Medium; not a confirmed cross-tenant exposure.
- **Evidence:** crew ownership is checked before serving (`attachmentController.ts` lines 96–130, 224–237), but `readAttachment` merely constrains paths to `.private` (`fileStorageService.ts` lines 194–225), not the current tenant directory. A corrupted/malicious DB file path could reference another tenant’s file.
- **Fix:** derive the tenant prefix at read and require `path.relative(tenantRoot, resolved)` to remain inside it; never trust stored paths alone. Add cross-tenant path tests.

### MOB-012 — Filesystem storage lacks demonstrated durability, backup, HA and transactional coupling

- **Severity:** Medium.
- **Evidence:** local `.private` filesystem writes at `fileStorageService.ts` lines 178–186; no object-store versioning, replication or restore evidence. DB/file operations can orphan either side.
- **Fix:** private encrypted object storage with tenant-prefixed keys, versioning, lifecycle, checksums, immutable backup and signed short-lived download service; outbox-based metadata consistency.

### MOB-013 — Mobile privacy/platform hardening is incomplete

- **Severity:** Medium.
- **Evidence:** no screenshot/app-switcher masking, Android backup/data-extraction rules, iOS data-protection class verification, clipboard controls, root/jailbreak risk response, biometric re-auth or integrity API. `app.json` provides photo permission text only.
- **Fix:** obscure sensitive screens, configure backup exclusions, protect cached/downloaded files, add step-up local auth, minimize exported components, inspect generated AndroidManifest/Info.plist and threat-model deep links.

### MOB-014 — No certificate pinning or documented compensating network controls

- **Severity:** Medium.
- **Evidence:** `mobile/src/config.ts` lines 19–25 enforces HTTPS in release, but no pinning/trust customization exists.
- **Fix:** for this high-sensitivity enterprise app, assess pinning with controlled backup pins and rotation. At minimum require modern TLS/HSTS at edge, CAA, monitoring and documented proxy/MDM compatibility.

### MOB-015 — CI/CD lacks security and signed-release gates

- **Severity:** Medium.
- **Evidence:** `.github/workflows/mobile-ci.yml` only installs, typechecks and unit-tests. No SAST, secret scan, SCA, SBOM, license scan, IaC/container scan, signed build, provenance, artifact scan or DAST. Branch protection/deployment IAM are not verifiable.
- **Fix:** add pinned actions, least-privilege permissions, CodeQL/Semgrep, secret scanning, dependency review, SBOM/signing/provenance, release-channel build and generated-manifest inspection.

### MOB-016 — Release configuration still contains placeholder backend origins

- **Severity:** Medium / public release blocker.
- **Evidence:** `mobile/eas.json` uses `https://REPLACE_WITH_*_API_ORIGIN` for every profile. No verified production build artifact exists.
- **Fix:** use protected EAS/environment secrets/config, build reproducibly, validate final bundle endpoint and perform smoke tests against production-like infrastructure.

### MOB-017 — Store privacy artifacts and metadata are absent/not verified

- **Severity:** Medium / store blocker.
- **Evidence:** draft inventory exists, but no privacy-policy URL, Play Data Safety export, App Privacy answers, account-deletion URL, review credentials, screenshots/metadata package, or `PrivacyInfo.xcprivacy` is present.
- **Fix:** reconcile declarations to actual fields/SDKs, publish policy and deletion path, generate iOS privacy report, validate every SDK manifest, and retain approval evidence.

### MOB-018 — No centralized production configuration schema

- **Severity:** Medium.
- **Evidence:** secrets and operational values are read ad hoc; some fail closed at module import, but no complete startup validation covers distinct secret strength, allowed origins, tenancy mode, storage root, TTLs and environment coherence.
- **Fix:** validate all environment values once with a typed schema; require secrets ≥256-bit and distinct; reject placeholders and unsafe combinations.

### MOB-019 — No security monitoring/alerting implementation evidence

- **Severity:** Medium.
- **Evidence:** console output exists, but no SIEM schema/transport, correlation ID, auth-denial/cross-tenant alert thresholds, integrity monitoring or on-call integration was found.
- **Fix:** structured security events with correlation/actor/tenant/resource/outcome, protected centralized retention, detections and tested escalation playbooks.

### MOB-020 — Backup/DR and incident response are undocumented/unverified

- **Severity:** Medium / enterprise blocker.
- **Evidence:** backup scripts exist, but no immutable schedule, PITR, file/database consistency, restore-test record, RPO/RTO, tenant-selective recovery or incident runbooks were supplied.
- **RPO/RTO:** **NOT VERIFIED / not defined in evidence.**
- **Fix:** define and test RPO/RTO, encrypted immutable backups and quarterly restores; write playbooks for stolen device/token, exposed document, tenant leak, malicious admin, DB compromise, vulnerable app and supplier breach.

### Lower-risk observations

- **MOB-021 (Low):** Global 2,000 requests/minute/IP is too broad to mitigate expensive authenticated enumeration; add route/user/tenant cost limits and pagination ceilings (`server/index.ts` 18–35).
- **MOB-022 (Low):** API body ceiling is 10 MB although attachments cap at 5 MB; use route-specific limits and reject unsupported content types early (`server/index.ts` 15–16).
- **MOB-023 (Low):** Stored legacy data URLs are served using stored MIME without revalidation; migrate and validate legacy blobs (`serveAttachmentHelper.ts` 104–120).
- **MOB-024 (Low):** Device ID is app-generated and copyable, not device attestation. Treat it as a session label, not a security identity.
- **MOB-025 (Low):** No explicit cache headers were observed on sensitive JSON responses; add `Cache-Control: no-store` globally for crew APIs.
- **MOB-026 (Low):** No pagination is evident for the office pending-review list; large tenants can create memory/latency pressure (`crew-app-review/controller.ts` 87–95).
- **MOB-027 (Low):** Refresh/session cleanup job and maximum active devices were not found; expired rows can grow indefinitely.
- **MOB-028 (Low):** Full response schemas are deliberately loose (`z.any`) for many profile sections, weakening mobile boundary validation (`crewInformationApi.ts` 14–44, 69–71).

## Multi-tenancy and authorization attack assessment

| Attempt | Result from code review |
|---|---|
| Spoof `x-tenant-id` on ERP API | **Blocked in design:** signed JWT domain is resolved and compared to requested tenant (`authMiddleware.ts` 218–287). |
| Omit tenant header | JWT domain fallback is used; otherwise rejected in multi-tenant mode. |
| Modify crew-mobile domain/header | Crew app does not trust a tenant header after login; verified access-token domain drives context. Login domain is untrusted but only selects where credentials are checked. |
| Modify JWT | Signature/HS256 allowlist rejects modification. Access and refresh secrets are separate in code, though distinctness is stated, not programmatically checked. |
| Crew A requests Crew B UUID | Crew APIs take identity from token; ownership guards list the current crew’s records and return 404. No confirmed BOLA found. |
| Crew calls office/admin API | Separate JWT namespace and route middleware; crew token should fail legacy signature. Crew-admin content routes use a token role claim that is refreshed from current credential only on refresh/login. |
| Replay refresh token | Atomic consume and family revocation are implemented. |
| Replay mutation/approval | **Not safely handled**; no general idempotency key; approval race confirmed by code sequence. |
| File traversal | Filename/module/path normalization implemented. Stored-path cross-tenant prefix is not rechecked (MOB-011). |

**Multi-tenant conclusion:** design-level isolation is reasonably strong; **live penetration and database/pool concurrency testing remain NOT VERIFIED**. Production clearance requires negative integration tests across at least two real tenant databases, background scanners, caches, exports, files and failure paths.

## Data inventory (condensed)

| Data | Source -> destination | Purpose/storage | Access/update/export/share | Protection/retention |
|---|---|---|---|---|
| Identity/contact/DOB/nationality/address | Crew/ERP -> API -> tenant DB -> crew/reviewer UI | Employment profile | Own crew reads/proposes; permitted office approves; exports in ERP not fully traced | TLS release enforcement; DB-at-rest and retention NOT VERIFIED |
| Passport/CDC/visa/certificates | Crew/ERP + uploads -> DB + `.private` files | Travel/STCW evidence | Own crew + permitted office; ERP exports possible | Private authenticated route, magic-byte allowlist; malware scan/retention absent |
| Medical/doctor visits | ERP -> tenant DB/files -> crew UI | Fitness/employment | Crew read; office workflows; update scope limited | Highly sensitive; no field/file encryption evidence; legal basis/retention review required |
| Family/next of kin | Crew/ERP -> tenant DB | Emergency/benefits | Crew proposes; office approval | Third-party-person notice/minimization requires review |
| Employment/rank/vessel/sea service/training | ERP/mobile -> DB | Assignment/compliance | Crew read/propose; office manage/export | Integrity weakened by approval race and stale updates |
| Auth identifiers/password/tokens/device ID | Login -> tenant DB/SecureStore | Authentication/session | System only | bcrypt 12; hashed refresh tokens; access-token revocation gap; 45-day refresh retention |
| Logs | API -> console/aggregator | Operations | Operators/vendors NOT VERIFIED | Currently may contain response PII/tokens; retention/access NOT VERIFIED |
| Credential email | ERP -> Google/Gmail API/recipient | Provision account | Email provider and recipient | Third-party processing and delivery security require confirmation |

No bank/wage fields were observed in the mobile crew-information surface reviewed, but they exist elsewhere in the ERP accounts domain; mobile non-collection must be preserved and store declarations based on the shipped binary/API behavior.

## Profile-change workflow

Implemented: own-crew guard, request schemas, pending/live separation, configurable office gate default-on, RBAC review endpoints, reviewer/timestamp/reason fields, recent-submission feedback, and attachment staging. Partially implemented: old values (computed later rather than immutable at submission), audit history, concurrent change handling. Incorrect: approval atomicity/idempotency. A tenant can intentionally disable verification, causing direct canonical application; this must be a privileged, audited configuration choice and clearly represented in customer controls.

## Google Play readiness

**Score: 3/10 — NOT READY.** At the audit date, Google states that from 31 August 2026 new apps and updates must target Android 16/API 36; the generated Expo artifact must be inspected to prove this. The repository does not pin or show target/compile SDK in native Gradle source. Google also requires a Data Safety form and privacy policy for published apps, and account-creation apps need in-app and web deletion request paths. Likely rejection/block reasons: unverified API 36 target, absent privacy policy/Data Safety evidence, absent deletion path if account creation/provisioning is deemed in scope, placeholder production URL, unverified signed AAB/app signing, and incomplete sensitive-health/government-ID disclosure.

Top Play actions: generate AAB; verify target/compile SDK and manifest permissions; enable Play App Signing; publish privacy policy; complete Data Safety from actual flows; provide deletion URL/in-app initiation or documented enterprise exception; verify photo/document picker permission behavior; complete content/age rating; supply store listing/screenshots/support contact; run pre-launch report and Android vitals testing.

## Apple App Store readiness

**Score: 3/10 — NOT READY.** Apple requires uploads (since 28 April 2026) to use Xcode 26+ and iOS 26 SDK. The built IPA and SDK are not available. Account-creation apps must allow deletion initiation in app. Privacy manifest/required-reason API declarations and App Privacy answers are not present/verified. Likely rejection/block reasons: missing deletion flow, incomplete health/government-ID privacy declarations and policy, missing/invalid privacy manifest in final bundle, placeholder backend, absent review credentials/demo instructions, unverified purpose strings, and no tested Xcode 26/iOS 26 release artifact.

Top Apple actions: build with Xcode 26+/iOS 26 SDK; inspect generated Info.plist/entitlements; generate privacy report and valid manifests; publish policy and accurate App Privacy answers; implement deletion initiation; verify photo-purpose text; prepare review credentials/demo tenant; complete updated age-rating questions; provide metadata/screenshots/support URL; TestFlight test against production-like backend; document enterprise/employment-record retention constraints.

## Dependency inventory and status

Mobile runtime SDKs include Expo 57, React Native 0.86.3, React 19.2.3, React Navigation, TanStack Query, Zod, SecureStore, Crypto, FileSystem, Document/Image Picker and Sharing. Server runtime includes Express, Drizzle/PostgreSQL, jsonwebtoken, bcrypt, multer, Google APIs, document/PDF/XLSX libraries and many UI/export packages. No advertising, analytics or crash SDK was found in the mobile manifest/package.

An online `npm audit` could not be completed because registry access was unavailable in the sandbox and permission to send dependency metadata externally was not granted. Therefore known-CVE and license status is **NOT VERIFIED**; lockfile-based SCA must be completed in the authorized CI environment. The presence of ranges and a large server dependency surface requires SBOM and recurring review.

## Performance/reliability

Positive: 5 MB upload limit, pagination helper, React Query, database indexes/migrations, pool caps/circuit-breaker code and graceful shutdown. Risks: in-memory multipart buffering, no resumable transfer, no API timeouts, office-list fan-out (`Promise.all` per unique crew), local filesystem coupling, response-body serialization overhead, background-job/live multi-tenant behavior not load tested, and no mobile profiling/battery/network-switch results. Startup, N+1, large profile, concurrency and database plans are **NOT VERIFIED** by measurement.

## Maritime/regulatory alignment

| Framework/area | Applicability | Support assessment |
|---|---|---|
| STCW certificates/training/competency/sea service | APPLICABLE to represented records | PARTIALLY SUPPORTED; record workflows exist, but authoritative rule/version/flag validation and bypass tests are incomplete. |
| MLC 2006 employment/medical/contracts/wages | POTENTIALLY APPLICABLE | PARTIALLY SUPPORTED in ERP; mobile exposes medical/employment subsets. Legal/flag/company confirmation required. |
| ISM safety competence/training/records | POTENTIALLY APPLICABLE | PARTIALLY SUPPORTED; forms/alerts exist, but controlled-record integrity and audit assurance are insufficient. |
| ISPS | NEEDS COMPLIANCE REVIEW | Crew identity/assignment may support access processes; no claim of ISPS control implementation. |
| Flag-state/company manning rules | REQUIRES LEGAL/COMPLIANCE CONFIRMATION | Rules exist in code/data modules, but completeness/currentness and direct-API bypass testing are not established. |
| Data-protection/employment/health laws | APPLICABLE or POTENTIALLY APPLICABLE by customer/jurisdiction | NOT SUPPORTED sufficiently for clearance: retention, notice, rights, processor mapping and transfer assessment incomplete. |

No certification or legal compliance is claimed.

## Top priorities

### Top 10 release blockers

1. Make change approval atomic and idempotent.
2. Remove/redact production response-body logging.
3. Implement rapid access-token invalidation for logout/disable/password/incident.
4. Define and implement privacy notice, retention, deletion and export/correction workflows.
5. Add durable offline outbox, conflict control and idempotency.
6. Add malware scanning/content sanitization for documents.
7. Prove encryption at rest, backup/restore, RPO/RTO and tenant recovery.
8. Produce hardened signed Android/iOS release artifacts with non-placeholder endpoints.
9. Complete Play/App Store privacy/deletion/metadata requirements.
10. Establish security CI, monitoring and incident-response evidence.

### Top security improvements

Atomic approvals; token session versioning; MFA for admins; tenant-root file binding; malware quarantine; centralized config validation; structured redacted logging; SAST/SCA/secret scan; modern TLS/pinning decision; live two-tenant VAPT.

### Top privacy improvements

Published notice; field-purpose inventory owner; retention schedule; deletion workflow; data export/correction; consent/legal-basis mapping; dependent/next-of-kin notice; processor/transfer inventory; log minimization; backup-erasure policy.

### Top mobile improvements

Durable offline queue; timeouts/backoff; resumable uploads; conflict UI; screenshot/app-switcher protection; backup exclusions; biometric step-up; secure download cleanup; certificate posture; crash reporting configured with PII scrubbing and disclosure.

### Top backend/API improvements

Transactional idempotency; conditional updates/versioning; request correlation; route-specific limits; full schemas/no mass assignment; paginated review queue; token revocation/version checks; cache-control headers; tenant-bound file reads; security-event alerts.

## Remediation plan

| Priority | Issue / owner | Risk and implementation | Verification |
|---|---|---|---|
| P0 | Approval integrity — Mobile BFF/DB | Transactional state machine, outbox, idempotency ledger and reconciliation; ERP unchanged | Concurrent 20-request test yields one ERP mutation; crash-injection recovery |
| P0 | PII/token logging — Mobile BFF/SRE | Route mobile calls through a separately logged service; metadata-only logs, redaction and event schema | Canary secrets never appear in BFF or downstream ERP logs |
| P0 | Session invalidation — Mobile BFF auth | Credential/session version and incident revoke path | Stolen token fails immediately after disable/logout-all/password reset |
| P0 | Tenant/file isolation — Mobile BFF/storage | Enforce token-derived tenant/crew and tenant-root object keys; two-tenant negative suite | Attempted cross-owner/path access returns 404/403 with security event |
| P0 | Privacy/retention — privacy + Mobile BFF | Approved data map, policy, retention/legal hold and rights orchestration through supported ERP APIs/manual workflow | End-to-end request with truthful DB/file/log/backup completion evidence |
| P0 | Backup/DR — Mobile BFF SRE/DBA | BFF PITR + immutable object backup + tenant restore; capture separate ERP dependency RPO/RTO | Witnessed BFF restore and ERP reconciliation |
| P1 | Offline/idempotency — mobile/BFF | Encrypted outbox, operation IDs, status reconciliation, retries/conflicts | Packet loss, reboot, duplicate and timeout scenarios |
| P1 | Upload safety — security/BFF | Quarantine, AV/CDR, checksums, scan status before ERP linkage | EICAR-like safe test, malformed/polyglot corpus, authorization suite |
| P1 | Store release — mobile/release/privacy | Final manifests, privacy declarations, deletion request, signed builds | Play pre-launch + TestFlight review checklist |
| P1 | DevSecOps — BFF/mobile platform/security | SAST/SCA/SBOM/secrets/signing/provenance/DAST | Required green protected-branch gates |
| P2 | Mobile hardening — mobile | screenshots, backup, biometric, integrity posture, download cleanup | MASVS device tests on Android/iOS |
| P2 | Monitoring/IR — BFF SRE/security | SIEM events, alerts and playbooks including downstream ERP coordination | tabletop plus simulated token/tenant/document incident |
| P2 | Performance — BFF/mobile platform | load/profile gateway, adapter, mobile and workers without altering ERP | agreed SLOs under representative tenant volume/link profile |
| P3 | Resilience — mobile/security | obfuscation/tamper/pinning based on threat model | reverse-engineering and interception retest |

## Implementation roadmap with no ERP source changes

### Phase 0 — Contract and containment (1–2 weeks)

1. Freeze and inventory the exact ERP APIs needed by mobile, including tenant, authorization, write semantics and stable lookup keys.
2. Establish the BFF repository, deployment boundary, secrets, database and private object storage.
3. Issue a dedicated least-privileged ERP integration identity per environment; prefer per tenant where feasible.
4. Remove direct ERP origins/credentials from mobile builds and restrict ERP ingress to the BFF where infrastructure permits.
5. Define authoritative ownership: ERP owns live crew records; BFF owns mobile identity, pending state, idempotency, audit, files-before-approval and privacy requests.

**Exit evidence:** signed API contract, network diagram, service-account permission matrix, threat model, and proof that mobile cannot reach general ERP APIs directly.

### Phase 1 — Read-only secure pilot (2–4 weeks)

1. Implement dedicated mobile authentication, rotation, session versioning, lockout and revoke-all.
2. Implement token-derived tenant and current-crew policy in every BFF handler.
3. Proxy only allowlisted read models; perform response minimization so the mobile receives only displayed fields.
4. Add correlation IDs, metadata-only logs, SIEM events, rate limits, timeouts and circuit breakers.
5. Add privacy notice/support/deletion-request entry points and harden SecureStore, screenshots, backups and cache cleanup.

**Exit evidence:** two-tenant/three-role authorization suite, modified-token tests, log canary test, MASVS device test, and a pilot tenant read-only acceptance report.

### Phase 2 — Controlled writes and approvals (3–6 weeks)

1. Add durable encrypted client outbox and operation UUIDs.
2. Add BFF pending-change/version snapshot, review audit and transactional command outbox.
3. Implement ERP adapters one workflow at a time, beginning with the lowest-risk profile fields.
4. Reconcile every ambiguous ERP outcome; route non-reconcilable operations to manual office review.
5. Add conflict UI for ERP records changed after mobile submission.

**Exit evidence:** duplicate/concurrent/reboot/timeout/crash-injection tests, proof of one ERP mutation per operation, reviewer RBAC tests, and immutable old/new audit evidence.

### Phase 3 — Documents and maritime-network resilience (2–4 weeks)

1. Upload to quarantine object storage, validate size/signature, scan/CDR, then promote clean objects.
2. Add chunking/resume/checksum where the supported file workflow warrants it.
3. Provide short-lived BFF-authorized downloads; do not expose ERP storage paths.
4. Test at 10–20 KB/s, high latency, packet loss, disconnect, process death and device reboot.

**Exit evidence:** malicious/malformed file corpus, cross-crew/cross-tenant tests, interrupted-transfer recovery and storage restore.

### Phase 4 — Store and enterprise clearance (2–3 weeks)

1. Produce final signed AAB/IPA with real production BFF origin and inspect generated manifests/permissions.
2. Complete Play Data Safety, App Privacy, privacy manifest, policy and deletion information from measured behavior.
3. Run SAST/SCA/secret scan/SBOM, mobile and BFF DAST, independent VAPT and remediation retest.
4. Run backup restore and incident tabletop; approve RPO/RTO and operational ownership.
5. Pilot one tenant, monitor, then use controlled tenant-by-tenant rollout and rollback flags.

**Exit evidence:** store preflight packets, independent VAPT closure, restore record, incident exercise, customer security pack and formal go-live approval.

## Go-live gates for the compensating-control architecture

The combined solution may be reconsidered for release only when all are true:

- The shipped mobile binary talks only to the production BFF.
- Tenant and crew ownership tests pass against two actual isolated tenants.
- Concurrent or replayed submissions cause exactly one intended ERP outcome.
- An ambiguous timeout is reconciled without blind duplicate retry.
- Tokens are invalid immediately after security-sensitive revocation events.
- No credentials, tokens, passports, medical data or full response payloads appear in accessible logs.
- Files are quarantined, scanned and authorized before any ERP linkage or download.
- Privacy policy, retention, request/deletion handling and store declarations are approved and accurate.
- BFF database/object storage backup restore meets documented RPO/RTO, and the ERP dependency has separate assurance.
- A signed AAB/IPA, SCA/SBOM, MASVS testing and independent VAPT have passed.
- Residual ERP risks are explicitly accepted by accountable business, security and compliance owners; no mobile control is represented as fixing other ERP channels.

## Final clearance matrix

| Clearance | Result | Score | Blocking Issues |
|---|---|---:|---|
| Production | NOT READY | 4/10 | Approval integrity, logs, DR, monitoring, release configuration |
| Security | NOT READY | 5/10 | Token invalidation, upload scanning, at-rest evidence, security pipeline |
| Privacy | NOT READY | 3/10 | Notice/retention/deletion/export, log leakage, processor mapping |
| Multi-Tenant | READY WITH CONDITIONS | 7/10 | Live two-tenant VAPT and tenant-root file enforcement |
| Maritime ERP | NOT READY | 4/10 | Offline reliability, integrity/audit, rule/compliance validation |
| Google Play | NOT READY | 3/10 | Final target/API artifact, Data Safety/privacy/deletion, signed AAB |
| Apple App Store | NOT READY | 3/10 | Xcode/iOS SDK artifact, privacy manifest/declarations/deletion/review package |

These are **current-state** results. The frozen-ERP/BFF approach is the recommended route to closure, not an automatic change of score. Scores should be updated only after the phase exit evidence and go-live gates above are independently verified.

## Verification notes

- Store requirements were checked against current official guidance. As of the audit date, Google Play requires API 36 for new apps and updates from 31 August 2026, while Apple requires Xcode 26 and the iOS 26 SDK for uploads since 28 April 2026. [Google target API requirements](https://developer.android.com/google/play/requirements/target-sdk), [Google Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469), [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/?id=02032026a), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- Mobile typecheck/test and root typecheck processes did not complete within the available 120-second execution window and produced no reliable pass/fail result; treat automated test status as **NOT VERIFIED**, not passed.
- No repository files were modified other than this audit report.
- This is a source-based readiness assessment, not a penetration-test attestation, regulatory opinion, or certification.
