# SAIL Crew Mobile independent VAPT rules of engagement

**Status:** Template — not authorization to test and not evidence that VAPT has occurred.  
**Assessment ID:** `[VAPT-YYYY-NNN]`  
**Authorizing executive:** `[name/title]`  
**Independent supplier and named testers:** `[legal entity and names]`  
**Authorized window:** `[start/end with timezone]`  
**Emergency contacts:** `[24x7 client and supplier contacts]`

Testing may begin only after this document is completed and signed by the system owner and supplier. Written authorization applies only to the hosts, application identifiers, accounts, dates, source revision and binaries listed below.

## Required test objects

- Release-candidate Android AAB/APK and iOS IPA, with SHA-256 hashes and build provenance.
- Staging BFF origin: `[HTTPS origin]`; production is excluded unless separately authorized.
- Source revision: `[full Git commit SHA]`; mobile version/build: `[version/build]`.
- Two isolated staging tenants: `VAPT-TENANT-A` and `VAPT-TENANT-B`.
- Per tenant: two Crew accounts owning different records, one Crew Admin, one office reviewer with view-only permissions, and one office reviewer with edit permissions.
- One disabled account, one MFA-enrolled account, one account with recovery codes, expired/revoked access and refresh tokens, and representative non-production attachments.
- Test devices: one supported Android physical device and one supported iOS physical device; rooted/jailbroken laboratory devices or emulators are permitted only in staging.

Credentials, MFA seeds, recovery codes, database URLs and signing material must be exchanged through the approved secret-sharing channel, never committed to this repository or placed in the final report.

## In scope

- `com.sail.crewapp` Android and iOS release candidates, including local storage, logs, screenshots, backups, IPC/exported components, network behavior, reverse engineering and tamper behavior.
- `/api/crew-app/auth`, `/content`, `/notices`, `/notifications`, `/crew-information`, and `/privacy-requests`.
- Office workflows under `/api/v2/crew-app-review`, including approvals, privacy execution and ERP command operations.
- Tenant resolution, object storage delivery, malware rejection, offline outbox replay, SIEM-safe event generation, rate limits and error handling.
- The staging ERP adapter and command worker only with synthetic records assigned to the assessment.

## Excluded unless separately approved

- Production systems or real crew/client data; other tenants; third-party SaaS, app stores, telecom providers and identity systems.
- Social engineering, phishing, physical intrusion, persistence, destructive malware, denial-of-service/load tests, credential stuffing against non-test users, and deletion outside seeded test records.
- Accessing or retaining another person's data. Stop immediately if unexpected real data appears.

## Safety limits and stop conditions

- Default ceiling: 5 requests/second per tester and 500 requests/hour per account. Higher-rate resource-consumption tests need a dated change authorization.
- File tests are limited to 25 MB unless separately authorized. Use harmless EICAR only after the scanner owner approves the exact window.
- Privacy deletion and ERP mutations must use prefixed synthetic records and must be reconciled after testing.
- Stop and notify immediately for cross-tenant access to non-seeded data, production routing, service instability, uncontrolled worker backlog, exposed secrets/signing keys, or evidence of active compromise.
- The client may pause or revoke authorization at any time. Testers must preserve evidence and make no further requests after notice.

## Evidence and handling

- Record UTC timestamps, tester, device/OS, binary hash, source SHA, tenant/account role, request ID, exact preconditions, sanitized request/response and reproducible steps.
- Do not include passwords, tokens, MFA seeds, recovery codes, crew PII or malware samples in tickets or reports. Redact values while retaining field names and last four characters where correlation is necessary.
- Encrypt evidence at rest and in transit. Access is limited to named participants. Retention is `[90 days after closure]`, followed by evidenced secure deletion.
- Findings use CVSS v3.1 plus business impact and must distinguish confirmed exploitation, design weakness, hardening advice and informational observations.

## Deliverables and acceptance

The independent supplier provides a signed executive report, technical report, completed test matrix, evidence index, tool/version list, limitations, false-positive disposition and retest letter. Critical findings are reported within four hours and high findings within one business day. Release requires zero open critical/high findings; medium exceptions require documented owner, compensating controls and expiry date.

Signatures: system owner `[ ]` · security owner `[ ]` · supplier lead `[ ]` · date `[ ]`

