# SAIL Crew Mobile — Consolidated Security Remediation and Release Readiness Report

**Report date:** 2 October 2026  
**Repository:** SAIL Crewing application  
**Assessment basis:** source code, configuration, migrations, focused automated tests, production bundle build and official store guidance  
**Current release decision:** **NO-GO — implementation is substantially hardened, but production infrastructure evidence, signed binaries, independent VAPT closure and store-console completion are still required.**

## 1. Executive summary

The mobile security remediation has implemented the application-side controls that can be safely added without changing the established ERP client contract. Mobile traffic terminates at an isolated crew-app BFF. Mobile writes are validated and staged, office users approve or reject them, and a durable server-side worker applies approved commands to the existing ERP boundary. The legacy ERP remains the system of record; the mobile client never connects directly to it.

The source now includes tenant-aware authorization, session revocation, refresh-token replay handling, durable offline operations, malware-scanning and private-object-storage interfaces, privacy-request execution, backup/restore and SIEM controls, server-enforced TOTP MFA, mobile screenshot protection, CI/SCA definitions, a VAPT pack and signed-build safeguards.

This work does **not** prove that the production cloud, databases, object store, malware scanner, SIEM, backup vault, signed AAB/IPA or store consoles are correctly configured. It also does not constitute an independent penetration test. Release remains blocked until the evidence and approvals in sections 6–9 are complete.

## 2. Scope and architectural constraint

The governing constraint was: do not change ERP code already used by clients; changes may be made in the mobile application and its isolated server components.

The implemented boundary is:

```text
Mobile app
   │ isolated crew access/refresh tokens
   ▼
/api/crew-app BFF
   │ validation, ownership, role and tenant enforcement
   │ staged pending changes / durable command records
   ▼
Office review + ERP command worker
   │ approved, idempotent, auditable operations only
   ▼
Existing ERP contract and database (system of record)
```

No mobile credential is accepted by the legacy ERP routes. No mobile client receives ERP database credentials. Existing ERP behavior is protected by an adapter/worker boundary, idempotency keys, leases, bounded retry and manual reconciliation for ambiguous outcomes.

## 3. Work completed

### 3.1 Authentication, sessions and authorization

- Separate crew-app access and refresh secrets; the legacy `JWT_SECRET` is not reused.
- Short-lived access tokens and rotating refresh tokens stored as hashes server-side.
- Refresh-token replay and device mismatch revoke the session family.
- Session-version checks invalidate access tokens after security-sensitive changes and logout-all.
- Current credential state is checked for protected requests; disabled or changed accounts cannot continue using stale tokens.
- Timing-equalized, generic invalid-login behavior reduces account enumeration.
- Per-account lockout plus per-IP authentication rate limits.
- Temporary password single-use handling and forced password reset.
- Server-derived crew identity, centralized role/ownership rules and tenant-context enforcement.
- Admin and office workflows retain their existing authentication boundary and receive explicit RBAC checks.

**Why:** A mobile client and its tokens are attacker-controlled inputs. Authorization, tenant selection and identity must be derived and revalidated on the server, not trusted from request fields or UI state.

### 3.2 Mobile write isolation and ERP command safety

- Crew profile mutations are staged as pending changes rather than written directly into ERP records.
- Office approval/rejection is atomic and protected against double decisions.
- Approved operations generate durable ERP commands with deduplication and idempotency information.
- Worker leases, bounded retry, dead-letter/manual-reconciliation states, health reporting and operator controls are implemented.
- Read-back/reconciliation handles ambiguous timeouts without blindly replaying a possibly successful ERP mutation.
- Tenant context is established for worker execution and tested across concurrent tenants.

**Why:** This preserves the established ERP contract while containing mobile risk. Network retries, offline replay or concurrent reviewers must not create duplicate or cross-tenant ERP changes.

### 3.3 Offline/mobile reliability

- Encrypted durable mobile outbox for supported operations.
- Idempotency identifiers and explicit status handling.
- Logout/account changes clear session-specific cached information.
- Maritime-network test plan and performance harness are present.

**Why:** Crew devices commonly operate on intermittent, high-latency links. Reliability controls are also security controls because uncontrolled retries and stale-session replay can cause unauthorized or duplicate mutations.

### 3.4 File and malware security

- Pluggable file scanner with a real ClamAV integration path; production configuration requires ClamAV.
- Files are quarantined/rejected until scanning succeeds.
- Private S3-compatible object-storage driver with tenant-bound keys and controlled retrieval.
- Production validation requires private object storage rather than local public filesystem delivery.
- Upload controls cover file size/type validation, safe names and tenant isolation.

**Why:** User-controlled files cannot be trusted based on filename or MIME type. Private storage and malware disposition must occur before files are made available to users or ERP workflows.

### 3.5 Privacy and deletion execution

- In-app privacy-request initiation and request status access.
- Office verification, approval, rejection, legal-hold, execution and completion states.
- Deletion execution separates operational deletion/anonymization from evidence that must legally be retained.
- Audit records and operator guidance were added.
- Mobile navigation exposes the privacy request flow.

**Why:** Store declarations and privacy notices are insufficient unless requests can be authenticated, executed, audited and reconciled with retention/legal-hold requirements.

### 3.6 Backup, restore, incident response and SIEM

- Backup script and restore-verification automation.
- Disaster-recovery runbook and backup evidence requirements.
- Pseudonymized structured crew security events and alert evaluation.
- HTTPS SIEM sink with production configuration enforcement.
- Safe request logging and incident-response runbooks.
- Production secrets, scanner, object storage and SIEM configuration fail closed.

**Why:** Security controls are incomplete without detection and recovery. A backup is not evidence of recoverability until a restore is exercised, and logs are not monitoring until delivery and alert response are proven.

### 3.7 Mobile hardening and MFA

- Server-enforced TOTP MFA: no access or refresh token is issued before the second factor succeeds for an enrolled account.
- TOTP seeds encrypted with AES-256-GCM using `CREW_APP_MFA_ENCRYPTION_KEY`.
- Eight hashed, single-use recovery codes with atomic consumption.
- Invalid MFA attempts participate in account lockout.
- Existing enrolled MFA cannot be silently overwritten by starting enrollment again.
- In-app enrollment and authenticator/recovery-code login challenge.
- Screenshot and screen-recording blocking through Expo Screen Capture.
- Device-only secure token storage, Android backup disabled and iOS complete data protection.
- Minimal sensitive permissions and no declared deep-link surface.

**Why:** Biometrics alone would only unlock local device storage and would not provide a server-verifiable second factor. TOTP provides real server MFA; biometrics may later be added as an optional local convenience control.

### 3.8 CI, SAST, SCA and supply-chain preparation

- Security CI jobs for deterministic installs, build, mobile type checks and tests.
- CodeQL JavaScript/TypeScript analysis.
- Full-history Gitleaks scanning.
- Root and mobile dependency audits plus pull-request dependency review.
- New high/critical dependencies are blocked by dependency review.
- Separate CycloneDX SBOMs with 90-day evidence retention.
- Grouped weekly Dependabot updates for root, mobile and GitHub Actions.
- Security workflow policy and regression tests.

**Why:** Security checks must run repeatedly on changes. A one-time audit cannot control newly introduced code, dependencies or credentials.

### 3.9 Independent VAPT preparation

- Written-authorization/rules-of-engagement template with explicit exclusions, rate ceilings and stop conditions.
- Twenty-area Android, iOS and API test matrix mapped to MASVS/MASTG and the OWASP API Security Top 10.
- Two-tenant, multi-role account and test-data requirements.
- Evidence, finding, remediation, retest and release-closure registers.
- SHA-256 evidence-manifest utility tying binaries/reports to the source commit.

**Why:** Independent VAPT must be performed against an authorized, controlled environment and exact release-candidate binaries. Preparation artifacts are not a penetration-test certificate.

### 3.10 Signed build preparation

- Production EAS profile uses store distribution, remote versioning and remote signing credentials.
- Android output is constrained to AAB; iOS is constrained to a physical-device/store build.
- First Google submission remains internal/draft rather than automatically rolling out.
- Root `.env` supplies local public build variables; the EAS production environment supplies them remotely.
- Production endpoint and EAS project ID checks fail closed.
- Keystores, certificates, provisioning profiles, credentials files, AABs and IPAs are excluded from Git.
- Artifact verifier calculates SHA-256 and verifies Android archive signatures when `jarsigner` is available.
- Signing runbook covers certificate fingerprints, bundle inspection, entitlements and physical-device tests.

**Why:** Signing keys are release authority. They must remain in an approved credential system and the exact submitted binaries must match the binaries tested by VAPT and release QA.

## 4. Important implementation artifacts

| Area | Primary artifacts |
|---|---|
| Mobile schema/security migrations | `migrations/0218_mobile_approval_outbox.sql` through `migrations/0224_mobile_mfa.sql` |
| Authentication/MFA | `server/v2/crew-app/auth/`, `mobile/src/screens/MfaSetupScreen.tsx` |
| ERP command worker | `server/v2/crew-app/erp-commands/`, `server/v2/crew-app-review/erpCommandOperationsService.ts` |
| Privacy | `server/v2/crew-app/privacy/`, `server/v2/crew-app-review/privacyRequestService.ts`, `mobile/src/screens/PrivacyRequestsScreen.tsx` |
| Files | `server/v2/crew-app/files/`, `server/v2/shared/fileStorageService.ts` |
| Monitoring | `server/v2/crew-app/monitoring/`, `server/middleware/safeRequestLogging.ts` |
| Production config | `server/config/productionConfig.ts` |
| CI/SCA | `.github/workflows/security-ci.yml`, `.github/dependabot.yml`, `docs/security/ci-sca-policy.md` |
| VAPT | `docs/security/vapt-*.md`, `scripts/create-vapt-evidence-manifest.mjs` |
| Signing | `mobile/eas.json`, `mobile/app.config.js`, `scripts/verify-mobile-release-artifacts.mjs`, `docs/security/signed-mobile-build-runbook.md` |
| Store prechecks | `docs/security/google-play-release-precheck-2026-10-01.md`, `docs/security/apple-app-store-release-precheck-2026-10-01.md` |

## 5. Verification completed in this workspace

The following evidence was produced during remediation:

- Production web/BFF bundle build completed successfully.
- Mobile TypeScript compilation completed successfully after MFA/hardening changes.
- Focused security tests passed, including production configuration, device hardening, MFA boundary, CI policy, VAPT-pack completeness and signed-build readiness.
- Latest combined checks reported:
  - MFA/config/device tests: 13/13 passed.
  - CI/VAPT policy tests: 7/7 passed.
  - VAPT/signing readiness tests: 8/8 passed.
  - Final signing-readiness suite: 5/5 passed.
- Mobile source manifest validation passed.
- Security CI and Dependabot YAML parsed successfully.
- Evidence-manifest smoke test generated a valid source-bound SHA-256 record.
- `git diff --check` passed; line-ending warnings are informational.

### Known verification limitations

- The repository-wide legacy TypeScript check still reports many pre-existing errors outside the isolated crew-app scope. The production bundle succeeds, but the global type-error baseline must be reduced and eventually restored as a mandatory gate.
- The GitHub security workflow has been source-validated but has not been observed running in the repository's GitHub environment during this work.
- The mobile dependency audit currently reports four high and nine moderate transitive findings beneath Expo tooling. npm proposes a breaking downgrade to Expo 44, which is not an acceptable automatic fix for this Expo 57 application. These findings require ongoing Expo/vendor review and documented risk ownership; critical findings remain release-blocking.
- No production database migration, cloud resource, IAM policy, ClamAV service, SIEM endpoint, backup vault, physical device, AAB, IPA, Play Console or App Store Connect account was available for verification.

## 6. What remains and why it remains

| Remaining item | Status | Why it cannot be claimed complete from source alone | Required evidence |
|---|---|---|---|
| Apply migrations 0218–0224 | Blocker | Files exist but production databases were not changed | Migration log and schema verification for every tenant |
| Production secrets | Blocker | Secrets cannot be generated or committed by development automation | Secret-manager references, rotation owners and startup validation record |
| ClamAV runtime | Blocker | Integration exists but no reachable production scanner was supplied | Health test, EICAR rejection and outage/fail-closed evidence |
| Private object storage | Blocker | Driver exists but bucket/IAM/KMS were not available | Public-access-block proof, least-privilege IAM, encryption, lifecycle and tenant tests |
| Privacy policy/retention approval | Blocker | Legal/business decisions cannot be inferred from code | Published policy URL, retention schedule, DPO/legal approval and deletion exercise |
| Backup/restore | Blocker | Scripts/runbooks do not prove recoverability | Encrypted backup record, isolated restore drill, RPO/RTO measurement and sign-off |
| SIEM/alerts | Blocker | Sink code does not prove delivery or response | Live canary event, alert receipt, on-call acknowledgement and incident exercise |
| MFA rollout | Required | Feature is rollout-safe and does not automatically enroll existing users | Enrollment policy, pilot results, recovery helpdesk procedure and adoption report |
| Biometric app-resume lock | Optional hardening | Product recovery/UX decision is unresolved; it cannot replace TOTP | Approved UX/recovery design and physical-device tests if adopted |
| Full CI execution | Blocker | Workflow has not run on the authoritative Git host | Green required checks, CodeQL/Gitleaks results and retained SBOM artifacts |
| Dependency baseline | Risk decision | Expo transitive highs lack a safe non-breaking automatic fix | Vendor upgrade plan, owner, expiry and periodic audit evidence |
| Independent VAPT | Blocker | Internal preparation is not independent verification | Signed report, completed matrix and clean retest letter |
| Signed AAB/IPA | Blocker | Expo/store credentials and project were not supplied | Build IDs, hashes, certificate/team identity and signature verification |
| Physical-device release QA | Blocker | Simulator/source checks cannot verify OS/runtime behavior | Android/iOS device matrix and signed-build test record |
| Store declarations/submission | Blocker | Requires legal answers and console authority | Completed Data Safety/App Privacy, reviewer account, screenshots, submission/review record |

## 7. Required production configuration

Configuration must come from the root `.env` for local controlled environments and an approved secret/environment manager in production. Do not commit `.env` or signing credentials.

Key groups include:

- Crew tokens: `CREW_APP_ACCESS_TOKEN_SECRET`, `CREW_APP_REFRESH_TOKEN_SECRET`, token TTL.
- MFA: `CREW_APP_MFA_ENCRYPTION_KEY` as a unique 32-byte key encoded as 64 hex characters or base64.
- Tenant/database: tenancy mode, master/single-tenant database URLs and tenant domain.
- Files: `CREW_APP_FILE_SCANNER=clamav`, ClamAV host, S3 driver/bucket/region, optional KMS key and approved credentials mechanism.
- Monitoring: HTTPS SIEM URL/token and a distinct security-event pseudonymization key.
- ERP worker: enable flag, polling, concurrency, lease and retry limits.
- Mobile public configuration: `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PROJECT_ID`. These are public build values, not secrets.

All JWT, MFA, SIEM and security-event secrets must be distinct. Production startup validation must remain enabled and must not be bypassed.

## 8. Required completion sequence

### Phase A — infrastructure activation

1. Create an immutable deployment change record and database backups.
2. Apply migrations 0218–0224 to staging tenant databases, verify, then apply through the approved production rollout process.
3. Provision private object storage, block public access, configure encryption/lifecycle and apply least-privilege IAM.
4. Deploy ClamAV and prove clean, EICAR, timeout and unavailable-service behavior.
5. Configure all production secrets through the approved secret manager.
6. Configure the SIEM sink and demonstrate a canary event and alert acknowledgement.
7. Execute backup and isolated restore; record measured RPO/RTO.

### Phase B — controlled application acceptance

8. Run the complete GitHub Security CI workflow and retain CodeQL, secret scan, dependency, test and SBOM evidence.
9. Provision two staging tenants and all VAPT roles with synthetic data.
10. Pilot MFA enrollment, recovery and helpdesk processes.
11. Exercise privacy export/deletion/legal-hold workflows and obtain legal/privacy approval.
12. Complete maritime-network and offline/replay tests.

### Phase C — release candidate, VAPT and signing

13. Set final `EXPO_PUBLIC_API_BASE_URL` and link the organization-owned EAS project.
14. Configure remote Android and Apple signing credentials using named release custodians.
15. Generate signed production AAB and IPA; record EAS build IDs, source SHA, hashes and signing identities.
16. Inspect generated Android manifest and iOS plist/entitlements and test both artifacts on physical devices.
17. Give these exact artifacts and hashes to the authorized independent VAPT supplier.
18. Fix findings, rebuild as necessary and obtain independent retest closure. Any rebuilt binary receives a new hash and must be reconciled with prior evidence.

### Phase D — stores and staged release

19. Complete Google Data Safety and Apple App Privacy from the approved data inventory, including third-party SDK behavior.
20. Publish the privacy policy and confirm the in-app deletion route, processing time, legal-hold wording and support contact.
21. Prepare reviewer credentials that work without access to production client data.
22. Upload to Play internal testing and TestFlight first; do not auto-release.
23. Run signed-build acceptance, accessibility, crash, network and privacy tests.
24. Obtain product, security, privacy, operations and business go-live signatures.
25. Use staged rollout with monitoring, rollback criteria and on-call coverage.

## 9. Store requirements checked on the report date

Store requirements were checked against current official guidance. As of the audit date, Google Play requires API 36 for new apps and updates from 31 August 2026, while Apple requires Xcode 26 and the iOS 26 SDK for uploads since 28 April 2026. [Google target API requirements](https://developer.android.com/google/play/requirements/target-sdk), [Google Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469), [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/?id=02032026a), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

Additional implications:

- The generated Android artifact—not only `app.json`—must demonstrate target API 36 before upload.
- Google requires accurate Data Safety declarations covering the app and third-party SDKs.
- Apple uploads must use Xcode 26 or later with the iOS 26 SDK; the signed IPA/build record must prove this.
- Because the app provides user accounts, the account-deletion initiation must be easy to find in the app and must address associated data, subject to disclosed legal retention.
- Store guidance can change; recheck the official pages on the actual submission date.

## 10. Go/no-go checklist

Release is **GO** only when every item below is satisfied:

- `[ ]` Production migrations verified for all tenants.
- `[ ]` Production configuration validation passes without placeholders or shared secrets.
- `[ ]` ClamAV and private object storage operational evidence approved.
- `[ ]` SIEM canary/alert and backup restore exercise approved.
- `[ ]` Privacy policy, deletion and retention decisions approved.
- `[ ]` Complete required CI workflow is green with reviewed SAST/SCA/secret results and SBOMs.
- `[ ]` Mobile audit has no unaccepted critical/high runtime finding.
- `[ ]` Signed AAB and IPA pass manifest, entitlement, signature and device checks.
- `[ ]` Independent VAPT and retest are closed with zero open critical/high findings.
- `[ ]` AAB/IPA hashes match VAPT, approval and uploaded store artifacts.
- `[ ]` Google/Apple declarations and reviewer access are complete.
- `[ ]` Rollback, incident response and on-call ownership are confirmed.
- `[ ]` Product, security, privacy, operations and business owners sign the release decision.

Until then, the decision remains **NO-GO for public production/store release**. Internal development and controlled staging validation may continue under approved test-data and access rules.

## 11. Residual risks after completion

Even after the gates pass, residual risks remain: compromised end-user devices, phishing of passwords/TOTP, newly disclosed dependency vulnerabilities, cloud/IAM drift, store-signing account compromise, maritime network failure and human error in privacy/ERP operations. Controls should therefore be operated continuously: MFA adoption, key rotation, least-privilege review, alert response, dependency updates, restore drills, periodic VAPT and signed-artifact verification for each release.

## 12. Final conclusion

The application is materially stronger and the ERP compatibility requirement has been maintained by isolating mobile behavior in the app/BFF/worker layers. The source foundation is suitable to proceed into controlled infrastructure activation, signed release builds and independent testing. It is not yet production-cleared because the most important remaining evidence depends on real infrastructure, external assessors, signing authorities and store accounts rather than further source-only implementation.

