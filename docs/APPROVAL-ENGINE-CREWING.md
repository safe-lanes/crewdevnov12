# Approval engine in Crewing — integration guide

Written 17-Nov-2026 for Sahil (Crewing flow integration) and Datta (review and deploy).

## 1. What it is

The approval engine is the same multi-step approval engine that runs in the Technical module (PMS change requests, work order postponement) and in Defects. It is now part of Crewing.

For any Crewing flow (portage bill, promotion, appraisal, …) an administrator sets, in **Admin → Approval Workflow**:

- one or more **steps**;
- for each step, one or more **roles** (Access Control roles), and whether **all** or **any one** of them must approve;
- optionally different chains per **classification** of the record (for example Normal / Urgent);
- an **on/off switch** per flow.

When a user submits a record, the engine finds the people who hold the step's roles, emails them, and moves the record step by step. When the last step approves, or anyone rejects, the engine calls the flow's card once and the card applies the result to the record.

Approvers are chosen **by role**, never picked by name on each record (product decision, 17-Nov-2026).

## 2. What is already in this branch

| Part | Where |
|---|---|
| Engine (unchanged copy of Technical's) | `server/v2/approval-engine/` (see its `VERSION.md`) |
| Database tables `apprv_*` | `migrations/0271_approval_engine_tables.sql` (runs per company database) |
| Crewing wiring (host layer) | `server/v2/approvals/` |
| Engine API | `/api/v2/approval-engine/*` |
| Crewing host routes | `/api/v2/approvals/*` (role approvers, email status, sample) |
| Admin screen | `client/src/modules/admin/ApprovalWorkflowPage.tsx` |
| Progress component for forms | `client/src/components/approvals/ApprovalChainProgress.tsx` |
| SES email option | `server/v2/shared/emailService.ts` (`sendEmailPreferSes`) |
| Sample card (template) | `server/v2/approvals/cards/sampleCard.ts` + `sampleRoutes.ts` |
| Tests | `server/v2/approvals/__tests__/`, run with `npx vitest run --config vitest.approvals.config.ts` |

How the wiring works (`server/v2/approvals/`):

- **Company (tenant):** the engine always uses the company of the current request (`tenantProvider.ts`). It refuses a call for another company.
- **Who is acting:** `user_uuid` and Access Control role of the signed-in user, taken **from the login token only** (`actor.ts`). Never from the request body.
- **Who approves:** `roles.ts` maps a role to users by role name (`adm_rolemaster_ac.assigned_role` = `master_users.role`).
  - Ship-type roles: only users assigned to the record's vessel (`master_users.vessel_ids`).
  - Office-type roles: all users with the role (office users are not assigned per vessel).
- **Who can change chains:** Access Control **edit** on the **Approval Workflow** menu. A role with no Access Control row is refused.
- **Emails:** `notifier.ts` sends "approval needed", "approved", "returned" and "withdrawn" emails.
  - It uses SES when the shared SES variables are set, otherwise the existing Crewing email path.
  - `APPROVAL_EMAILS_ENABLED=false` switches them off.
  - An email failure never blocks an approval.
- **Office only:** the engine never runs on a vessel server (`mount.ts`, `isShipInstance`). Today Crewing has no vessel server. When ship–office sync lands, plug its check in there.
- **Submit and decide only through the module:** the engine's generic HTTP submit/decide routes are closed. Each flow submits and decides through its own routes, so the module's checks always run first.

## 3. Connecting a flow — the three wiring points

### 3.1 Write a card

Copy `server/v2/approvals/cards/sampleCard.ts` to, for example, `server/v2/approvals/cards/portageCard.ts`, then:

1. **`moduleId`**: a stable id, for example `crewing-accounts`. It must never change once chains are saved.
2. **`scopes`**: one per action that needs approval, for example `{ screenId: 'portage-bill', actionId: 'submit', label: 'Portage bill', classifications: [...] }`.
   - Classification ids are stable keys and appear in saved chains.
   - Use a single classification (for example `'All'`) when the flow does not need different chains.
3. **`listRoles`**: return `listApprovalRoles()` (shared helper).
4. **`classify(ctx, scope, subject)`**: load the record and return one classification id.
   - Throw with `statusCode: 400` if the record is not in a state that can be submitted.
5. **`resolveApprovers(ctx, scope, roleId, subjectRef)`**: load the record's vessel (`vessel_uuid`), then return `resolveRoleApproverUserIds(roleId, vesselUuid)`.
6. **`onDecision(ctx, notice)`**: apply `approved` or `returned` to the record **through the module's own repository**.
   - It must be **idempotent**: if the record is no longer "pending approval", do nothing. The engine calls it once, but a recovery replay can call it again.
7. **`describeSubject(scope, subjectRef)`** (optional): the record's name in emails, for example `Portage bill May 2026 — Vessel X`.

Then add the card to `server/v2/approvals/cards/index.ts`. A card that fails the engine's checks stops the server from starting.

### 3.2 Submit (in the module's existing submit service)

```ts
import { submitForApproval, scopeFor } from "../approvals/gateway";

// 1. the module's own checks first (permission, vessel scope, required fields, state)
// 2. then:
const outcome = await submitForApproval(req, {
  scope: scopeFor("crewing-accounts", "portage-bill", "submit"),
  subjectRef: bill.billUuid,           // the record's stable uuid
  subject: { billUuid: bill.billUuid },  // whatever classify needs
  vesselId: bill.vesselUuid,
});
switch (outcome.outcome) {
  case "STARTED":         /* set the record to "pending approval" */ break;
  case "ALREADY_PENDING": /* tell the user it is already waiting */ break;
  case "NO_WORKFLOW":
  case "DISABLED":        /* today's behaviour, exactly as before */ break;
}
```

### 3.3 Decide (in the module's existing approve/reject service)

```ts
import { pendingRequestFor, decideApproval, scopeFor } from "../approvals/gateway";

const scope = scopeFor("crewing-accounts", "portage-bill", "submit");
const pending = await pendingRequestFor(req, scope, billUuid);
if (pending) {
  // Engine first. The engine checks the user is an approver of the active step;
  // the card's onDecision applies the final result.
  await decideApproval(req, pending.requuid, approve ? "approve" : "reject", remarks);
  return;
}
// No engine request for this record: today's behaviour, unchanged.
```

Errors from the engine carry an HTTP status. `approvalErrorStatus(err)` returns it, for example 403 when the user is not an approver, or 409 when the record was already decided.

### 3.4 Show progress on the form

```tsx
import { useApprovalChain, ApprovalChainProgress } from "@/components/approvals/ApprovalChainProgress";

const chain = useApprovalChain({ moduleId: "crewing-accounts", screenId: "portage-bill", actionId: "submit", subjectRef: bill.billUuid });
<ApprovalChainProgress chain={chain} />
{chain.hasChain ? chain.canDecide && <ApproveRejectButtons /> : <TodaysButtons />}
```

The component fails soft: with no chain it shows nothing and the screen behaves as today.

## 4. Rules

1. **Never edit `server/v2/approval-engine/`.** Changes go to the Technical module first; then the folder is copied again and `VERSION.md` updated.
2. **The fallback must be byte-identical.** `NO_WORKFLOW` and `DISABLED` must leave the flow exactly as it is today.
3. **Module checks run before `submitForApproval`.** The engine does not know Crewing's business rules.
4. **The actor comes from the login token.** Never read the user, the role or the approver from the request body.
5. **`onDecision` is idempotent** and writes only through the module's own repository.
6. **The `apprv_*` tables are never synced** to vessels. Do not add them to any sync configuration.
7. **Do not touch Crewing sync code** (`server/v2/sync/`, the `crew_offline` work) without Ghazi.
8. **Migrations:** next free number, idempotent, no hardcoded ids, run twice to prove it.
9. **Before every push:**
   - `npx vitest run --config vitest.approvals.config.ts` passes;
   - `grep -c package-firewall.replit package-lock.json` prints `0`.

## 5. Done checklist (per flow)

1. Card registered; the server starts; the flow appears in Admin → Approval Workflow.
2. With **no chain** saved: submit and approve behave exactly as before.
3. With the flow **switched off**: the same.
4. One-step chain: submit → the approver gets the email → approve → the record is approved, once.
5. Reject: the record is returned with the remarks; the submitter gets the email.
6. Two-step chain: the second step's approvers cannot act until the first step approves.
7. A user who does not hold the step's role gets 403.
8. Approving an already decided record gets 409 and changes nothing.
9. Ship role: only users assigned to the record's vessel are approvers.
10. A second company sees none of the first company's chains or requests.
11. Tests added under `server/v2/approvals/__tests__/` for the card.

## 6. Crewing flows and suggested order

From the 13-Nov investigation (code read on `crew_dev` 030155cf; re-check before building each flow):

| Order | Flow | Records today | Notes |
|---|---|---|---|
| 1 | Accounts: portage bill | `acc_portage_bills_v2`, `acc_portage_approvals_v2` | Office only, has `vessel_uuid`. Today approvers are typed names, all must approve |
| 2 | Accounts: settlements | `acc_settlements_v2`, `acc_settlement_approvals_v2` | Same shape as portage |
| 3 | Promotions | `promotion_reviews_v2`, `promo_approvals_v2` | Today picked users, no server check, approvals rewritten on save |
| 4 | Appraisals (office review) | `appraisal_results_v2`, `appr_office_reviews_v2` | Fixed 3 stages today |
| 5 | Recruitment C1 approvals | `cand_approvals` | Rows written by the browser today: needs a server gate |
| 6 | Rest hours office review | `rh_vessel_records_v2` | Fixed vessel → office steps |
| 7 | Rotation deploy/reject | `rotation_drafts_v2`, `rotation_entries_v2` | Per entry |

Company form signatures already have their own role-based model. **Leave them as they are.**

Today's approver rows (typed names, picked users) stay read-only for history. New chains are configured fresh in Admin → Approval Workflow.

## 7. Worked examples in the Technical module

- `server/modules/approvals/approvalCard.ts`: Technical card (6 scopes, role resolution).
- `server/modules/defects/approvalCard.ts`: a second, smaller card.
- `server/modules/defects/services/defectsApprovalHooks.ts`: the submit and decide gates in a module service.
- `server/modules/approval-engine/INTEGRATION-GUIDE.md` (also in this repo under `server/v2/approval-engine/`): the engine's own guide, including the 9-point checklist.

## 8. Settings

| Variable | Purpose |
|---|---|
| `AWS_SES_REGION` (or `APPROVAL_SES_REGION`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `APPROVAL_EMAIL_FROM` (or `SUPPORT_EMAIL`) | The shared SES settings, the same names and values as the other SAIL modules. When all are set, approval emails go through SES |
| `APPROVAL_SMTP_JSON=1` | Test mode: approval emails are logged, not sent |
| `APPROVAL_EMAILS_ENABLED=false` | Switch approval emails off |
| `APPROVAL_ENGINE_SAMPLE_CARD=true` | Register the sample card (local and test servers only) |

Values are set on each server. They never go in the repository.

## 9. Known points

1. The copied admin screen asks a Technical address (`/technical/api/approvals/role-approvers`) for "who holds this role". In Crewing that lookup does not reach Crewing, so the saved chain shows "could not load the approvers" next to each role. The chain itself works. Fix: make that address a setting of the admin screen in the Technical module, then copy the engine again. Crewing already serves the lookup at `/api/v2/approvals/role-approvers`.
2. A Ship-type role resolves only to users assigned to the record's vessel. A record with no vessel has no Ship-role approver. The engine reports such a step as stuck, and only an admin can decide it.
3. Approvals raised on a vessel will need the "arrival sweep" pattern from the engine guide (§3c) once Crewing ship–office sync is live. Agree it with the sync owner first.
