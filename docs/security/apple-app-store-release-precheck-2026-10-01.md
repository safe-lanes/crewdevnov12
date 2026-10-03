# Apple App Store Release Precheck — SAIL Crew Mobile

Audit date: 2026-10-01

## Decision

**APPLE STORE SCORE: 4/10**

**STATUS: NOT READY**

This is a source/configuration precheck. No signed IPA/archive, Xcode build log, privacy report, signing profile, App Store Connect record, TestFlight build, or review result was available. Those items are **NOT VERIFIED**.

## Current official requirements checked

- Since 28 April 2026, App Store Connect uploads must be built with Xcode 26 or later using the iOS 26/iPadOS 26 SDK or later. Source: [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/?id=02032026a).
- Required-reason API use must be represented with approved reasons in valid privacy manifests; missing required reasons can block uploads. Source: [Apple required-reason API guidance](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).
- App Store Connect requires accurate App Privacy answers covering the app and third-party partners, plus a privacy-policy URL. Source: [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).
- Apps supporting account creation must allow users to initiate account deletion in the app; legally required retention may remain if transparently explained. Source: [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

## iOS configuration review

| Item | Evidence | Result |
|---|---|---|
| App name | Generated Expo public config: `SAIL Crew` | Confirmed |
| Bundle identifier | `com.sail.crewapp` | Source confirmed; IPA NOT VERIFIED |
| Marketing version | `1.0.0` | Source confirmed |
| Build number | `1.0.0` | Source confirmed; submitted value NOT VERIFIED |
| iPad support | Enabled | Confirmed in Expo source |
| Data protection | `com.apple.developer.default-data-protection=NSFileProtectionComplete` | Source confirmed; signed entitlement NOT VERIFIED |
| Xcode version | No build log/archive | **BLOCKER / NOT VERIFIED** |
| iOS SDK | No archive metadata | **BLOCKER / NOT VERIFIED** |
| Minimum iOS version | Not explicit in source output | NOT VERIFIED |
| Production API | Placeholder production origin in EAS | **BLOCKER** |
| Signing identity/profile | No signed archive | **BLOCKER / NOT VERIFIED** |
| Bitcode/export method/symbols | No archive/export evidence | NOT VERIFIED |

The Expo public configuration resolved successfully. It does not prove final Info.plist values, merged entitlements, linked SDKs, privacy manifests, deployment target, or signing.

## Info.plist and permission review

| Capability/key | Source behavior | Draft result | Final IPA check |
|---|---|---|---|
| Photo library | `expo-image-picker` asks only when user selects an image; purpose text describes crew photo/attachment selection | Purpose appears specific and user initiated | Verify `NSPhotoLibraryUsageDescription` text and limited-library behavior |
| Camera | Camera permission disabled; no camera capture found | Should be absent | Verify `NSCameraUsageDescription` absent unless functionality changes |
| Microphone | Microphone permission disabled; no audio capture found | Should be absent | Verify `NSMicrophoneUsageDescription` absent |
| Face ID | SecureStore plugin contains Face ID purpose text, but current SecureStore calls do not request biometric authentication | Potential unused declaration; review generated plist | Remove if generated and unused, or implement/document step-up before use |
| Location | No location package/API found | Should be absent | Verify all location usage descriptions absent |
| Notifications | In-app BFF alerts only; no APNs/push SDK found | Push entitlement/usage should be absent | Verify `aps-environment` absent |
| Tracking/ATT | No ads, analytics, tracking SDK, or ATT call found | `NSUserTrackingUsageDescription` should be absent | Verify no tracking domains or IDFA linkage |
| Contacts/calendars/Bluetooth | No use found | Should be absent | Verify usage descriptions absent |
| Document picker | User explicitly chooses a PDF/image | Appropriate app functionality | Verify document-provider entitlements and file-sharing settings are minimal |
| File sharing/open-in-place | App uses cache and system share sheet for a selected attachment | Review data leakage implications | Verify `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` are not enabled unintentionally |
| ATS | Runtime production config rejects non-HTTPS | No exception configured in source | Verify `NSAppTransportSecurity`; reject arbitrary loads/domain exceptions unless approved |
| URL schemes/deep links | No custom scheme or associated domain found | No exposed deep-link surface currently | Verify final `CFBundleURLTypes` and associated-domain entitlement |
| Background modes | No background task/location/audio found | Should be absent | Verify `UIBackgroundModes` absent |

## Entitlements review

Source declares only complete default data protection. No push, associated domains, iCloud, keychain access group, Sign in with Apple, HealthKit, background processing, or app-group entitlement was found in Expo configuration.

Final signed entitlements remain **NOT VERIFIED**. Inspect both the embedded provisioning profile and code signature, and compare them with the app’s actual use. Unexpected entitlements are release blockers.

## Privacy manifest review

- No app-level `ios.privacyManifests` declaration exists in `mobile/app.json`.
- No `PrivacyInfo.xcprivacy` file was found by repository/dependency source inspection.
- Expo can generate/merge privacy-manifest configuration, but none is currently supplied by this app.
- React Native/Expo/native dependencies may use required-reason APIs such as user defaults or file metadata. Exact categories and approved reason codes must be derived from the final native build and Xcode privacy report, not guessed.
- No tracking SDK or tracking domain was found in source; tracking should be declared false unless final binary/network analysis proves otherwise.

Required actions:

1. Generate the iOS project/archive using the release dependency lockfile and Xcode 26+.
2. Produce the Xcode privacy report and enumerate every app/SDK privacy manifest.
3. Attribute every required-reason API category to app or SDK functionality and use only Apple-approved reasons that match actual behavior.
4. Add an app privacy manifest where required and validate the final archive/IPA copy.
5. Compare manifest declarations, App Store Connect answers, privacy policy, and observed network traffic.

Privacy-manifest compliance is currently **NOT VERIFIED** and is a release blocker.

## Draft App Privacy mapping

This draft describes current source behavior. “Linked” means associated with the crew account/record. “Tracking: No” assumes no cross-company tracking or targeted advertising; confirm through final SDK and traffic review.

| Apple data type | Collected | Linked | Tracking | Purpose |
|---|---|---|---|---|
| Contact Info — Name | Yes | Yes | No | App Functionality |
| Contact Info — Email Address | Yes | Yes | No | App Functionality |
| Contact Info — Phone Number | Yes | Yes | No | App Functionality |
| Contact Info — Physical Address | Yes | Yes | No | App Functionality |
| Health & Fitness — Health | Yes: medical and doctor-visit information/documents | Yes | No | App Functionality |
| Identifiers — User ID | Yes: crew UUID, employee/login identifier | Yes | No | App Functionality |
| Identifiers — Device ID | Yes: app-generated UUID used for session binding | Yes | No | App Functionality / security |
| User Content — Photos or Videos | Yes: user-selected images | Yes | No | App Functionality |
| User Content — Other User Content | Yes: selected PDFs and attachments | Yes | No | App Functionality |
| Sensitive Info | Likely: government/travel identity and maritime employment data | Yes | No | App Functionality |
| Other Data | Potentially: certificates, licenses, training, sea service, family/next-of-kin | Yes | No | App Functionality |
| Usage Data — Product Interaction | Security/operation/audit activity is sent to the BFF | Yes | No | App Functionality / fraud prevention/security |
| Diagnostics | No crash/diagnostic SDK found | — | No | — |
| Purchases/Financial/Location/Contacts/Search/Browsing | No collection found in current mobile source | — | No | — |

Legal and App Store owners must map passport/government identifiers and employment records to Apple’s current questionnaire options. Hosting, malware scanning, monitoring, support, email, and any future analytics/crash providers must be included where Apple considers them third-party partners.

## Account deletion, privacy policy, and review access

- The app has a discoverable in-app Privacy Requests screen with deletion-review initiation and request-status tracking.
- It states that employment/maritime records may require retention and does not falsely claim immediate deletion.
- The current label is “Request deletion review,” not an explicit whole-account deletion explanation. Product/legal review must confirm whether this meets Apple’s account-deletion requirement for administratively provisioned accounts.
- The app does not give a completion timeframe or describe which account/data elements will be removed versus legally retained.
- No in-app privacy-policy link or approved public privacy-policy URL was found.
- No support URL, marketing URL, review contact, demo account, or reviewer instructions were provided.
- No Sign in with Apple or in-app purchases were found.

## Blockers

1. Replace the placeholder production API origin with the approved HTTPS BFF endpoint.
2. Produce a release archive/IPA using Xcode 26+ and the iOS 26 SDK or later, with reproducible build evidence.
3. Verify signing certificate, provisioning profile, bundle/build identity, deployment target, embedded entitlements, Info.plist, ATS, URL schemes, background modes, and architectures from the signed IPA.
4. Generate and remediate the Xcode privacy report and final privacy manifests, including required-reason APIs and SDK signatures.
5. Publish an approved privacy-policy URL, link it inside the app, and complete App Store Connect App Privacy answers from final behavior.
6. Confirm or revise the in-app flow so it clearly initiates account deletion when Apple’s rule applies, while explaining lawful retention and completion timing.
7. Supply support URL/details, reviewer contact, stable demo account/environment, review notes, screenshots, descriptions, categories, and updated age-rating answers.
8. Complete TestFlight/release-device testing and broader security blockers: scanner, ERP reconciliation, infrastructure/IAM, DR exercise, alert delivery, and independent VAPT.

## App Store Connect items — NOT VERIFIED

- Apple Developer account/team, agreements, tax/banking status, and bundle-ID ownership.
- Certificates, profiles, signing identity, TestFlight processing, and export compliance.
- App Privacy answers, privacy-policy URL, and optional privacy-choices URL.
- Updated age-rating questionnaire required under the 2026 rating system.
- App Review contact, notes, credentials, and accessible demo environment.
- Support/marketing URLs, localized metadata, screenshots, category, copyright, pricing, territories, and release method.
- TestFlight feedback, crash diagnostics, App Store validation warnings, review outcome, and phased release.

## Final IPA/archive verification checklist

- Record archive/IPA SHA-256, CI run, source commit, lockfiles, SBOM, Xcode/SDK versions, build/export method, and signing fingerprints.
- Inspect effective Info.plist, embedded provisioning profile, signed entitlements, bundle ID/version/build, deployment target, supported devices/orientations, architectures, and debug flags.
- Confirm production HTTPS origin only; search for placeholders, localhost, test credentials, JWT/database/ERP secrets, and development menus.
- Verify permission descriptions and absence of camera, microphone, location, tracking, contacts, push, background, file-sharing, and custom URL capabilities unless explicitly implemented and declared.
- Extract all `PrivacyInfo.xcprivacy` files, validate them, generate the Xcode privacy report, and reconcile required-reason APIs and collected-data declarations.
- Inspect third-party SDK signatures and compare the final SDK inventory with Apple’s applicable SDK requirements.
- Install the release-equivalent build on supported iPhone and iPad devices; test upgrade, login/revocation, privacy requests, attachment selection/share/cache cleanup, offline ambiguity, and protected-data behavior while locked.
- Observe release network traffic and compare all destinations/data with App Privacy answers and the public privacy policy.

## Clearance conditions

The status may move to **READY WITH CONDITIONS** only after blockers 1–7 have evidence and the signed IPA matches all declarations. App Store approval remains Apple’s decision and cannot be guaranteed by source review.
