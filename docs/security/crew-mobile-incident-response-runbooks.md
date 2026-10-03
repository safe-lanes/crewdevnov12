# SAIL Crew Mobile and BFF Incident-Response Runbooks

Status: operational draft; owner and contact assignments require approval.

Scope: Expo mobile application, `/api/crew-app` BFF, BFF-owned database records, mobile file/quarantine storage, CI/CD, and supported ERP integration interfaces. The deployed ERP is a frozen dependency. Responders must not directly alter ERP code, schemas, or customer workflows under these runbooks. Any ERP containment or correction must use an approved existing API/configuration procedure and be coordinated with the ERP owner.

## Roles and escalation placeholders

Assign named people, alternates, and out-of-band contact methods before production:

| Placeholder | Responsibility |
|---|---|
| `[INCIDENT_COMMANDER]` | Own severity, decisions, timeline, and closure |
| `[SECURITY_ON_CALL]` | Triage, containment, investigation, and evidence |
| `[BFF_SERVICE_OWNER]` | BFF configuration, deployment, sessions, and data |
| `[MOBILE_RELEASE_OWNER]` | Mobile builds, store releases, and device controls |
| `[ERP_OWNER]` | Supported ERP-side containment and reconciliation |
| `[TENANT_OWNER]` | Customer/tenant coordination and authorization |
| `[PRIVACY_LEGAL_OWNER]` | Breach assessment, notices, retention, and legal hold |
| `[PLATFORM_IAM_OWNER]` | Cloud, identity, secrets, logging, and storage controls |
| `[COMMUNICATIONS_OWNER]` | Approved internal/customer communications |
| `[SUPPLIER_OWNER]` | Third-party and SDK coordination |

Do not place personal phone numbers, private email addresses, API keys, or credentials in this repository. Store the approved contact tree in the controlled incident-management system and link it from the deployed runbook.

## Common response procedure

1. Open an incident record and assign `[INCIDENT_COMMANDER]` and severity.
2. Preserve correlation IDs, timestamps, deployment IDs, pseudonymized actor/tenant IDs, security events, relevant audit records, and immutable copies of affected artifacts. Never copy access tokens, passwords, passport contents, medical contents, or full request bodies into tickets or chat.
3. Establish an incident time source and record every action, actor, reason, and result.
4. Contain using the narrowest reversible control. Do not destroy evidence, directly edit tenant data, or change the frozen ERP without `[ERP_OWNER]` authorization.
5. Rotate or revoke credentials through approved systems. Treat rotation as incomplete until old credentials are proven unusable.
6. Identify affected tenants and records from server-side evidence; do not infer scope from client-supplied tenant or crew identifiers.
7. Ask `[PRIVACY_LEGAL_OWNER]` to determine notification, legal-hold, maritime, employment, and jurisdictional obligations. This document does not define legal deadlines.
8. Recover from a known-good version, verify tenant isolation and audit continuity, monitor for recurrence, and obtain incident-command approval before reopening access.
9. Complete a blameless post-incident review with root cause, control failures, corrective owners, due dates, and evidence of retest.

## 1. Stolen phone

**Detection:** User or tenant report, unexpected device refresh, device mismatch event, abnormal access, or mobile-device-management alert.

**Containment:** Record the last known device label and time without collecting a persistent device fingerprint. Instruct the user through an approved channel to use logout-all/devices. If risk is high, `[BFF_SERVICE_OWNER]` disables the credential or increments its session version. Do not rely on device ID, jailbreak/root checks, or remote wipe as proof of containment.

**Revocation:** Revoke all refresh tokens and increment the credential session version so existing access tokens fail immediately. Reset the password where account exposure is plausible. Revoke device push registration when implemented.

**Investigation and evidence:** Review pseudonymized login, refresh, ownership-denial, download, upload, and privacy-request events from the loss window. Preserve app version, OS version if volunteered, session records, and affected resource identifiers—not document contents.

**Escalation:** `[SECURITY_ON_CALL]`, `[BFF_SERVICE_OWNER]`, `[TENANT_OWNER]`; add `[PRIVACY_LEGAL_OWNER]` if sensitive data may have been accessed.

**Recovery:** Re-enrol after identity verification, issue a fresh session family, and confirm the old access and refresh tokens are rejected.

**Post-incident review:** Determine whether local authentication, screenshot protection, shorter access TTL, user education, or device-management controls would reduce recurrence.

## 2. Stolen access or refresh token

**Detection:** Refresh replay, impossible session sequence, device mismatch, token use after logout, or an exposed token found in logs/build artifacts.

**Containment:** Preserve the token fingerprint/hash only. Do not paste the raw bearer token into incident systems. Revoke its refresh-token family and increment the associated credential session version. If signing-secret exposure is suspected, declare a broader authentication incident.

**Revocation:** For one account, invalidate its sessions. For signing-secret compromise, rotate the affected mobile signing secret, invalidate all affected token families, and require fresh authentication. Keep access and refresh secrets distinct.

**Investigation and evidence:** Establish issuance, last legitimate use, replay attempts, routes reached, tenant context, and downloads or mutations performed. Search redacted logs and CI artifacts for the token fingerprint, not the token.

**Escalation:** `[SECURITY_ON_CALL]`, `[BFF_SERVICE_OWNER]`; add `[PLATFORM_IAM_OWNER]` for secret exposure and affected `[TENANT_OWNER]` roles for confirmed misuse.

**Recovery:** Verify old tokens fail on protected endpoints, issue new credentials, and monitor refresh replay and authorization-denial events.

**Post-incident review:** Document the exfiltration route and retest logging redaction, secure storage, session invalidation, and secret handling.

## 3. Compromised crew or office account

**Detection:** User report, repeated lockout, anomalous access, unexpected profile submissions, approval activity, or tenant alerts.

**Containment:** Disable the credential when supported, increment session version, revoke refresh tokens, and suspend high-risk mobile approvals for the account. An office account must be handled by the existing ERP identity owner; do not add an unapproved BFF privilege path.

**Revocation:** Reset password after identity verification. Rotate related recovery credentials and API credentials only when evidence shows exposure.

**Investigation and evidence:** Review login history, approvals/rejections, operation IDs, pending changes, file access, and privacy requests. Compare all mutations with authoritative ERP state through supported read APIs. Preserve reviewer and operation audit records.

**Escalation:** `[SECURITY_ON_CALL]`, `[TENANT_OWNER]`, `[BFF_SERVICE_OWNER]`; include `[ERP_OWNER]` for office accounts or ERP-side actions.

**Recovery:** Restore access only after identity verification, secure credential reset, reconciliation of queued operations, and tenant approval where required.

**Post-incident review:** Evaluate phishing resistance, administrator step-up/MFA, breached-password controls, and approval separation.

## 4. Exposed passport, medical record, or other crew document

**Detection:** Crew/customer report, ownership-denial spike, public URL discovery, storage alert, malware event, or access-log anomaly.

**Containment:** Remove public reachability or disable the affected BFF download path without deleting the source evidence. Restrict the exact storage object/prefix and affected account. Do not broadly delete legally retained ERP records.

**Revocation:** Revoke any signed URL, storage credential, compromised account session, or service credential involved. Rotate storage keys if scope cannot be bounded.

**Investigation and evidence:** Record tenant, crew/resource pseudonym, object checksum/key reference, authorization decisions, access timestamps, and recipients where reliably known. Keep document contents in restricted evidence storage under legal hold if directed.

**Escalation:** Immediately involve `[INCIDENT_COMMANDER]`, `[SECURITY_ON_CALL]`, `[PRIVACY_LEGAL_OWNER]`, `[TENANT_OWNER]`, and `[PLATFORM_IAM_OWNER]`; involve `[ERP_OWNER]` if the authoritative ERP copy or API was exposed.

**Recovery:** Correct authorization/storage policy, confirm private access and tenant binding, scan the file, and validate access using positive-owner and negative cross-tenant tests.

**Post-incident review:** Complete breach-scope assessment, notification decisions, object-storage/IAM review, and an independent authorization retest.

## 5. Cross-tenant exposure

**Detection:** Tenant mismatch/cross-tenant event, another tenant's data reported by a user, IDOR test failure, or AsyncLocalStorage/context anomaly.

**Containment:** Treat as highest-priority until disproven. Disable the affected route, deployment, or tenant feature flag. Preserve both tenant contexts. Never “fix” records by moving or deleting them before evidence capture.

**Revocation:** Revoke sessions demonstrably used for exploitation; rotate shared infrastructure credentials if tenant-boundary failure involves them.

**Investigation and evidence:** Identify the first affected release, requests, resource types, read/write exposure, tenants, file paths, cache behavior, connection pools, and context propagation. Reproduce only in an authorized isolated two-tenant environment.

**Escalation:** `[INCIDENT_COMMANDER]`, `[SECURITY_ON_CALL]`, `[BFF_SERVICE_OWNER]`, `[PLATFORM_IAM_OWNER]`, `[PRIVACY_LEGAL_OWNER]`, every affected `[TENANT_OWNER]`, and `[ERP_OWNER]` if ERP records changed.

**Recovery:** Patch the BFF/mobile boundary, reconcile unauthorized writes through supported ERP procedures, then require independent two-tenant IDOR/BOLA and concurrent-context retesting before reopening.

**Post-incident review:** Document the broken invariant, expand tenant-negative tests, review data architecture, and track notification/remediation obligations per tenant.

## 6. Malicious or compromised administrator

**Detection:** Unexpected approvals, bulk access, role changes, secret access, disabled logging, or actions outside authorized change windows.

**Containment:** Use an independent privileged identity to suspend the administrator and preserve logs. Apply separation of duties; the suspected administrator must not approve containment or evidence access.

**Revocation:** Revoke sessions, administrative access, deployment credentials, and affected service credentials. Coordinate ERP administrator revocation with `[ERP_OWNER]`.

**Investigation and evidence:** Preserve immutable admin audit trails, approval/rejection records, deployments, CI runs, secret-access logs, support sessions, and ERP reconciliation results. Limit investigator access and record chain of custody.

**Escalation:** `[INCIDENT_COMMANDER]`, `[SECURITY_ON_CALL]`, `[PLATFORM_IAM_OWNER]`, `[PRIVACY_LEGAL_OWNER]`, `[TENANT_OWNER]`, and `[ERP_OWNER]` as applicable.

**Recovery:** Restore access using two-person approval, known-good role assignments, rotated credentials, and verified audit/monitoring coverage.

**Post-incident review:** Review privileged-access management, MFA/step-up, just-in-time access, approval separation, and audit immutability.

## 7. BFF database compromise

**Detection:** Database/IAM alert, unexplained queries or exports, integrity mismatch, credential leak, or attacker evidence.

**Containment:** Isolate affected BFF database access, preserve snapshots/logs, restrict network paths, and stop mobile writes if integrity cannot be trusted. Do not claim or modify ERP scope without separate evidence.

**Revocation:** Rotate BFF database and service credentials, mobile token secrets if exposed, pseudonymization key if exposed, and affected human access. Plan pseudonym continuity implications before rotating the event key.

**Investigation and evidence:** Determine data read/changed, tenants, persistence, entry vector, backup exposure, migrations, session hashes, pending operations, privacy requests, and audit integrity. Compare queued/applied operations with authoritative ERP state.

**Escalation:** `[INCIDENT_COMMANDER]`, `[SECURITY_ON_CALL]`, `[BFF_SERVICE_OWNER]`, `[PLATFORM_IAM_OWNER]`, `[PRIVACY_LEGAL_OWNER]`, affected `[TENANT_OWNER]`, and `[ERP_OWNER]` for reconciliation.

**Recovery:** Rebuild from known-good infrastructure, restore a verified backup where appropriate, apply migrations, rotate credentials, validate tenant isolation, and reconcile every non-final operation before resuming writes.

**Post-incident review:** Complete architecture/IAM review, backup exposure review, forensic report, restore exercise, and independent penetration test.

## 8. Mobile application vulnerability

**Detection:** Researcher report, VAPT, store warning, crash/security telemetry, SAST/SCA finding, or demonstrated exploit.

**Containment:** Assess exploitability by released version. Disable the narrow affected BFF capability or enforce a minimum supported app version only when an approved mechanism exists. Do not rely on store removal alone.

**Revocation:** Revoke exposed sessions/secrets. Never ship signing secrets or database credentials in the app; if found, treat their backend systems as compromised.

**Investigation and evidence:** Preserve vulnerable APK/IPA or bundle, source commit, dependency lockfiles, build provenance, reproduction steps, affected API calls, and impacted versions. Keep researcher details restricted.

**Escalation:** `[SECURITY_ON_CALL]`, `[MOBILE_RELEASE_OWNER]`, `[BFF_SERVICE_OWNER]`, `[PRIVACY_LEGAL_OWNER]` if data exposure exists, and store-console owners through controlled channels.

**Recovery:** Patch, peer review, run security regression and device tests, build signed artifacts through CI, inspect final manifests, stage rollout, and monitor. Use emergency release procedures only with recorded approval.

**Post-incident review:** Update threat model, tests, secure-coding guidance, release gates, and coordinated-disclosure handling.

## 9. Supplier or SDK compromise

**Detection:** Supplier advisory, dependency scanner, malicious package behavior, signature/provenance failure, unexpected permissions/network traffic, or ecosystem incident.

**Containment:** Freeze affected builds/deployments, identify exact versions and transitive paths from SBOMs and lockfiles, and disable the affected integration where safe. Do not upgrade blindly before understanding compatibility and indicators.

**Revocation:** Rotate credentials accessible to the component, revoke CI/package tokens, and invalidate affected artifacts or sessions based on exposure.

**Investigation and evidence:** Preserve SBOMs, lockfiles, package archives/hashes, CI logs, signed artifacts, supplier notices, network indicators, and build environment details. Determine whether code executed in CI, BFF, or mobile runtime.

**Escalation:** `[INCIDENT_COMMANDER]`, `[SECURITY_ON_CALL]`, `[SUPPLIER_OWNER]`, `[MOBILE_RELEASE_OWNER]`, `[BFF_SERVICE_OWNER]`, `[PLATFORM_IAM_OWNER]`, and `[PRIVACY_LEGAL_OWNER]` where exposure is possible.

**Recovery:** Remove, pin, or replace the dependency; rebuild from a trusted environment; regenerate SBOMs; validate signatures/provenance; retest permissions and traffic; and use staged deployment.

**Post-incident review:** Reassess supplier tiering, update dependency policy, improve artifact verification, and record supplier remediation evidence.

## Required exercise and closure evidence

Before production, conduct at least one tabletop covering stolen token, cross-tenant exposure, and exposed passport/medical document. Record participants by role, scenario, decisions, detection gaps, containment time, recovery criteria, corrective actions, and approval. Do not mark these runbooks operationally verified until the contact tree, SIEM/alert delivery, account-disable procedure, secret rotation, evidence repository, customer escalation, and ERP reconciliation steps have been exercised.

Incident closure requires `[INCIDENT_COMMANDER]` approval, `[PRIVACY_LEGAL_OWNER]` disposition, affected `[TENANT_OWNER]` coordination, recovery evidence, monitoring period completion, and tracked corrective actions. An exercise or document review alone is not evidence that an actual control works.
