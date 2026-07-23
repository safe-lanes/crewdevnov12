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

### 3a. Client onboarding: grant Accounts menus via the Access Control UI

The RBAC seed migrations (0141/0155/0158/0160/0162/0164/0166) copy each
role's grant on the top-level `Account` menu. **Ship-roletype roles are
excluded from the office-menu seeds** (`adm_rolemaster_ac.roletype = 'Ship'`),
so vessel roles can never inherit office payroll menus from a drifted
`Account` grant. On a tenant where no role has
that grant yet (e.g. a fresh tenant), **no Accounts rows are seeded at all**
— every role sees no Accounts menus until grants are applied manually. Apply
them through the Access Control admin UI as part of client onboarding:

1. Log in as an admin user and open the **Crewing** app switcher (top-left).
2. Go to **Admin** (the admin module) → in the left sidebar click
   **Access Control**.
3. In the **Roles** list (left panel) click the role to configure
   (e.g. `Admin`).
4. In the menu tree (right panel) scroll to the **Account** parent row and
   expand it with the chevron. All 14 Accounts child menus appear under it
   (15 total including the `Account` parent):
   Payroll Run, Portage Bill, Monthly Transactions, Settlements,
   Vessel Portage, Allotments, Cash & Bond, Payslips, GL Export,
   Fleet Summary, Pay Elements, Wage Scales, CBA Reference,
   Tenant Configuration.
5. Tick the permission checkboxes per menu (`View` / `Create` / `Edit` /
   `Delete`), or use the row's **Select All** checkbox.
6. Click **Save Changes** (bottom-right). Repeat steps 3–6 for each role.

Reference policy (as applied on the dev tenant):

| Role | Grant |
| --- | --- |
| Admin, Super Admin, Sail Admin | Full (V/C/E/D) on `Account` + all 14 sub-menus |
| User | View only on `Account` + all 14 sub-menus |
| Vessel Admin, Vessel User, Vessel User 2–4 | View on `Account`; View/Create/Edit on `Account Vessel Portage`; nothing else |
| External 1–5 | No grants (no Accounts menus visible) |

Note: a role needs **View on the top-level `Account` menu** for the Accounts
module entry to appear at all, plus View on each sub-menu it should reach.

Segregation of duties (server-enforced, independent of menu grants): the
portage and settlement approval decision endpoints reject Ship-identity
callers (403), a pre-assigned approver slot (`approver_id`) can only be
decided by that approver, an unassigned (free-text) slot is claimed by the
office user who decides it, and one user can never satisfy two approver
slots on the same portage bill or settlement.

### 3b. Post-seed review

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

### 3c. Dev verification with scoped AUTH_BYPASS (no parent-app login)

In development there is no parent app to issue signed JWTs. With
`AUTH_BYPASS=true` and `JWT_SECRET` unset, the backend accepts an **unsigned**
Bearer token and decodes it without verification (dev-only impersonation;
never active in production). This "scoped bypass" lets you exercise the real
RBAC + vessel-scope code paths as any role. **Production guardrail:** never
set `AUTH_BYPASS` or leave `JWT_SECRET` unset outside local development.

1. **Backend, as a Vessel User (Ship)** — build an unsigned JWT
   (`base64url(header).base64url(payload).x`) with payload:

   ```json
   {
     "userId": "dev-test",
     "role": "Vessel User",
     "roleId": "<ruid of Vessel User>",
     "userType": "Ship",
     "vessels": ["<vessel-uuid>"]
   }
   ```

   Send it as `Authorization: Bearer <token>` with `x-tenant-id`. Expected:
   - `GET /api/v2/admin/access-control/my-permissions?roleId=<ruid>` returns
     `canview: true` only for `Account` and `Account Vessel Portage`.
   - `GET /api/v2/accounts/vessel-portage/<own-vessel-uuid>/<period>/status`
     → 200; the same call for any other vessel uuid → 403 (fail-closed).
   - An object-shaped `vessels` entry (`[{"vesselId": …}]`) → 403 — the claim
     must be plain string UUIDs (see §1).
   - A no-grant role (e.g. `External 1` roleId) gets `canview: false` on all
     15 Accounts menus.

2. **Frontend persona switching** — with `VITE_AUTH_BYPASS=true`, use the
   **dev persona switcher** in the header (amber "DEV" button next to the
   notification bell). It replaces the old console `localStorage.userProfile`
   snippet: selecting a persona atomically writes both the simulated
   `userProfile` (read by the UI) and an unsigned dev Bearer token (sent by
   API calls so the backend's bypass decode path sees the same identity),
   then reloads. Personas: Sail Admin (default — clears the override), Admin,
   User, Vessel Admin, and Vessel User (the ship personas have a vessel
   sub-selector; the last-used vessel is remembered). Role ruids are resolved
   live from the access-control roles master by name; if a persona's role
   name has no active row in the tenant, the persona is disabled with a
   "role not found in this tenant" warning (never substituted).

   Expected for Vessel User: the Accounts sidebar shows **only Vessel
   Portage**, fixed to the selected vessel, and a vessel-portage API call for
   any other vessel returns 403. Selecting **Sail Admin** reverts to the
   default (full menus).

   The switcher is compiled out of production builds (guarded by the
   build-time `import.meta.env.VITE_AUTH_BYPASS === "true"` check) and is
   inert at runtime without the flag. Production identity comes solely from
   real parent-app login credentials.

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
