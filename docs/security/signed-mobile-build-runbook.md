# Signed Android and iOS release build runbook

**Status:** Build procedure, not evidence that signed artifacts exist. A release is incomplete until the evidence table is populated with independently verified outputs.

## Ownership and secret boundary

- Use the organization-owned Expo account and least-privilege project roles. Do not use a personal project for release builds.
- Production uses EAS-managed remote credentials. Google upload keys, Apple distribution certificates, provisioning profiles, passwords, App Store Connect keys and Expo tokens must never be committed, copied into `.env`, attached to tickets or printed in build logs.
- The root `.env` is only for local non-secret configuration. It must define `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PROJECT_ID` for local preflight. Configure the same public values in the EAS `production` environment; `.env` is ignored and is not the remote secret store.
- Treat every `EXPO_PUBLIC_*` value as public because it is embedded in the client.

## One-time project and credential setup

1. An Expo organization owner creates or links the project with `eas init` from `mobile/`. Record the resulting project UUID as `EXPO_PROJECT_ID` locally and in the EAS production environment.
2. Set `EXPO_PUBLIC_API_BASE_URL` to the final production HTTPS BFF origin in root `.env` and the EAS production environment. The origin must not route to a developer, preview or generic ERP endpoint.
3. Confirm Android package `com.sail.crewapp` and iOS bundle identifier `com.sail.crewapp` are owned by SAIL and have never been assigned to another product.
4. Run `eas credentials` for each platform using the organization account. Generate or upload the Android upload key and Apple distribution/provisioning credentials through the interactive credential channel. Record custodians, certificate fingerprints and recovery/rotation ownership—never private-key material.
5. Enable Google Play App Signing. Restrict the upload key to the release operators and retain a separately protected recovery copy if organizational policy requires one.

## Pre-build gates

From the repository root:

```text
npm ci
npm run check:mobile-release
npm run check:mobile-manifest
npm run build
cd mobile
npm ci
npm run typecheck
npm test -- --ci
npx expo-doctor
```

The preflight intentionally fails while either required environment value is absent. Resolve every error; do not bypass the script or replace production values with preview endpoints.

## Build

Run from `mobile/` after authenticating with the organization Expo account:

```text
eas build --platform android --profile production --non-interactive
eas build --platform ios --profile production --non-interactive
```

Record the EAS build IDs, immutable build pages, source commit, builder images and timestamps. Download the `.aab` and `.ipa` into an access-controlled release workspace outside Git.

## Verification

1. Run `npm run verify:mobile-artifacts -- <path-to-aab> <path-to-ipa>` and preserve its JSON output.
2. Generate the assessment/release manifest: `npm run vapt:evidence-manifest -- --assessment-id RELEASE-YYYY-NNN --output release-manifest.json <aab> <ipa> <SBOMs> <reports>`.
3. Android: run `jarsigner -verify -strict -verbose <aab>` and `keytool -printcert -jarfile <aab>`. Compare the upload-certificate SHA-256 fingerprint with the approved credential register and Play Console.
4. Android: use `bundletool` to validate the bundle and create a universal test APK; install through an authorized internal track and verify package, version code, release signing lineage, `debuggable=false`, backup disabled, permissions and cleartext disabled.
5. iOS on macOS: extract the IPA, run `codesign --verify --deep --strict --verbose=2 Payload/*.app`, inspect `codesign -d --entitlements :- Payload/*.app`, provisioning profile, bundle ID, build number, distribution team and data-protection entitlement.
6. Install both release candidates on physical devices. Repeat login/MFA, logout-all, screenshot protection, upload, offline replay, privacy request and tenant-isolation smoke tests against production-like staging.
7. Supply these exact hashes to the independent VAPT assessor. Any rebuild invalidates previous binary test evidence unless the assessor explicitly accepts and verifies the delta.

## Artifact evidence

| Evidence | Android | iOS |
|---|---|---|
| Build ID / source SHA | `[required]` | `[required]` |
| Artifact filename / SHA-256 | `[required]` | `[required]` |
| Package or bundle ID / version | `[required]` | `[required]` |
| Signing certificate/team fingerprint | `[required]` | `[required]` |
| Signature verification output | `[required]` | `[required]` |
| Manifest/plist/entitlements inspection | `[required]` | `[required]` |
| Physical-device test record | `[required]` | `[required]` |
| Independent VAPT report/retest | `[required]` | `[required]` |

Release approval requires matching hashes across build, VAPT, evidence manifest and store upload. Keep the first Play submission in draft/internal testing and do not use automatic production rollout.

