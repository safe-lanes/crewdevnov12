# Google Play Release Precheck — SAIL Crew Mobile

Audit date: 2026-10-01

## Decision

**GOOGLE PLAY SCORE: 4/10**

**STATUS: NOT READY**

This is a source/configuration precheck, not Play approval. No signed AAB, Play Console application, signing certificate, production endpoint, public policy pages, or console declarations were available. Those items are **NOT VERIFIED**.

## Current official requirements checked

- From 31 August 2026, Google Play requires new mobile apps and app updates to target Android 16/API 36 or higher. Source: [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
- All published apps must complete an accurate Data Safety form reflecting first-party and third-party SDK behavior. Source: [Google Play Data Safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-EN).
- Apps handling personal and sensitive data require a comprehensive public privacy policy and secure handling. Source: [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB).
- If an app permits account creation, it must provide in-app and external account/data-deletion request paths; retained data must be disclosed. Source: [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

## Configuration and artifact review

| Item | Evidence | Result |
|---|---|---|
| App name | Generated Expo public config: `SAIL Crew` | Confirmed |
| Package ID | `com.sail.crewapp` | Confirmed in Expo config; final AAB NOT VERIFIED |
| Version | `1.0.0` | Confirmed in Expo config |
| Version code | `1` with EAS production auto-increment | Source confirmed; final value NOT VERIFIED |
| Expo SDK | 57.0.0 | Confirmed |
| Target SDK | React Native dependency default is API 36 | Source dependency evidence only; final AAB value NOT VERIFIED |
| Compile SDK | React Native dependency default is API 36 | Source dependency evidence only; generated build NOT VERIFIED |
| Minimum SDK | React Native dependency default is API 24 | Source dependency evidence only; final manifest NOT VERIFIED |
| API 36 store rule | Required as of audit date | Cannot clear without signed AAB inspection |
| Backup | `android.allowBackup=false`; SecureStore backup configuration present | Source confirmed; generated manifest/AAB NOT VERIFIED |
| Production API | `https://REPLACE_WITH_PRODUCTION_API_ORIGIN` | **BLOCKER — placeholder** |
| Cleartext traffic | Runtime production URL validation rejects HTTP | Network security config and final manifest NOT VERIFIED |
| Release signing | No signed AAB supplied | **BLOCKER / NOT VERIFIED** |
| Play App Signing | Requires Play Console | NOT VERIFIED |
| Developer/package verification | Requires Play Console | NOT VERIFIED |

The local Expo public configuration command completed successfully. A disposable Android prebuild was attempted outside the repository, but Expo dependency resolution did not accept the temporary dependency junction; no native manifest was produced and no repository files were changed. Native manifest findings are therefore not claimed.

## Permission review

| Capability | Source behavior | Draft assessment | Final verification |
|---|---|---|---|
| Internet | App communicates with the BFF | Necessary | Confirm generated manifest/AAB |
| Photos/media | User explicitly selects an attachment through `expo-image-picker` | Necessary, user initiated; explain document/profile purpose | Confirm Android version-specific photo permissions |
| Document picker | User explicitly selects PDF/image through system picker | Necessary; broad storage access should not be requested | Confirm no `MANAGE_EXTERNAL_STORAGE` |
| Camera | Expo image-picker camera permission disabled | Not used | Confirm absent from merged manifest |
| Microphone/audio | Explicitly disabled | Not used | Confirm `RECORD_AUDIO` absent |
| Location | No location package/API found | Not used | Confirm fine/coarse/background location absent |
| Notifications | In-app notifications retrieved from BFF; no push-notification SDK found | Native notification permission apparently unnecessary | Confirm absent unless push is later added |
| Foreground service | No use found | Not required | Confirm no foreground-service permissions/types |
| Contacts/SMS/call log | No use found | Not required | Confirm absent |
| All-files access | No use found | Must remain absent | Confirm absent |
| Biometrics | No local-auth dependency currently present | Not used | Reassess if step-up is added |

Any permission appearing in the merged release manifest but absent from this table requires dependency attribution, necessity review, Data Safety/privacy review, and removal or approval before submission.

## Draft Play Data Safety mapping

This is a draft derived from shipped source behavior. Legal, infrastructure, tenant-contract, SDK, and Play Console review are still required.

| Google data category | Collected/transmitted | Shared | Purpose | Required/optional | Transit encryption | Deletion |
|---|---|---|---|---|---|---|
| Personal info — name | Yes | No third-party sharing found in source | Crew identity/app functionality | Required for service/employment record | Conditional on final HTTPS endpoint; NOT VERIFIED | Request workflow exists; completion/retention subject to review |
| Personal info — email, phone, address | Yes | No third-party sharing found | Crew contact/app functionality | Record may be required; editing is user initiated | Conditional; NOT VERIFIED | Same |
| Personal info — user IDs | Yes: crew UUID, employee/login identifier | No third-party sharing found | Authentication, account management, security | Required | Conditional; NOT VERIFIED | Credential/data request process requires policy decision |
| Personal info — other sensitive identity | Yes: DOB, nationality, gender, birth place | No third-party sharing found | Maritime/employment record | Generally required by employer workflow | Conditional; NOT VERIFIED | May be legally retained; disclose accurately |
| Health and fitness — health information | Yes: medical/doctor-visit records and documents | No third-party sharing found | Fitness-for-duty/app functionality | Business-required where applicable | Conditional; NOT VERIFIED | Legal/maritime retention decision required |
| Files and docs | Yes: passport, visa, licenses, certificates, PDFs | No third-party sharing found | Compliance and crew-record evidence | Upload optional per interaction; record may be required | Conditional; NOT VERIFIED | Request workflow exists; authoritative retention unresolved |
| Photos and videos — photos | Yes when user selects an image | No third-party sharing found | Profile/document evidence | Optional selection | Conditional; NOT VERIFIED | Same |
| App activity — app interactions | Security/audit metadata and operation activity | No third-party sharing found | Security, fraud prevention, app functionality | Automatic when service is used | Conditional; NOT VERIFIED | Retention duration NEEDS APPROVAL |
| Device or other IDs | Random app device ID used for refresh-token/device binding | No third-party sharing found | Security/account management | Automatic | Conditional; NOT VERIFIED | Revoked with session; retention policy NEEDS APPROVAL |
| Authentication information | Password submitted to BFF; tokens/session records | No third-party sharing found | Authentication and security | Required | Conditional; NOT VERIFIED | Password stored only as hash server-side; session deletion/revocation supported |

“Not shared” here means no third-party data transfer was found in the current source dependencies and API flows. It is not a legal conclusion. Hosting, support, scanner, email, monitoring, and future crash/analytics providers must be reviewed under Google’s sharing/service-provider definitions before console submission.

## Privacy, deletion, and support review

- In-app access/export/correction/deletion request initiation and status tracking exists.
- The app correctly warns that maritime/employment records may require retention and does not claim immediate deletion.
- No public external account/data-deletion request URL is configured.
- No in-app privacy-policy link was found.
- No publicly accessible privacy-policy URL or support URL was provided.
- No approved retention schedule, legal basis mapping, or completed deletion workflow was evidenced.
- Account creation appears administratively provisioned rather than offered in-app, but the exact Play account-deletion applicability and console answers require product/legal confirmation. Data deletion questions still require accurate completion.

## Blockers

1. Replace the production API placeholder with the approved HTTPS BFF origin and pass `npm run check:mobile-release`.
2. Produce the final signed AAB and verify target/compile/min SDK, package/version, signing certificate, manifest, network-security config, backup behavior, exported components, and all permissions from the artifact.
3. Provide a compliant public privacy-policy URL and an in-app privacy-policy link covering SAIL Crew, developer identity/contact mechanism, sensitive data, recipients, security, retention, and deletion.
4. Provide an external account/data-deletion request page if required and enter it in Play Console; confirm the in-app flow and retained-record disclosures with legal/product owners.
5. Complete and review the Play Data Safety form from the final binary, SDK inventory, production infrastructure, and approved policies.
6. Configure release signing/Play App Signing and verify custody, rotation, recovery, and package ownership.
7. Complete Play Console content rating, app access/reviewer instructions, support details, store listing, target audience, and pre-launch report review.
8. Resolve broader release blockers: production malware scanner, safe ERP reconciliation worker, runtime storage/IAM, backup/DR exercise, monitoring delivery, and independent VAPT.

## Play Console items — NOT VERIFIED

- Developer identity and package-name registration.
- App ownership, Play App Signing, upload key, and signing lineage.
- Data Safety submission and review.
- Privacy policy, deletion URL, and support contacts.
- App access instructions/test account and reviewer environment.
- Content rating and target audience.
- Ads declaration, government/health declarations where applicable, and policy status.
- Store listing text, screenshots, icon/feature graphic, countries, pricing, and distribution tracks.
- Pre-launch report, automated device testing, vitals, and review outcome.

## Final AAB verification checklist

- Record AAB SHA-256, build provenance, CI run, source commit, SBOM, and signing certificate fingerprints.
- Use bundle tooling/Play artifact explorer to verify effective target SDK 36 or higher, compile/min SDK, package ID, version code/name, supported ABIs, and debuggable/test-only flags.
- Inspect merged manifest permissions, features, exported activities/services/receivers/providers, intent filters, task behavior, backup/data-extraction rules, cleartext policy, and network security config.
- Confirm camera, microphone, location, contacts, SMS/call-log, broad storage, foreground service, advertising ID, and exact-alarm permissions are absent unless explicitly justified and declared.
- Confirm only the production HTTPS BFF origin is embedded; search the artifact for placeholders, localhost, test credentials, signing secrets, database URLs, and ERP credentials.
- Install the Play-delivered artifact on supported Android versions and test login, token revocation, profile, privacy requests, attachment selection/upload/download, offline ambiguity, and upgrade behavior.
- Compare observed network traffic and SDK behavior with the final Data Safety form and privacy policy.

## Clearance conditions

The status may move to **READY WITH CONDITIONS** only after blockers 1–7 have objective evidence and the final AAB matches the declarations. Google Play approval itself remains a Play Console decision and cannot be guaranteed by source review.
