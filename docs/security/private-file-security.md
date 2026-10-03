# Private attachment security deployment

Production reads configuration from the root `.env` or the deployment secret manager. Do not put real credentials in source control.

Required production variables:

```text
CREW_APP_FILE_SCANNER=clamav
CLAMAV_HOST=private-clamav-service
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=20000
ATTACHMENT_STORAGE_DRIVER=s3
ATTACHMENT_S3_BUCKET=private-bucket-name
ATTACHMENT_S3_REGION=ap-south-1
ATTACHMENT_S3_KMS_KEY_ID=optional-kms-key-id
```

For an S3-compatible private service, also configure `ATTACHMENT_S3_ENDPOINT`, `ATTACHMENT_S3_FORCE_PATH_STYLE=true`, `ATTACHMENT_S3_ACCESS_KEY_ID`, and `ATTACHMENT_S3_SECRET_ACCESS_KEY`. On AWS, prefer workload identity/IAM roles and omit static access keys.

The bucket must have public access blocked, object ownership enforced, TLS-only bucket policy, versioning, lifecycle/retention rules, access logging, and least-privilege permissions limited to the configured bucket prefix. KMS permissions must be restricted to the application role when a KMS key is configured.

ClamAV must be reachable only on a private network. Keep signatures updated and monitor update age, scan failures, timeouts, malware detections, and quarantine cleanup. The application accepts only an explicit `OK`; timeouts, malformed responses, and unavailable scanning fail closed.

Existing local `.private` references remain readable for migration. A controlled migration must copy them into the private bucket, verify checksums, update database references to `object://...`, and retain a rollback manifest before local files are removed.
