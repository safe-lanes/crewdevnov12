# Approval engine — rules for the Replit agent

Paste this section into the Replit project's `replit.md` (or the agent's project memory) before asking the agent to work on approvals. The full guide is `docs/APPROVAL-ENGINE-CREWING.md`.

```text
## Approval engine (Crewing) — mandatory rules

1. NEVER edit any file in server/v2/approval-engine/. It is a copy of the Technical module's engine (see its VERSION.md). If the engine itself needs a change, stop and tell the user: it is changed in Technical first and copied again.
2. Crewing wiring lives in server/v2/approvals/. Module code uses ONLY server/v2/approvals/gateway.ts (submitForApproval, pendingRequestFor, decideApproval, scopeFor). Never import from server/v2/approval-engine/ in module code.
3. A new flow = a new card in server/v2/approvals/cards/ (copy sampleCard.ts) added to cards/index.ts. Approvers are ROLES (listApprovalRoles / resolveRoleApproverUserIds). Never add per-record picked approvers.
4. The module's own checks (permission, vessel scope, required fields, record state) run BEFORE submitForApproval.
5. When submitForApproval returns NO_WORKFLOW or DISABLED, the flow must behave EXACTLY as it does today. Do not change today's behaviour for that case.
6. The user, role and approver ALWAYS come from the login token (req.user via gateway.ts). Never read a user id, user uuid, role or approver from the request body or query.
7. onDecision must be idempotent (do nothing if the record is no longer pending approval) and must write only through the module's own repository.
8. The apprv_* tables and approval_notifications_v2 are office-only and NEVER synced to vessels. Do not add them to any sync configuration.
9. Do not touch server/v2/sync/ or any ship–office sync code.
10. Do not reopen the engine's HTTP submit/decide routes (closed in server/v2/approvals/mount.ts). Flows submit and decide through their own routes.
11. Migrations: next free number in migrations/, CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, no hardcoded ids, safe to run twice.
12. Before every commit and push:
    - npx vitest run --config vitest.approvals.config.ts must pass;
    - grep -c package-firewall.replit package-lock.json must print 0 (Replit's private mirror must never be in the lockfile).
13. Commit only. Do not push unless the user explicitly says "push".
```
