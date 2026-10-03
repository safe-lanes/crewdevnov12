# CI and software-composition security policy

The `Security CI` workflow is the mandatory security pipeline for the crew mobile application and its BFF. Repository rules should require its jobs before merge.

## Enforced controls

- Reproducible root and mobile installs use committed npm lockfiles.
- Pull requests are rejected when they introduce a high or critical known vulnerability in runtime or development dependencies.
- Existing production dependency trees are rejected for critical advisories by `npm audit`.
- CodeQL scans JavaScript and TypeScript and uploads SARIF to GitHub code scanning.
- Gitleaks scans full Git history for credentials.
- CycloneDX SBOMs are generated independently for the BFF and mobile app and retained for 90 days.
- Mobile type checks, application tests, production bundling, source manifest validation, and live multi-tenant ERP-worker tests are separate required gates.
- Dependabot groups weekly root, mobile, and GitHub Actions upgrades to keep review volume manageable.

## Known audit baseline

As of 2026-10-02, the mobile production tree reports four high and nine moderate transitive advisories beneath Expo tooling. npm proposes downgrading to Expo 44, which is a breaking and unsafe remediation for this Expo 57 application. These findings must be reviewed on each Expo update and must not be silently suppressed. The pull-request dependency-review gate prevents newly introduced high/critical findings, and the audit gate still rejects any critical advisory in the installed tree.

## Repository settings required

Enable the dependency graph, Dependabot alerts, private vulnerability reporting, secret scanning with push protection, and CodeQL default or advanced setup. Configure a repository ruleset that requires every `Security CI` job and prevents direct pushes to the protected release branch.

Action references should be restricted at repository or organization level to GitHub-owned and explicitly approved publishers. Enable GitHub's policy requiring actions to be pinned to a full commit SHA once the organization has an automated action-update process.
