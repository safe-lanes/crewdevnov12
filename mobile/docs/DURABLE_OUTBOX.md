# Durable mobile outbox

## Scope and flow

The outbox is a transport reliability layer for BFF-supported updates only. The current allowlist is `particulars` and updates to existing children, documents, visas, education, licenses, training, and sea-service records. UI validation occurs first, then one UUID is generated and the encrypted record is durably saved before any request. The processor reuses that UUID for every send and status lookup.

Creates, deletes, login/refresh/password, privacy, notifications, office/admin actions, attachments, and blocked ERP operations remain explicit online-only operations. GET operations remain read-only. The server remains authoritative for authorization, tenant isolation, review, idempotency, and ERP reconciliation.

## Encryption and key lifecycle

Each record is independently encrypted and authenticated with AES-256-GCM from `@noble/ciphers` (an audited, small, pure-JavaScript implementation compatible with Expo). Every encryption uses a fresh 96-bit nonce and binds the local record ID as authenticated additional data. The ciphertext includes the GCM authentication tag.

The 256-bit key comes from Expo's cryptographically secure RNG and is stored only in Expo SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, backed by Keychain/Keystore. It is not in `.env`, app configuration, logs, requests, or the encrypted file. An absent key creates a new key; a wrong/lost key or corrupt ciphertext fails closed and stops queue processing. The app must direct the user to contact support; it must never silently resend or discard undecryptable work.

The encrypted file uses temporary and backup files during replacement so an interrupted write retains either the old or new complete envelope. Web uses memory only and is not a durable mobile outbox target.

## Recovery, ownership, and retry

Records contain operation/local IDs, identity (`domain` and `crewUuid`), logical action, target, payload, payload fingerprint, status, attempts, safe error code, timestamps, and server status. No credentials or headers are stored.

`SENDING` after a crash is treated as uncertain: status is checked before resend. Timeouts and network failures become `AWAITING_CONFIRMATION`; status is checked first. `COMPLETED` and `PROCESSING` do not resend. `NOT_FOUND` permits a resend with the same UUID. Retry delay is exponential with jitter, starting near two seconds and capped near five minutes. Ten consecutive indeterminate status failures become `NEEDS_RECONCILIATION`. Known-offline state suppresses requests; connectivity restoration merely triggers a safe attempt and is not treated as proof of API reachability.

Logout pauses work and retains ciphertext. Login resumes only records matching both tenant and crew UUID. Retaining an old user's encrypted pending queue is fail-closed behavior and remains a product-policy decision.

Limits are 100 active operations and 64 KiB JSON per operation. Capacity errors reject the new operation; existing work is never evicted. Completed records are retained for seven days. Pending, ambiguous, and reconciliation records are never age-deleted.

## Attachments

Raw binaries are not placed in this JSON outbox. Existing uploads remain online-only. Durable encrypted attachment staging, checksum verification, a stable attachment operation ID, and server-guaranteed idempotent restart/chunked upload are not implemented. An interrupted ambiguous upload continues to require attachment-list reconciliation. This is a release blocker for claiming offline attachment support.

## Privacy-safe telemetry

The processor exposes aggregate queued, completed, failed, reconciliation and retry counts plus oldest queued age. It emits no payload logging. These hooks contain no tenant, crew, operation, or document identifiers and are not connected to a remote telemetry backend in this repository.

## Maritime network harness

The automated suite covers offline suppression, reconnection, ambiguous timeout, process-state recovery, ownership, and persistence semantics. The following physical/emulated network profiles are **NOT VERIFIED — NETWORK HARNESS REQUIRED**:

- 10 KB/s and 20 KB/s throughput
- 500 ms and 1000 ms latency
- 2% and 5% packet loss
- disconnect during request and immediately after server commit
- offline for 30 minutes
- app termination during sync
- device reboot
- Wi-Fi/cellular network switch

Run these on Android and iOS release builds through a controllable proxy/network conditioner. For every case, capture the persisted operation ID before disruption and verify it remains identical after recovery, no second authoritative mutation exists, no plaintext payload appears in device files/logs, and the UI reaches the expected safe status.
