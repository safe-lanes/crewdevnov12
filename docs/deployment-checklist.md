# Deployment Checklist — Vessel Submission Package & CTM

Checklist for rolling out the vessel-side monthly submission package
(Accounts → Vessel Portage) to a production tenant.

## 1. JWT `vessels` claim (required for Ship users)

Vessel ("Ship") users are scoped to their own vessel(s) through the JWT issued
by the parent app (SAIL Audits). Before go-live, confirm the parent app includes
the vessel assignment claim in the token payload as a **plain array of vessel
UUID strings**:

```json
{
  "userType": "Ship",
  "vessels": ["<vessel-uuid>"]
}
```

- Each entry must be the **vessel UUID** used by the Accounts module (the same
  UUID used in `acc_vessel_portage.vessel_uuid`). Objects such as
  `{ "vesselId": … }` are **not** accepted by the backend actor scope — only
  string entries are read; non-string entries are ignored (fail-closed).
- The backend derives the actor's vessel scope from this claim
  (`server/middleware` auth → actor context). A Ship user without a `vessels`
  claim cannot open or submit a vessel package (403).
- Note: the frontend `userProfile.myVessels` (used for display) is a separate,
  object-shaped channel and is unrelated to this claim's format.
- Office users (`userType` ≠ "Ship") are not vessel-scoped and require no claim.

## 2. Database migrations

Migrations auto-run per tenant on first connection. Verify after deploy:

- `0161_*` — vessel portage submission + CTM tables (`acc_ctm_accounts`,
  `acc_ctm_lines`, txn review columns `origin` / `review_comment`, etc.).
- `0162_vessel_portage_rbac.sql` — registers the "Account Vessel Portage" menu
  and seeds role access by copying each role's grant on the top-level
  `Account` menu.

Check the startup log for `Applied: 0161…` / `0162…` / `0163…` / `0164…`
(or `Skipped` when already applied) on every tenant.

## 3. RBAC review

- Roles that should NOT see the vessel workspace: remove their
  `Account Vessel Portage` row in role access (Admin → Roles) after the seed.
- Ship-role users need at least **view + create + edit** on
  `Account Vessel Portage` to enter variables and submit the month.
- Office reviewers need **edit** on `Account Monthly Transactions`
  (accept / reject / re-open) and on `Account Vessel Portage`
  (return-to-vessel).
- Crew-finance pages (migration 0164): `Account Allotments` and
  `Account Cash & Bond` are seeded by copying each role's top-level `Account`
  grant. Review after the seed and remove/trim rows for roles that should not
  manage crew finance (office-only pages; ship roles normally need no access).
- `acc_tenant_config_v2.max_allotment_percent` (migration 0163) is NULL by
  default = **no cap** on percentage allotments. Set it per tenant (e.g.
  `80.0`) if the office wants allotment percentage caps enforced on
  create/edit.

## 4. Environment

- `AUTH_BYPASS` / `VITE_AUTH_BYPASS` must be **unset or false** in production.
- Multi-tenant: `MASTER_DATABASE_URL` set; single-tenant: `DATABASE_URL` only.

## 5. Currency

v1 operates single-currency per tenant — all wage scales and engagements must use the tenant functional currency; mixed currencies compute at 1:1 and will misstate totals.

## 6. Smoke test (per tenant)

1. Log in as a Ship user → Accounts → Vessel Portage: vessel is fixed to the
   JWT vessel, period defaults to the current month.
2. Add a crew variable entry (draft) and a CTM expense line; verify CTM
   closing recomputes.
3. Submit the month → status `submitted`; package becomes read-only on the
   vessel side.
4. As office: Monthly Transactions → filter Origin = Vessel, Status =
   Submitted → Accept one entry, Reject one with a comment.
5. As office: Return the month to the vessel → status `returned`; rejected
   entry shows the office comment on the vessel page.
6. Payroll Run Step 1 shows the vessel package status badge with counts.
