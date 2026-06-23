# Accounts (Payroll) Module — V1 → V2 Migration Comparison

This document compares the legacy "Accounts" payroll implementation with the
native V2 Accounts module rebuilt under `server/v2/accounts/`.

## Summary

The Accounts module was rebuilt as a fully native V2 module: multi-tenant,
persisted, audited, and following the Repository → Service → Controller pattern
with **zero V1 dependencies**. The frontend was rewired to the new
`/api/v2/accounts/*` endpoints.

## Architecture Comparison

| Concern | V1 (legacy) | V2 (native) |
|---|---|---|
| Data access | `server/storage-accounts.ts` (monolithic storage) | Repository layer per entity under `server/v2/accounts/repositories/` |
| Business logic | Mixed into storage/routes | Service layer under `server/v2/accounts/services/` |
| HTTP layer | Inline route handlers | Thin controllers under `server/v2/accounts/controllers/` |
| Routing | Shared/legacy routes | `server/v2/accounts/routes.ts`, mounted at `/api/v2/accounts` |
| Tenancy | Global / single connection | `getDb()` from AsyncLocalStorage (tenant per request) |
| Auth | Ad hoc | `tenantMiddleware` + `authMiddleware` |
| Identifiers | Serial numeric `id` | Serial `id` + business `*_uuid` (stable external key) |
| Foreign keys | Numeric id references | UUID-based references (joins on `*_uuid`) |
| Auditing | None / partial | Shared `auditColumns` (created/updated by/at, soft delete, sync) |
| Soft delete | Hard delete | `is_deleted` flag everywhere |
| Validation | Manual | drizzle-zod insert schemas |

## Data Model (V2)

Six tables under `shared/v2/accounts/schema.ts`, all with `serial id` + business
`*_uuid` (notNull, unique), UUID-based FKs, and shared `auditColumns`:

1. `acc_pay_elements_v2` — Rate Tables & Rules master library.
2. `acc_contracts_v2` — per-crew payroll contract (draft/active).
3. `acc_contract_pay_elements_v2` — inherited + custom pay elements on a contract.
4. `acc_allotments_v2` — crew allotments.
5. `acc_advances_v2` — crew advances.
6. `acc_bond_items_v2` — bond (slop chest) purchases.

## Inheritance Model

When contract data is requested for a crew member
(`GET /api/v2/accounts/contract-data/:crewUuid`), the service finds-or-creates a
draft contract for the crew member + vessel group and inherits every pay element
flagged `reflectInContract = true` from the master library into the contract
(`syncInheritedElements`). Custom (per-contract) pay elements coexist with
inherited ones and can be toggled/valued independently.

## API Surface (V2)

All endpoints are tenant-scoped and audited:

- `pay-elements` — full CRUD (master library)
- `contract-data/:crewUuid` — resolve contract + inherited earnings/deductions
- `contracts/:uuid/status`, `contracts/:uuid/effective-date` — contract updates
- `contract-pay-elements` — create/update/delete (custom + applicability/value)
- `allotments`, `advances`, `bond-items` — full CRUD + `/crew/:crewUuid` filter

## Frontend Rewire

The existing Accounts UI was repointed to V2 with no behavioral change:

- `client/src/stores/contractDataStore.ts` — V2 types + UUID identity, V2 URLs.
- `client/src/hooks/usePayrollData.ts` — V2 contract-data, crew pool, sub-ledgers.
- `client/src/modules/accounts/contract-data/ContractDataWorkspace.tsx` — UUID
  handler signatures, crew list sourced from `/api/v2/crew-pool/crew`.
- `client/src/modules/accounts/wage-accounts/RateTablesRulesWorkspace.tsx` —
  pay-element CRUD against `/api/v2/accounts/pay-elements` (records mapped so the
  component continues to key off `id` = `payElementUuid`).

All calls flow through `tenantFetch` (auto-injects `x-tenant-id` + Bearer token).

## RBAC

`migrations/0139_add_account_rbac_menus.sql` seeds the "Account" top-level menu
and eight submenus. Administrators must grant access; the menu is registered but
not auto-granted.

## Seed Data

`migrations/0140_seed_accounts_pay_elements.sql` seeds a standard maritime set of
earnings and deductions into `acc_pay_elements_v2`, idempotent per tenant (each
row guarded by a `NOT EXISTS` check on `code`).
