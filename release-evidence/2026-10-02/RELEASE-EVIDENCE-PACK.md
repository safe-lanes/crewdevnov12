# SAIL Crew Mobile Release Evidence Pack

**Evidence collection date:** 2026-10-02  
**Evidence mode:** Verification and organization only; no broad architecture change  
**Repository HEAD:** `9f5aceeee544d4e2d477fde034ed737bd83b953a`  
**Branch:** `Crewing_App_New`  
**Workspace state:** **DIRTY — 121 changed/untracked paths at collection start**  
**Candidate version:** Not assigned  
**Final Decision:** **NO-GO**

## Decision basis

No gate is marked `PASS` merely because implementation code, a template or a local mock/unit test exists. A production/runtime/store/independent gate requires evidence from that authority and environment. The dirty workspace means the current HEAD does not uniquely identify the files assessed, so the locally generated SBOMs and tests are candidate evidence only and cannot yet be matched to signed release artifacts.

Status interpretation:

- `PASS`: authoritative evidence exists, is current, is tied to the release candidate and satisfies the gate.
- `FAIL`: collected evidence demonstrates an unmet requirement or unaccepted release-blocking condition.
- `NOT VERIFIED`: evidence is missing, incomplete, not authoritative or cannot be tied to the release candidate.
- `NOT APPLICABLE`: the accountable authority has documented why the gate does not apply. No requested gate was assumed N/A.

For every matrix entry, the evidence cell records path, date, environment, source commit and artifact hash where applicable. `Owner (unassigned)` identifies the accountable role proposed for assignment; it is not evidence that a person has accepted ownership.

# RELEASE EVIDENCE MATRIX

| Gate | Status | Evidence | Owner | Remaining Action |
|---|---|---|---|---|
| 1. Production migrations 0218–0224 | NOT VERIFIED | Source inventory only: `migration-source-manifest.json`; date 2026-10-02; environment local workspace; commit `9f5acee…` + dirty tree; manifest SHA-256 `6611DD55AF176D9D7DF17B16669011A272FFEF6FC256E37C5FD327F07FD12EC3`. No production migration ledger/schema query. | DBA/Release Manager (unassigned) | Apply through approved staging/production change, then export per-tenant migration ledger, schema checks and rollback/backup reference. |
| 2. Production configuration validation | NOT VERIFIED | Local unit evidence: `local-tests/results.json`; date 2026-10-02; environment local synthetic config; commit `9f5acee…` + dirty tree; SHA-256 `862910A8C59B6DDCEB26E28052106B6EB8B748ED9EE56A3BB85C04035FA02182`. No production startup/config attestation. | Platform Owner (unassigned) | Run fail-closed validator in production deployment using secret references; retain redacted pass output and deployment ID. |
| 3. ClamAV runtime evidence | NOT VERIFIED | Local adapter tests only in `local-tests/junit.xml`; date 2026-10-02; local mocked scanner; commit `9f5acee…` + dirty tree; SHA-256 `CF96A8CA679049019CFF7117829FCF7FFBC7FEDBF8AA9E20144B324801D62706`. | Platform/Security Operations (unassigned) | Capture service/version/health, clean file, approved EICAR rejection, timeout and unavailable/fail-closed results in staging and production. |
| 4. Private object-storage/IAM/KMS evidence | NOT VERIFIED | Local storage behavior tests only in `local-tests/junit.xml`; date 2026-10-02; mocked local environment; commit `9f5acee…` + dirty tree; no cloud artifact hash. | Cloud Security Owner (unassigned) | Supply bucket public-access block, encryption/KMS policy, IAM least privilege, lifecycle, access logging and cross-tenant negative test evidence. |
| 5. SIEM canary and alert acknowledgement | NOT VERIFIED | Local sink/retry tests only in `local-tests/junit.xml`; date 2026-10-02; mocked local environment; commit `9f5acee…` + dirty tree. No live canary/acknowledgement. | SOC/SecOps (unassigned) | Emit approved canary from deployed app; retain pseudonymized event, SIEM receipt, alert rule firing, ticket/page and on-call acknowledgement timestamps. |
| 6. Backup/restore exercise and measured RPO/RTO | NOT VERIFIED | Automation boundary tests only in `local-tests/junit.xml`; date 2026-10-02; local mock; commit `9f5acee…` + dirty tree. No backup or restore record. | DBA/BCDR Owner (unassigned) | Perform encrypted backup and isolated restore; retain manifest/checksums, start/end times, data timestamp, measured RPO/RTO and sign-off. |
| 7. GitHub Security CI results | NOT VERIFIED | Workflow definition `.github/workflows/security-ci.yml` and local policy tests; date 2026-10-02; local workspace; commit `9f5acee…` + dirty tree. No authoritative GitHub run URL/artifacts. | DevSecOps (unassigned) | Commit clean candidate, run required workflow on GitHub, retain run URL/ID, job conclusions and artifacts. |
| 8. CodeQL/Gitleaks/SCA results | FAIL | SCA files: `sca/bff-npm-audit.json` SHA-256 `665F643C6592576DA3791319929C4ADEF8C43836AE6AFD2F58AA0961CA7B2051`; `sca/mobile-npm-audit.json` SHA-256 `A02AB85B468B351667B7908CD5A20BBB210CE4C38D67B47CC5D8DE51DAC7B416`; date 2026-10-02; local dependency trees; commit `9f5acee…` + dirty tree. Backend: 1 critical/2 high/20 moderate. Mobile: 0 critical/4 high/9 moderate. No CodeQL/Gitleaks run evidence. | Application Security/Engineering (unassigned) | Remediate or formally disposition findings; rerun. Obtain clean/approved CodeQL and Gitleaks results from the candidate commit. |
| 9. CycloneDX SBOMs | NOT VERIFIED | Candidate BFF SBOM `sbom/bff-sbom.cdx.json`, SHA-256 `39074DE57C258CD0593C09AB412DBB015DB8A0F8306EECCF55A79C6F16EA891A`; mobile SBOM `sbom/mobile-sbom.cdx.json`, SHA-256 `D8A5DB82104F9D1BC46E8DA3EFD49F8AF1EAB2955E285A71276A773FEEC9B734`; generated 2026-10-02; local workspace; commit `9f5acee…` + dirty tree. | DevSecOps/Release Manager (unassigned) | Regenerate from clean release commit/build, attest, retain CI artifact and demonstrate component match to AAB/IPA/server deployment. |
| 10. Dependency-risk decisions | FAIL | Raw audits above show an unaccepted critical `fast-xml-parser` chain, high `drizzle-orm` and `xlsx`, plus high Expo/tooling chain; date 2026-10-02; local; commit `9f5acee…` + dirty tree. No signed risk acceptances. | Security Risk Owner/Product Owner (unassigned) | Upgrade/replace/remediate. If residual risk remains, document reachability, compensating controls, named approvers and expiry; Critical/High must be resolved or formally accepted before GO. |
| 11. MFA rollout evidence | NOT VERIFIED | MFA source and local tests in `local-tests/junit.xml`; date 2026-10-02; local synthetic environment; commit `9f5acee…` + dirty tree. No user enrollment/adoption/helpdesk evidence. | Identity/Product Operations (unassigned) | Run controlled pilot; record eligible/enrolled counts, recovery test, lost-factor process, lockout support and rollout approval without recording secrets. |
| 12. Privacy export/deletion/legal-hold exercise | NOT VERIFIED | Local privacy state/deletion tests in `local-tests/junit.xml`; date 2026-10-02; synthetic local environment; commit `9f5acee…` + dirty tree. No DPO-approved end-to-end exercise. | Privacy/DPO and Operations (unassigned) | Exercise export, deletion, ERP-retained data, legal hold, session revocation and completion notices with synthetic staging subject; obtain DPO/legal sign-off. |
| 13. Maritime network/offline test results | NOT VERIFIED | Harness and scenarios exist under `tests/performance/`; no executed result artifact; date not available; target environment not supplied; commit `9f5acee…` + dirty tree. | Mobile QA (unassigned) | Run all latency/bandwidth/loss/disconnect scenarios against authorized staging on physical devices; retain latency, failures, replay/idempotency and reconciliation results. |
| 14. Signed Android AAB | NOT VERIFIED | No `.aab` located or supplied; no build ID/date/hash; environment/build service unknown; commit/artifact linkage unavailable. | Android Release Manager (unassigned) | Produce store-profile AAB with organization signing credentials after clean candidate commit; retain EAS build ID and immutable download record. |
| 15. Signed iOS IPA/archive | NOT VERIFIED | No `.ipa`/`.xcarchive` located or supplied; no build ID/date/hash; environment/build service unknown; commit/artifact linkage unavailable. | iOS Release Manager (unassigned) | Produce distribution IPA/archive with organization Apple credentials; retain EAS/build/archive ID and immutable record. |
| 16. Artifact SHA-256 hashes | NOT VERIFIED | No AAB/IPA, therefore no release artifact hashes. Candidate SBOM/audit hashes are listed separately and are not app-binary hashes. | Release Manager (unassigned) | Hash final AAB/IPA, signing inspection outputs, SBOMs and reports; create immutable evidence manifest tied to release commit. |
| 17. Signing certificate/team identity | NOT VERIFIED | No Android certificate fingerprint, Play signing lineage, Apple Team ID, distribution certificate or provisioning profile evidence. Date/environment/commit/hash unavailable. | Mobile Release Security Custodian (unassigned) | Record Android upload/app-signing SHA-256 fingerprints and Apple Team/certificate/profile identity; independently compare with stores. |
| 18. Android manifest inspection | NOT VERIFIED | Source manifest validator passed locally in `local-tests/results.json`; no generated manifest extracted from signed AAB. Date 2026-10-02; local source; commit `9f5acee…` + dirty tree. | Android QA/AppSec (unassigned) | Inspect signed AAB/bundletool manifest for target API 36, backup, cleartext, debuggable, exported components and permissions; retain output and AAB hash. |
| 19. iOS plist/entitlements/privacy manifest inspection | NOT VERIFIED | Source config contains file-protection setting; no signed IPA plist, entitlements, provisioning profile or `PrivacyInfo.xcprivacy` extraction. Date 2026-10-02; local source; commit `9f5acee…` + dirty tree. | iOS QA/AppSec (unassigned) | Extract signed IPA; inspect plist, entitlements, data protection, URL schemes, ATS, Team ID and privacy manifests; retain outputs and IPA hash. |
| 20. Physical-device QA | NOT VERIFIED | No signed-build Android/iOS device test record. Environment/devices/build IDs/hashes unavailable. | QA Lead (unassigned) | Test exact signed artifacts on supported physical devices for auth/MFA, offline, uploads, privacy, screenshots, accessibility, crash and upgrade paths. |
| 21. Independent VAPT report | NOT VERIFIED | Preparation templates under `docs/security/vapt-*.md`; no independent assessor report, date, signed scope or tested artifact hashes. | Independent Assessor/Application Security (unassigned) | Authorize independent supplier and obtain signed report against exact release candidate and two-tenant environment. |
| 22. Independent VAPT retest closure | NOT VERIFIED | No independent findings register or retest letter. Date/environment/commit/artifact hash unavailable. | Independent Assessor/Security Owner (unassigned) | Remediate findings; obtain independent retest showing zero open Critical/High and explicit artifact hashes/limitations. |
| 23. Google Data Safety | NOT VERIFIED | Draft/precheck documentation only; no Play Console export/screenshot or approved declaration. No artifact/store match. | Privacy Owner/Google Play Admin (unassigned) | Complete against final SBOM/data inventory and runtime behavior; approve and export evidence from Play Console. |
| 24. Apple App Privacy | NOT VERIFIED | Draft/precheck documentation only; no App Store Connect export/screenshot or approved nutrition labels. No artifact/store match. | Privacy Owner/App Store Connect Admin (unassigned) | Complete against final SDK/data inventory and runtime behavior; approve and export App Store Connect evidence. |
| 25. Privacy policy URL | NOT VERIFIED | No reachable production privacy-policy URL supplied or HTTP/content capture. Date/owner/environment unavailable. | Privacy/Legal (unassigned) | Publish approved policy over HTTPS, verify availability/content/version/date and link it in both stores and app where required. |
| 26. Deletion/support URL | NOT VERIFIED | In-app request implementation exists; no public deletion/support URL or store-console verification supplied. | Privacy/Support/Product (unassigned) | Publish and test required deletion/support route, processing timelines and contact; ensure store entries and app flow agree. |
| 27. Reviewer credentials readiness | NOT VERIFIED | No reviewer account inventory, expiry, MFA/recovery instructions or successful clean-device login record. Credentials must not be stored in this pack. | Release Manager/Support (unassigned) | Provision least-privilege synthetic reviewer accounts via approved secret channel; test and document access instructions/expiry. |
| 28. Rollback plan | NOT VERIFIED | Incident/DR runbooks exist, but no release-specific rollback plan tied to database migrations, server deployment and mobile staged rollout; no approval/date. | Release/Operations/DBA (unassigned) | Define triggers, owners, server rollback, forward-only DB recovery, worker disable, store halt and communications; tabletop and approve. |
| 29. Incident/on-call ownership | NOT VERIFIED | Generic incident runbook exists; no dated roster, escalation contacts, acknowledgement test or launch coverage schedule. | Security Operations/Service Owner (unassigned) | Assign named primary/backup on-call, escalation matrix and launch window; conduct paging exercise and retain acknowledgement. |
| 30. Product/security/privacy/operations/business approvals | NOT VERIFIED | No signed approvals or authority records supplied. Date/environment/commit/artifact hashes unavailable. | Respective accountable executives (unassigned) | Obtain approvals only after all mandatory technical/operational/store gates are PASS and exact artifact hashes are fixed. |

# ARTIFACT INTEGRITY MATRIX

| Artifact | Build ID | Commit SHA | SHA-256 | Signing Identity | VAPT Match | Store Match |
|---|---|---|---|---|---|---|
| Android production AAB | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| iOS production IPA/archive | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| BFF CycloneDX candidate SBOM | Local generation 2026-10-02 | `9f5acee…` + dirty tree | `39074DE57C258CD0593C09AB412DBB015DB8A0F8306EECCF55A79C6F16EA891A` | NOT APPLICABLE | NOT VERIFIED | NOT VERIFIED |
| Mobile CycloneDX candidate SBOM | Local generation 2026-10-02 | `9f5acee…` + dirty tree | `D8A5DB82104F9D1BC46E8DA3EFD49F8AF1EAB2955E285A71276A773FEEC9B734` | NOT APPLICABLE | NOT VERIFIED | NOT VERIFIED |
| Backend npm audit JSON | Local registry query 2026-10-02 | `9f5acee…` + dirty tree | `665F643C6592576DA3791319929C4ADEF8C43836AE6AFD2F58AA0961CA7B2051` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Mobile npm audit JSON | Local registry query 2026-10-02 | `9f5acee…` + dirty tree | `A02AB85B468B351667B7908CD5A20BBB210CE4C38D67B47CC5D8DE51DAC7B416` | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |

# OPEN RISK REGISTER

| Risk | Severity | Owner | Accepted? | Expiry/Review Date |
|---|---|---|---|---|
| `fast-xml-parser` critical advisory chain through AWS SDK (`GHSA-m7jm-9gc2-mpf2` and related entity-expansion/parser advisories) | Critical | Engineering/AppSec (unassigned) | No | Immediate; blocks GO |
| `drizzle-orm` SQL identifier injection advisory `GHSA-gpj5-g38j-94v9` | High | Backend Engineering (unassigned) | No | Immediate; blocks GO |
| `xlsx` prototype-pollution/ReDoS advisories `GHSA-4r6h-8v6p-xvw6`, `GHSA-5pgg-2g8v-p4x9` with no npm fix | High | Product/Engineering/AppSec (unassigned) | No | Immediate; replace, isolate or formally decide before GO |
| Expo/node-forge mobile transitive vulnerability chain (4 high, 9 moderate total mobile findings) | High | Mobile Engineering/AppSec (unassigned) | No | Before release-candidate freeze |
| Current evidence is based on a dirty workspace with 121 changed/untracked paths, not an immutable release commit | High | Release Manager (unassigned) | No | Before CI/build/VAPT |
| Production migrations, scanner, storage, SIEM and restore have no runtime evidence | High | Platform/Operations (unassigned) | No | Before production readiness review |
| No signed AAB/IPA or artifact-to-VAPT/store hash chain | High | Mobile Release Manager (unassigned) | No | Before VAPT/store submission |
| No independent VAPT/retest closure | High | Security Owner (unassigned) | No | Before formal go-live approval |
| Repository-wide legacy TypeScript baseline is not clean | Medium | Engineering (unassigned) | No decision recorded | Review before next readiness board |
| Privacy/store declarations and URLs lack authority evidence | High | Privacy/Legal/Store Admin (unassigned) | No | Before store submission |
| No named launch on-call, rollback rehearsal or multi-function approval | High | Operations/Business Owner (unassigned) | No | Before staged rollout |

# GO/NO-GO CHECKLIST

Every requested gate is treated as mandatory unless the corresponding accountable authority documents `NOT APPLICABLE`. Every mandatory gate must be `PASS` before GO.

- `[ ]` 1. Production migrations 0218–0224 — NOT VERIFIED
- `[ ]` 2. Production configuration validation — NOT VERIFIED
- `[ ]` 3. ClamAV runtime — NOT VERIFIED
- `[ ]` 4. Private object storage/IAM/KMS — NOT VERIFIED
- `[ ]` 5. SIEM canary and acknowledgement — NOT VERIFIED
- `[ ]` 6. Backup/restore and RPO/RTO — NOT VERIFIED
- `[ ]` 7. GitHub Security CI — NOT VERIFIED
- `[ ]` 8. CodeQL/Gitleaks/SCA — FAIL
- `[ ]` 9. Release-matched CycloneDX SBOMs — NOT VERIFIED
- `[ ]` 10. Dependency-risk decisions — FAIL
- `[ ]` 11. MFA rollout — NOT VERIFIED
- `[ ]` 12. Privacy exercise — NOT VERIFIED
- `[ ]` 13. Maritime/offline testing — NOT VERIFIED
- `[ ]` 14. Signed Android AAB — NOT VERIFIED
- `[ ]` 15. Signed iOS IPA/archive — NOT VERIFIED
- `[ ]` 16. Artifact SHA-256 hashes — NOT VERIFIED
- `[ ]` 17. Signing identity — NOT VERIFIED
- `[ ]` 18. Generated Android manifest — NOT VERIFIED
- `[ ]` 19. iOS plist/entitlements/privacy manifest — NOT VERIFIED
- `[ ]` 20. Physical-device QA — NOT VERIFIED
- `[ ]` 21. Independent VAPT — NOT VERIFIED
- `[ ]` 22. Independent VAPT retest — NOT VERIFIED
- `[ ]` 23. Google Data Safety — NOT VERIFIED
- `[ ]` 24. Apple App Privacy — NOT VERIFIED
- `[ ]` 25. Privacy policy URL — NOT VERIFIED
- `[ ]` 26. Deletion/support URL — NOT VERIFIED
- `[ ]` 27. Reviewer credentials — NOT VERIFIED
- `[ ]` 28. Rollback plan — NOT VERIFIED
- `[ ]` 29. Incident/on-call ownership — NOT VERIFIED
- `[ ]` 30. Cross-functional approvals — NOT VERIFIED

## FINAL DECISION

At least one mandatory gate is `FAIL`, and multiple mandatory gates are `NOT VERIFIED`.

**Final Decision = NO-GO**

This pack does not declare legal, maritime, store, production-operations or independent security approval. Reissue the matrix from a clean immutable release commit after authoritative evidence is supplied. The decision may become `READY FOR FORMAL GO-LIVE APPROVAL` only when all mandatory gates are `PASS` (or authoritatively `NOT APPLICABLE`) and no unaccepted Critical/High finding remains.

