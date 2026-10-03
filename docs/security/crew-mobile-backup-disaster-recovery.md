# SAIL Crew Mobile/BFF Backup and Disaster-Recovery Design

Status: private-vault logical backup and isolated restore-verification commands are implemented. Provider PITR, vault policy, scheduled execution, and real restore results are **NOT VERIFIED**.

## Scope and authority boundary

This design covers only BFF-owned mobile assets:

- PostgreSQL tables `app_crew_credentials`, `app_crew_refresh_tokens`, `app_crew_content_pages`, `app_crew_notices`, `app_crew_notifications`, `app_crew_pending_changes`, `app_crew_pending_reviews`, `app_crew_erp_commands`, `app_crew_privacy_requests`, and `app_crew_app_settings`.
- Clean private attachments referenced by mobile pending changes or authoritative records under the tenant-scoped private storage hierarchy.
- Short-lived quarantine objects while needed for failure investigation or retry, subject to an approved retention policy.
- BFF security/audit events where the selected monitoring platform stores them outside the database.
- Deployment configuration identifiers, migration version, application version, and backup manifests. Secret values are never included in manifests.

The ERP remains authoritative and frozen. ERP backup, point-in-time recovery, high availability, and restore capability are **NOT VERIFIED** and are outside this design. A BFF restore must never overwrite ERP data directly. Restored operations are reconciled against ERP using supported read/API paths before any command is resumed.

## Current-state finding

`scripts/backup-db.ts` now creates a PostgreSQL custom-format export without placing credentials in the command line, calculates a SHA-256 manifest, uploads both artifacts to a KMS-encrypted private S3 vault under compliance-mode object retention, and removes temporary material. The dump exists briefly in the operating-system temporary directory, so the backup runner requires encrypted local storage and a dedicated hardened identity. `scripts/verify-backup-restore.ts` verifies the checksum/archive, refuses the source database, requires ERP dispatch to be disabled, restores into an explicitly confirmed isolated target, and checks required BFF tables. These tools do not prove provider PITR, vault configuration, scheduled execution, attachment-version consistency, or a completed exercise.

The statements about provider automatic backups in older deployment documentation are **NOT VERIFIED** for the intended production BFF environment. Provider configuration and restore evidence must be obtained before release.

## Required production architecture

### PostgreSQL

- Enable provider-native continuous WAL archiving/PITR where supported.
- Encrypt database storage, WAL, snapshots, and exports with a customer-approved KMS key.
- Create scheduled logical exports as a portability control; write them directly to a private backup vault, not the application filesystem.
- Use a backup identity separate from the runtime BFF identity. Grant only the read/backup capabilities required.
- Keep deletion and key-administration privileges separate from backup creation privileges.
- Record database identity, tenant scope, start/end time, transaction/recovery point, migration version, tool version, checksum, encryption-key identifier, retention class, and result in the backup manifest.
- Alert on failed backups, missing recovery points, unexpected size changes, immutability failures, and overdue restore exercises.

### Private attachments and quarantine

- Replace production local `.private` storage with a private object store before relying on horizontal scaling or host replacement.
- Enable encryption with an approved KMS key, object versioning, deletion protection/object lock where supported, and access logging.
- Preserve tenant-prefixed keys and deny cross-tenant prefix access through IAM and application authorization.
- Back up or replicate only clean, durable attachments. Quarantine is not an authoritative archive; define a short retention period and legal-hold exception through approved policy.
- Generate a per-backup object manifest containing opaque storage key, tenant pseudonym, checksum, size, version ID, scan state/time, and database reference. Do not include document content or public URLs.

### Backup isolation and immutability

- Use a separate backup account/project and private vault with no public access.
- Production runtime may create backup inputs but cannot delete vault recovery points.
- Require two-person approval for backup deletion, retention changes, vault unlock, and KMS destruction.
- Replicate to an approved independent failure domain when required by the selected recovery tier.
- Monitor and periodically test KMS recovery and backup-reader access. Encryption without recoverable key governance is not a restore control.

## Consistency model

A recovery set consists of a database recovery point plus an attachment-version manifest:

1. Record a recovery-set UUID and database transaction/recovery marker.
2. Capture the database recovery point and immutable metadata.
3. Capture versions/checksums for every referenced clean mobile attachment.
4. Mark the set complete only when database, objects, manifest, encryption metadata, and checksums are present.
5. Never publish a partial set as restorable. Alert and retry creation safely.

On restore, database rows that reference missing or checksum-mismatched files remain unavailable and are reported for controlled remediation. Files without a restored database reference remain inaccessible and are reviewed before expiry; they are not automatically linked.

## Recovery objectives requiring approval

Current approved RPO: **NOT DEFINED**.

Current approved RTO: **NOT DEFINED**.

Business owners must choose a tier after cost, maritime connectivity, privacy, and ERP dependency review:

| Option | Illustrative BFF RPO | Illustrative BFF RTO | Design implication |
|---|---:|---:|---|
| A — critical | Up to 15 minutes | Up to 2 hours | Continuous PITR, cross-failure-domain objects, warm recovery automation and frequent exercises |
| B — standard | Up to 4 hours | Up to 8 hours | PITR/scheduled recovery points, replicated objects and documented automated rebuild |
| C — basic | Up to 24 hours | Up to 24 hours | Daily protected backups and manual recovery; larger mobile-operation reconciliation window |

These are planning options, not current commitments. Approved objectives must identify whether tenant-specific corruption, regional outage, KMS loss, and ERP outage are included.

## Restore-test procedure

Run in an isolated non-production recovery environment. Never restore over production and never permit restored workers to call production ERP.

### 1. Authorization and preparation

- Obtain change/test approval from `[BFF_SERVICE_OWNER]`, `[PLATFORM_IAM_OWNER]`, `[SECURITY_ON_CALL]`, and the participating `[TENANT_OWNER]`.
- Select a recovery-set UUID and target timestamp without exposing crew data in the ticket.
- Create isolated network, database, private object prefix, temporary KMS grants, and evidence location.
- Block outbound ERP commands and notifications at network and application layers.
- Record test start time, approved recovery objective option, application commit, migrations, database/object-store versions, and operator roles.

### 2. Validate recovery material

- Verify vault immutability/retention status and that the recovery point predates the simulated incident.
- Verify signatures/checksums for database export, WAL/recovery metadata, attachment manifest, and every selected object version.
- Confirm encryption-key access through the recovery role without granting production runtime or delete access.
- Abort if the manifest is incomplete, checksums fail, tenant scope is ambiguous, or secrets appear in metadata.

### 3. Restore database and files

- Restore the database to a new empty target or provider recovery clone at the selected point.
- Restore clean attachment versions to an isolated tenant-prefixed object namespace.
- Apply only migrations expected for the selected application version. Do not edit historical migrations.
- Configure the recovered BFF with new non-production secrets and disabled external side effects.

### 4. Integrity and tenant validation

- Verify expected mobile table counts and referential constraints by tenant.
- Verify pending-change-to-review/command uniqueness and operation UUID uniqueness.
- Compare every restored attachment reference with object version, checksum, size, tenant prefix, owner, and clean scan state.
- Test positive access for the owning crew and negative access for another crew in the same tenant and a crew in another tenant.
- Confirm old production access/refresh tokens and copied credential material cannot authenticate to the recovery environment.
- Confirm quarantine objects are unavailable to mobile download routes.

### 5. ERP reconciliation

- Keep ERP command dispatch disabled.
- Classify every non-final `app_crew_erp_commands` row as already reflected in ERP, safely pending, ambiguous, or `RECONCILIATION_REQUIRED` using supported authoritative reads and stable identifiers.
- Do not blindly replay operations whose ERP outcome is unknown.
- Record discrepancies with operation UUID and pseudonymized tenant/actor references; never copy sensitive payloads into the exercise report.
- Obtain `[ERP_OWNER]` approval for the proposed disposition. The exercise must not mutate ERP.

### 6. Functional recovery checks

- Authenticate with newly provisioned recovery-only credentials.
- Read profile and certificate metadata, download an owned clean test attachment, list pending changes, query operation status, and list privacy requests.
- Submit a synthetic recovery-environment-only mutation and verify idempotency without enabling ERP dispatch.
- Verify safe logs and security events contain correlation IDs but no tokens, passwords, passport data, medical data, or document contents.

### 7. Measure and close

- Measure recovery-point gap, database restore duration, object restore duration, application recovery duration, validation duration, total recovery time, failures, manual steps, and reconciliation backlog.
- Compare measured RPO/RTO with the approved option. A missed objective fails the exercise.
- Destroy the isolated recovery environment and temporary KMS grants through the approved process after evidence retention is confirmed.
- Produce an evidence record containing approvals, recovery-set UUID, timestamps, checksums, tool versions, counts, test results, discrepancies, corrective actions, and sign-off. Do not attach database dumps or sensitive files.

## Tenant-level restore

Tenant-selective recovery must be treated as a data-repair project, not a routine full-database import:

1. Restore the selected recovery point into isolation.
2. Export only BFF-owned rows for the server-derived tenant scope, preserving UUIDs and relationships.
3. Compare current production and recovered versions to prevent rollback of newer valid changes.
4. Reconcile pending/applied ERP commands and attachment versions.
5. Create an approved, idempotent repair plan with dry-run counts and rollback evidence.
6. Execute through a purpose-built reviewed tool under two-person control; never use ad hoc SQL against production.
7. Re-run tenant isolation, audit, and attachment-integrity tests.

No tenant-level restore tool currently exists; this capability is **NOT IMPLEMENTED** and **NOT VERIFIED**.

## Disaster scenarios to exercise

- Accidental deletion or corruption of BFF rows.
- Loss of BFF database with object storage intact.
- Loss or corruption of object storage with database intact.
- Loss of one infrastructure region/failure domain.
- Compromised runtime identity attempting backup deletion.
- KMS key access outage.
- Restore to a point before and after a migration.
- BFF restore while ERP is unavailable.
- Restore where ERP contains a successful operation but the BFF recovery point shows it pending/applying.
- Tenant-specific logical corruption and cross-tenant file-reference corruption.

## Production acceptance evidence

Release approval requires provider/IAM/KMS configuration evidence, successful scheduled backup records, immutable/off-site recovery evidence, alert delivery, a completed isolated restore exercise, measured RPO/RTO, attachment/database consistency results, tenant-negative tests, ERP reconciliation results, and named owner sign-off. Until these exist, backup/DR remains **NOT VERIFIED**.
