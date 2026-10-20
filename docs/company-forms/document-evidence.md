# Frozen Company Form document evidence

This slice stores evidence only. It does not render PDFs, enable real-form
generation, configure logos, send mail, or add print/handover actions.

## Capture boundaries

- The existing first successful signature or section submission freezes System
  fields. The same transaction now freezes header facts, company identity,
  the explicit no-logo state, pinned content, rule policy and reference labels.
- The subject adapter supplies header display facts under the existing subject
  lock. Crew rank comes only from captured contract-rank identity; an absent
  capture remains `Not recorded`.
- Each new signature stores its actual PNG bytes and SHA-256 in tenant-local,
  immutable evidence, in the same transaction as the recorded signer and witness.
  Re-signing keeps the earlier image evidence; only the active signature is
  included in the eventual completion input.
- Completion assembles the versioned input from the frozen header/definition,
  saved System fields, answers, section comments, submitted states and active
  signatures. It inserts the snapshot and a unique preparation request before
  the completion transaction commits. Requirement completion shares the
  existing transactional path.
- Rendering, storage publication and email are not performed in this transaction.
  There is no PDF worker in this slice. A pending request is durable evidence
  for the later renderer, not a claim that a PDF already exists.

## Hash contract

The input contract is subject-neutral and explicitly versioned. For version 1,
serialize through JSON to normalize dates to ISO strings and remove undefined
object properties. Sort object keys recursively, preserve array order, and
serialize without extra whitespace. SHA-256 hashes the UTF-8 canonical string.
Store that exact string alongside JSONB; the database checks JSON equality and
recomputes the digest before accepting the snapshot.

The eventual PDF footer labels this digest **Frozen-record SHA-256**. The
later archive independently hashes and stores the exact PDF bytes. The
frozen-record digest is not the file digest.

## Identity, branding and history

Tenant identity comes from server tenant context. The company name comes only
from the trusted parent tenant record. In single-tenant operation with no such
record, the database identity and explicit missing company name are frozen.
No name is inferred from vessel, user role, application branding or request
payload. A missing name must be presented as not recorded, never invented.

No logo exists in this slice. That absence is frozen and does not block
completion. Versioned logo administration belongs to the later PDF slice.
Subsequent branding changes must not mutate existing evidence.

There is no historical backfill. A form already signed/submitted before this
evidence existed cannot acquire today's header or missing image bytes.
Completion remains possible but records an unavailable request with a stable
reason and no fabricated snapshot. Operational reads show a plain explanation
and ask the office to review the original evidence.

## Permissions and immutability

Existing Company Forms View and normal subject/vessel authorization protect
both operational read paths. Only status, a safe message and the frozen-record
digest are added to browser responses; evidence bytes are not exposed there.
Authoring rights are not needed to see status.

Headers, assets, completion inputs and initial preparation requests reject
updates and deletes. Later preparation outcomes must be separate records, not
rewrites of the input or initial request. There is one snapshot/request per
submission, protected by the existing subject/submission locks and unique keys.

Automated teardown may remove only its disposable records in the registered
isolated test database, using identity-verified, transaction-scoped cleanup.
This helper is not an application endpoint and is forbidden in the main
preview. New automated fixture identities are logged in the ignored
`test-logs/fixture-contexts.jsonl`; no main-preview fixture is created here.

## Verification

`tests/integration/company-form-document-evidence.test.ts` checks the required
form signing path, first-action freezing, exact signature bytes, missing rank,
answers/comments, immutable records, concurrent completion, durable request
rereads, injected transactional failure, historical unavailability, View-only
access, wrong-vessel refusal and separate tenant executors with no public-schema
fallback.

`tests/unit/company-form-document-evidence.test.ts` checks canonical hashing,
plain failure messages and the email startup log's boolean-only configuration.
Run the complete Company Forms gate, full suite and TypeScript check using the
registered test target. No automated test may use the main backend or database.

Before the later PDF slice enables generation for real forms, registered-fixture
samples must demonstrate logo and name fallback, all signature types,
witnessing, `Not recorded` and the footer. The user must approve their layout.
