# VAPT evidence, triage and release closure

This document is a blank control record. It becomes release evidence only when completed and signed by an independent assessor and the accountable SAIL owners.

Generate a tamper-evident inventory for supplied binaries and evidence with `npm run vapt:evidence-manifest -- --assessment-id VAPT-YYYY-NNN --output vapt-manifest.json <AAB> <IPA> <report>`. The command refuses to overwrite an existing manifest; store the result in the restricted assessment location, not in Git.

## Assessment manifest

| Field | Value |
|---|---|
| Assessment ID / supplier | `[required]` |
| Authorized RoE version and signatures | `[required]` |
| Source commit / Android SHA-256 / iOS SHA-256 | `[required]` |
| BFF origin and deployment identifier | `[required]` |
| Test dates, devices and OS versions | `[required]` |
| Tenant/account inventory reference | `[required — no secrets]` |
| SBOM artifact names and hashes | `[required]` |
| Limitations and untested scope | `[required]` |

## Evidence register

| Evidence ID | Test/finding | UTC timestamp | Sanitized description | Encrypted location | SHA-256 | Custodian |
|---|---|---|---|---|---|---|
| `E-001` | `[VAPT-##/F-###]` | `[UTC]` | `[no credentials or PII]` | `[restricted reference]` | `[hash]` | `[name]` |

## Finding and remediation register

| Finding | Severity/CVSS | Assets/tenants | Owner | Fix commit/build | Verification evidence | State |
|---|---|---|---|---|---|---|
| `F-001` | `[Critical..Info / vector]` | `[scope]` | `[name]` | `[SHA/build]` | `[E-###]` | `[Open/Fixed/Accepted]` |

An accepted risk requires business/security approvers, justification, compensating controls, target remediation date and expiry. “Cannot reproduce” requires matching build/environment evidence. A scanner result alone cannot close a confirmed manual finding.

## Exit decision

- `[ ]` Every matrix row has a result and evidence or an approved limitation.
- `[ ]` Zero open critical or high findings.
- `[ ]` All fixed critical/high findings were independently retested on the release-candidate build.
- `[ ]` Medium risk exceptions have named owners and unexpired approvals.
- `[ ]` Tenant A/B and all required roles were tested.
- `[ ]` Android and iOS release-candidate hashes match the candidate submitted for signing/release.
- `[ ]` Evidence retention and eventual destruction dates are recorded.
- `[ ]` Independent supplier issued the signed report and retest letter.

Decision: `[GO / NO-GO]`  
Independent assessor: `[signature/date]`  
Application owner: `[signature/date]`  
Security owner: `[signature/date]`  
Privacy owner: `[signature/date]`
