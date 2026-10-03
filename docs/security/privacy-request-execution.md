# Privacy request execution

Crew users can initiate access, export, correction, and account/data-deletion requests in the mobile app. Submission is not completion. Office processing uses the separately permissioned `Privacy Request Operations` API and requires identity verification, a reason, a correlated immutable audit event, and evidence before completion.

Deletion execution revokes refresh tokens, increments the session version, disables and de-identifies the mobile credential, removes crew notifications, removes staged attachments, and clears/rejects pending mobile-change payloads. Existing ERP command and review audits are retained to protect reconciliation and evidence integrity.

The executor never assumes that authoritative ERP employment or maritime records may be erased. The operator must record `deleted`, `retained`, or `not_applicable` with an evidence reference. `retained` produces `partially_completed`, which is shown to the requester. Open ERP commands block execution. Legal hold blocks execution.

Access, export, and correction requests can be completed only after verification and approval, with an evidence reference. The evidence itself must live in approved restricted storage; the database stores only its reference and resolution summary.

Office endpoints separate the internal audit reason from the requester-safe message. Internal legal or investigation notes must never be placed in `requesterMessage`, because that field is returned to the crew member.

Before production use, legal/privacy owners must approve the retention schedule, lawful-basis mapping, legal-hold authority, response deadlines, evidence repository, requester communications, and ERP operating procedure. RBAC migration intentionally grants no role access automatically.
