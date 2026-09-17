# Crew Mobile Release Certification

**Date:** 17 September 2026  
**Environment:** Replit development plus disposable local PostgreSQL databases  
**Production data:** Not accessed or modified  
**Decision:** **NO-GO**

The mobile release cannot be approved yet. Crew-specific security, tenancy,
migrations, API journeys, platform bundles, and representative visual checks
passed after two release defects were corrected. The broader regression
baseline, physical-device acceptance, native binary builds, and controlled
email-delivery evidence are not complete.

## Release blockers

1. **The repository regression baseline is not green.**
   - Full unit and integration run: 938 tests total, 602 passed, 57 failed,
     279 pending; 263 of 330 suites passed and 67 failed.
   - Root TypeScript check reports 227 existing errors across web modules.
   - The focused crew release contracts pass, and production bundling succeeds,
     but the task requires evidence that mobile changes do not alter unrelated
     web behavior. Representative web smoke checks are not a substitute for a
     green regression baseline.
2. **Physical Android and iOS acceptance is outstanding.**
   - Expo JavaScript/Hermes exports passed for Android and iOS.
   - No signed/native debug binaries, emulator/simulator runs, or physical
     device checks were available for camera/document permissions, keyboard
     behavior, screen readers, sharing/download handoff, slow networks, or
     supported phone-size performance.
3. **Credential reissue email delivery is not certified end to end.**
   - Provisioning authorization and email-content safety contracts pass.
   - No controlled email inbox/sink was connected, so delivery, receipt, and
     one-time credential handling were not verified without risking a real
     recipient.
4. **Presentation acceptance remains incomplete.**
   - The inspected mobile screens are usable and consistent at 320×568 and
     430×932, with no horizontal scrolling or desktop-only interaction.
   - App icon/splash assets are not configured, and VoiceOver/TalkBack plus
     keyboard-open long-form checks require native devices.

## Passed checks

### Migrations and configuration

- Created one disposable master database and two disposable tenant databases.
- Fresh tenant A migration: 219 applied of 219.
- Fresh tenant B migration: 219 applied of 219.
- Upgraded/idempotent rerun: 0 applied, 219 skipped.
- Crew credential, refresh-token, notice, notification, and content tables
  existed after migration.
- Replit single-tenant workflow starts and serves the mobile web preview.
- Explicit multi-tenant mode now fails closed when the master database is
  unreachable.
- A healthy controlled master database returns healthy multi-tenant status.
- All disposable certification databases were removed after testing.

### Authentication and tenancy

The real HTTP journey passed against two controlled tenants,
`cert-a.local` and `cert-b.local`:

- development-only office provisioning;
- first login with required password change;
- login with the changed password;
- refresh-token rotation;
- refresh-token replay detection and session-family revocation;
- single-device logout and revoked-token rejection;
- five-attempt account lockout;
- tenant A credentials rejected in tenant B;
- tenant-scoped notices and notifications;
- ownership fields supplied by the client rejected;
- all 16 Crew Information response sections present;
- tenant B denied access to tenant A records and files.

No access tokens, refresh tokens, or temporary passwords were retained in this
report or the repository.

### Crew Information and files

- Focused release contract run: 20 tests passed, including five
  health/tenancy regression checks.
- Own-record guards, active credential/crew checks, read-only records, and
  storage-field redaction passed.
- A controlled document and PNG attachment completed create, upload, list,
  authenticated raw fetch, delete, and parent cleanup.
- Cross-tenant attachment list and raw-file attempts returned not found.
- PDF/PNG/JPEG and 5 MiB server contracts remain enforced.

### Builds and representative regression checks

- Production frontend build passed.
- Production backend bundle passed.
- Mobile TypeScript check passed.
- Expo exports passed for web, Android, and iOS.
- Pre-deploy and safety scripts returned success, although the pre-deploy
  summary does not override the failing full test baseline above.
- Representative web Crew Pool checks passed: module load, search, apply,
  clear, and visible data.
- Representative unrelated Vessel module load passed.
- Mobile and web representative browser runs produced no console errors.
- A mixed burst of 40 mobile API requests and 40 web-preview requests
  completed with zero failures.
- The managed development workflow restarted successfully. A second isolated
  process reached healthy status, accepted a request, stopped, and released
  its port without leaving a listener.

## Defects corrected during certification

- Updated the crew vessel-type lookup to use the canonical post-migration
  `vt_uuid` and `vessel_type` columns. Before this correction, every fresh
  tenant failed to load Crew Information.
- Ensured empty personal and contact sections serialize as explicit `null`
  values instead of disappearing from the response.
- Made explicitly requested multi-tenant startup fail closed when the master
  database cannot be reached.
- Made the health endpoint recognize a healthy master-only multi-tenant
  process.
- Added accessible labels, role/state metadata, and announced login errors.
- Updated stale mobile setup documentation.

## Visual evidence

- `docs/release-evidence/mobile-home-320x568.png`
- `docs/release-evidence/mobile-home-430x932.png`
- `docs/release-evidence/mobile-profile-320x568.png`
- `docs/release-evidence/mobile-profile-430x932.png`
- `docs/release-evidence/web-regression-empty-filter-1280x720.png`

The web image uses an impossible synthetic search term and contains no crew
rows. Earlier web screenshots with unverified development rows were removed.

## Go criteria

Change the decision to **GO** only after all of the following are recorded:

- the root TypeScript and agreed web regression baseline pass;
- Android and iOS native builds run on representative devices;
- first-time and frequent-user journeys pass with keyboard, screen reader,
  permissions, slow network, repeated taps, cancellation, and recovery checks;
- credential reissue is delivered to and received by a controlled test inbox;
- approved icon/splash/brand assets are configured and reviewed;
- no new critical/high security or tenant-isolation finding is open.