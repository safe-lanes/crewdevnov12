# Changes 13 — Cross-Section Period Overlap Validation (E1 + E2)

## Summary
Added frontend-only pairwise period overlap validation in `handleSaveDraft`. When the user saves the crew form, all E1 (Company Sea Service) and E2 (External Sea Service) rows are checked against each other for overlapping date ranges. If any overlap is detected, save is blocked with a clear validation message.

---

## Frontend Changes

### `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`

#### Location
Inserted immediately after the existing mandatory field validation guard (the `seaServiceErrors` block), before the `const dataWithPhoto = ...` line.

#### Algorithm
1. All E1 and E2 rows are combined into a single pool, filtered to only rows that have a `from`/`fromDate` value.
2. A pairwise double-loop (`i < j`) compares every unique pair of rows.
3. For each pair:
   - `aFrom` / `bFrom` — the start date of each row (`from` or `fromDate`)
   - `aTo` / `bTo` — the end date of each row (`to` or `toDate`); if empty/null, treated as `null` (open-ended, extending indefinitely)
4. **No-overlap condition** (both must be false to conclude overlap):
   - `aTo !== null && aTo < bFrom` → A ends strictly before B starts
   - `bTo !== null && bTo < aFrom` → B ends strictly before A starts
5. If neither condition holds, the periods overlap → save is blocked immediately on the first detected overlap.

#### Open-Ended Period Handling
Rows with no `To Date` (crew currently onboard, active contract) are treated as extending infinitely into the future. They are **not** replaced with today's date. This correctly blocks any new entry that starts during an active contract's period, regardless of when today is.

**Example (as specified):**
- Contract: `2026-02-01` → `2026-02-28`; New entry: `2026-02-20` → `2026-02-25`
- `aTo(28 Feb) < bFrom(20 Feb)`? No. `bTo(25 Feb) < aFrom(1 Feb)`? No. → **Overlap detected, save blocked.**

**Active contract (open-ended):**
- Contract: `2026-02-01` → `null`; New entry: `2026-02-20` → `2026-02-25`
- `null → skip first condition`. `bTo(25 Feb) < aFrom(1 Feb)`? No. → **Overlap detected, save blocked.**

**Non-overlapping (correctly allowed):**
- Entry A: `2026-01-01` → `2026-01-31`; Entry B: `2026-03-01` → `null`
- `aTo(31 Jan) < bFrom(1 Mar)`? Yes. → **No overlap, save proceeds.**

#### Validation Toast
```
title: "Validation Error"
description: "Sea service already exists for the selected period."
variant: "destructive"
```

---

## Behavior Rules
- Applies to all rows: manual, DB-backed, and auto-synced (vessel tab) rows alike.
- Cross-section: an E1 row and an E2 row can conflict with each other.
- Within-section: two E1 rows or two E2 rows can conflict with each other.
- Open-ended active contracts (null To Date) block any overlapping new entry.
- Rows with no From Date are skipped (those are already caught by the mandatory field check above).
- The first detected overlap blocks save immediately; no further pairs are checked.
- Mandatory field validation fires before overlap validation (existing behavior unchanged).
- No backend changes — purely frontend validation on in-memory form state.
