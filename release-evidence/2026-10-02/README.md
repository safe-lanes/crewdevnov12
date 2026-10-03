# Evidence directory index

Primary decision document: `RELEASE-EVIDENCE-PACK.md`.

- `migration-source-manifest.json`: source-file inventory only; not production migration proof.
- `local-tests/`: local synthetic implementation tests; not production-runtime evidence.
- `sbom/`: candidate CycloneDX SBOMs generated from the current dirty workspace.
- `sca/`: raw npm production-dependency audit responses captured on 2026-10-02.

Do not place credentials, MFA seeds, tokens, crew PII, signing keys, keystores, certificates or provisioning profiles in this directory. External evidence should be referenced by immutable restricted-system ID and hash rather than copied into Git when it contains sensitive information.

