# Company Form email delivery — parent-developer handover

Status: specification only. No Company Form email sender, queue, settings or
resend implementation is delivered by this slice. PDF generation is enabled;
this document does not enable email. Existing unrelated email callers are
unchanged.

## 1. Ownership and prerequisites

The parent developers supply an attachment-capable sending service, a verified
tenant sending domain/address, reply-to policy, and configuration through the
platform's secrets mechanism. Never log credentials or credential prefixes.
Configure SPF, DKIM and DMARC, provider signing, delivery/bounce callbacks and
their verification, tenant isolation, quotas and attachment-size limits before
enabling delivery. Do not impersonate a signer's personal mailbox or use the
SAIL application logo as tenant branding.

The parent must provide an authoritative link from recorded signer user UUIDs
to recipient contacts, and the subject seafarer's contact. Do not resolve a
signer by a role label or display name. A witnessed seafarer signature identifies
the seafarer as recipient; the witness does not replace him as recipient.
If an exact historical identity cannot be resolved, record the missing contact
and allow an explicitly audited contact correction, never guess an address.

Enable email separately per tenant, with an explicit decision on any historical
completed-form backlog. Do not unexpectedly email all old records at rollout.

## 2. Recipients and policy

For each newly completed form:

* Address the subject seafarer.
* Address every distinct actual Company Representative who signed the form,
  not the current holder of that role, and not merely the submitting user.
* Deduplicate equal normalized addresses in the envelope while retaining all
  recipient identity/reason associations in the log. Do not expose unrelated
  recipients' addresses in a group To/CC field; use separate messages.

Optional additional recipients are configured by Forms authors on a draft
version and frozen on release: actual vessel signers, actual recorded witnesses,
or a fixed office/crewing mailbox. A fixed mailbox must be validated and enabled
under tenant policy; the browser may not submit arbitrary delivery destinations.
Versioned recipient policies must not change an old completed record's policy.
The current slice has not added this authoring setting.

## 3. Durable nonblocking delivery

Completion and its frozen evidence commit without depending on a mail provider.
Create a durable idempotent delivery intent transactionally with completion (or
through a transactional outbox); workers process it after commit. An unavailable
PDF means waiting for the existing PDF preparation request, not generating a
second PDF. A missing address, missing sender configuration, oversized attachment,
provider error or failed PDF preparation never rolls completion back.

Use separate recipient attempts with explicit outcomes: queued, waiting for PDF,
missing address, sending, accepted by provider, delivered (only when verified),
failed, bounced and uncertain. Accepted is not delivered. A network timeout after
a send may be uncertain; do not automatically duplicate it without idempotency or
reconciliation. Apply bounded retry/backoff and keep permanent failures visible.

On the form, show recipients, the latest outcome, safe plain-language reason and
next action. Do not expose provider exceptions, raw responses, credentials or
stack traces. Company Forms View and ordinary vessel/subject scope govern
visibility, including download/print and delivery history. Never leak another
vessel's contact or attachment through a delivery-detail endpoint.

## 4. Use exactly the stored file

The canonical completed PDF is in `frm_document_files`. Its SHA-256 identifies
the exact bytes; `frozen_record_sha256` identifies the signed frozen record.
They are different fingerprints. Never rebuild from today's crew, company,
version, logo, answers or signatures, and never call a renderer from the sender.

For a voided form use the latest applicable immutable notice revision in
`frm_document_void_notices` and its stored annotated file in
`frm_document_void_files`. This appends a notice to the archived original, not a
new rendering of its form pages. A later replacement creates another immutable
notice revision and annotated file; earlier files and delivery evidence survive.
The notice records the exact replacement form UUID, or “No replacement yet”.

Implement a server-internal selection service with the same assignment-first,
submission-second locking and authorization/tenant boundaries as
`documentCopyService.lockedCopy` / `downloadCopy`. It must return file UUID,
notice UUID/revision when applicable, document reference, original-file
fingerprint, selected file fingerprint, and immutable bytes verified against the
archive. Do not call the public HTTP endpoint with an invented user or bypass
vessel scope. The selected UUID and fingerprint are pinned to the delivery
attempt before dispatch. A worker may only attach those exact bytes.

Recheck form/notice state before dispatch: a completion intent not yet sent when
the form is voided must not send an unannotated original. Supersede it with a
void-notice delivery intent. If state changes after a provider accepts an
in-flight message, keep its actual original attachment logged and schedule the
new notice; do not claim to recall mail or rewrite the old attempt.

Keep the PDF's reference and record fingerprint as printed. Never modify PDF
bytes to add a recipient, mail timestamp, provider ID, or tracking image.

## 5. Delivery log and resend authority

Each append-only attempt records, from the server:

* Tenant, form submission, pinned version, document reference, delivery intent,
  recipient identity and reason (seafarer/actual representative/additional),
  exact address used, and address-source/contact-revision evidence.
* File UUID, notice UUID/revision if applicable, exact attached-file SHA-256,
  original-file SHA-256 for an annotated copy, and frozen-record SHA-256.
* Server time, server-derived requesting actor UUID/name/role, or an explicitly
  identified automatic worker; never accept browser identity or time.
* Attempt/idempotency key, provider message ID, attempt outcome and safe reason,
  and verified provider-event time/receipt evidence. Later events append history;
  they never replace the address, attachment or identity of an earlier send.

Grant Company Forms Fill in on that assignment to resend; Forms authoring is
neither necessary nor sufficient. Recheck it under the assignment lock and keep
normal vessel/category/stage restrictions. Require selection of a recorded
recipient, not a free-form browser address. Record explicit resend actions.
Contact refresh/correction requires a written reason and a separately audited
server-resolved or tenant-approved address; show before/after/source/actor/time.
It changes only the next attempt, not the original frozen PDF or earlier logs.
Reject browser-supplied audit identity, role, time, outcome and file fingerprint
as authority. The browser may select a current file fingerprint for optimistic
concurrency, but the server must validate it against the selected stored file.

## 6. Void-notice delivery and physical handover

A voided form whose original copy was handed to the seafarer displays:

> A copy was handed to the seafarer on [date]. The void notice has not been handed over.

The original physical handover remains historical evidence. The explicit
**Void notice handed to seafarer** action requires Fill in on the assignment.
It records server-derived actor identity, role, server time and the exact
annotated-copy file UUID and SHA-256 in `frm_document_void_handovers`.
It is visible on the form and in G3. Browser identity/time is rejected, and an
old original or superseded annotated fingerprint cannot be recorded as the
current notice handover. A later replacement revision requires its own
handover; earlier handovers are retained and do not clear its reminder.

Emailing or accepting delivery of a void notice is **not** physical handover
and must never create or imply a `frm_document_void_handovers` record or clear
the physical-handover reminder. Conversely, physical handover does not claim
that an email was sent. Show the two channels separately.

When a previously completed form is voided, schedule a nonblocking void-notice
delivery for its original recipients and any approved notice recipients,
including the seafarer even when he previously received only a physical copy.
Use the applicable annotated stored file, never an unannotated original. Use
the same missing-address, failure, uncertainty, logging and Fill in resend
policy as completion delivery. A replacement introduced later may require an
updated notice delivery: give it its own intent/revision and file fingerprint;
do not rewrite the previous message or claim a new physical handover.

## 7. Parent implementation acceptance checks

Prove tenant/assignment/vessel access, server-derived audit identity, missing
addresses, missing provider configuration, provider timeout/uncertainty,
idempotent retry, bounced/delivered callbacks, permitted and refused resend,
and audited contact refresh. Verify completion succeeds in every delivery
failure case. Confirm each received attachment hashes to its logged stored
file, including void-before-PDF, void-during-send and later replacement.
Show independent physical-handover and email states in the form and G3.

Keep automated fixtures in the registered isolated test database. Main-preview
verification reuses registered fixtures; released verification forms must be
restricted by condition to a fixture-only vessel. No real recipient receives
verification mail.
