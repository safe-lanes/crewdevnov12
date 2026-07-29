# Accounts Module — Manual Test Script (v2)
## Vessel 04 · March–April 2026 · End-to-end verification

| | |
|---|---|
| **Purpose** | Verify the entire Accounts module end-to-end: tenant configuration, pay elements (standard seed + manual), wage scales, CBA floor violation, engagement sync, vessel-side monthly entry with save mechanics, Cash-To-Master (CTM), office review, office money screens, wage calculation, contract pay items, payment-timing override, allotment suspension, approvals & locking, portage bill, a second month with a mid-month wage step, sign-off, final settlement lifecycle, and reports. |
| **Build under test** | Development build served by the "Start application" workflow (port 5000). Record the git commit hash on the sign-off sheet before starting. |
| **Script date** | 29 July 2026 |
| **Estimated time** | 6–8 hours for one careful pass (Phases A–O). Natural break points: after Phase K (March locked) and after Phase N (settlement). |
| **Audience** | Manual testers. **No maritime or payroll knowledge is required.** Every term is defined in the Glossary; every value to type is given exactly; every expected figure is pre-computed in Appendix A. |
| **Recording results** | Print or copy this document. For each step, tick Pass/Fail and note anything unexpected in the Notes column. Use the Defect Report Template at the end for every Fail. |

### Verification status — read before testing

Every money figure, warning count, and error message in this script was re-verified against the live calculation engine on **29 July 2026** (full API-level walkthrough after a clean reset). Markers used throughout:

- **✅ (unmarked rows)** — the action, figure, or message was verified hands-on against the live system. Text in `"double quotes"` is the literal message produced by the system; expect it verbatim.
- **⚠** — the step could not be verified hands-on. Treat small wording/layout differences as a Note, not a Fail, as long as the meaning and figures match. The ⚠ steps fall into these groups:
  1. Exact on-screen wording, layout, badges, and button labels that only exist in the browser UI (the walkthrough verified the underlying behavior and figures via the API).
  2. Print/PDF export appearance.
  3. Permission checks that depend on the persona switcher UI (`AUTH_BYPASS`), including O7–O9.
- **[NEG]** — a negative test: the expected result is a refusal or error. A [NEG] step *passes* when the system refuses.

---

## Glossary — read this first

| Term | Plain-English meaning |
|---|---|
| **Tenant** | Your company's own workspace inside the app. "Tenant configuration" = company-wide settings. |
| **Vessel** | A ship. Each vessel keeps its own monthly wage records. This test uses the vessel pre-loaded in the system as **"vessel 04"**. |
| **Crew / Rank** | Crew = the people working on a ship. Rank = their job title (e.g. Master = the captain; Chief Officer = second in command; Able Seaman = an experienced deckhand). |
| **Engagement** | One person's employment contract on one vessel, with a start (sign-on) and end (sign-off) date. |
| **Sign-on / Sign-off** | The day a crew member starts / stops working aboard. |
| **Pay element** | One building block of pay, e.g. "Basic Wage" or "Allotment". Each is an *earning* (money to the crew) or a *deduction* (money withheld). |
| **Wage scale** | A price list: for each rank, the monthly amount of each pay element. |
| **Year-step / Seniority step** | A pay rise after serving a defined time in the rank (Year 1 rate → Year 2 rate). |
| **CBA** | Collective Bargaining Agreement — a union contract that sets **minimum** wages. The app warns when a wage scale pays below a CBA minimum ("floor violation"). |
| **Proration** | Paying part of a monthly amount when someone works only part of the month. This app is configured for a **30-day month**: a full month always counts as 30 days, no matter the calendar. |
| **Portage bill** | The vessel's monthly wage summary: one row per crew member with earnings, deductions and net pay. |
| **Monthly transaction** | A single one-off money line for one crew member in one month (e.g. overtime hours, a cash advance). |
| **Overtime — fixed vs variable** | Fixed overtime = a flat monthly allowance (GOT). Variable overtime = extra hours × an hourly rate (OT). |
| **Allotment** | A standing instruction to send part of the wage to a family member's bank account ashore. |
| **Cash advance** | Wages paid early, in cash, on board. Deducted from that month's pay. |
| **Advance (office) & recovery** | A loan arranged by the office, paid back ("recovered") in monthly instalments withheld from pay. |
| **Bond / Slop chest** | The ship's small onboard shop (cigarettes, chocolate, etc.). Purchases are deducted from pay. |
| **CTM** | Cash To Master — the box of physical cash the captain holds. Cash advances paid on board reduce it; expenses paid from it reduce it too. |
| **Contract pay item** | A per-contract override of the wage scale for one crew member: add an extra element, replace a scale value, or suppress an element. |
| **Payment timing** | When an element is actually paid: on board monthly, or accrued and paid at settlement. Can be overridden per contract. |
| **Net on board** | What the crew member is actually owed for the month: on-board earnings minus deductions. |
| **Leave pay / Settlement accrual** | Money earned monthly but **only paid at the end of the contract** (at settlement). It accrues in a side balance. |
| **Balance B/F and C/F** | Brought Forward / Carried Forward — the running unpaid balance entering / leaving the month. |
| **Settlement** | The final pay-off when a contract ends: unpaid balances + accrued leave ± adjustments. |
| **GL export** | An accounting report where every amount becomes a debit (DR) or credit (CR) per General Ledger account code. Total DR must equal total CR. |
| **Calc run** | Pressing "Run Calculation": the engine computes every wage line for a vessel-month. |
| **Locking** | After final approval a month becomes read-only ("locked"). Nothing in it can change. |
| **Seniority anchor** | The date a crew member started in their current rank. Needed to determine which "Year 1 / Year 2" pay rate applies. The office must confirm it before the engine can use the correct step. |

---

## Prerequisites

| # | Action | Expected result |
|---|---|---|
| P1 | Confirm the application is running: open the app preview URL (dev server, port 5000). | The login/landing page loads without errors. |
| P2 | Confirm you are on a **development** environment with the developer persona switcher available (`AUTH_BYPASS=true`). Look for a round **user icon** at the right end of the top navigation bar. | Clicking it opens a persona menu with **Office** personas (Sail Admin, Admin, User) and **Ship** personas (Vessel Admin, Vessel User). |
| P3 | **Clean state.** Run `npx tsx scripts/reset-accounts-data.ts --confirm` in the workspace terminal. It wipes **only** Accounts data (pay elements, scales, engagements, ledger lines, etc.) and resets tenant config to defaults. Crew, vessels and assignments in the main system are untouched. | Script prints per-table row counts and completes without errors. Running it a second time immediately prints all zeros. If it refuses with a production guard, verify `NODE_ENV` is not `production`. |
| P4 | The Accounts module is reached via the **Module Navigator** (grid icon in the top bar) → **Accounts**. Open it once now. | ⚠ Accounts sidebar appears. It contains (among others) **Payroll Run**, **Vessel Portage**, **Contracts**, Monthly Txns, Portage Bill, Settlements, Allotments & Cash; a **Reports** group (Payslips, GL Export, Fleet Summary); and a **Config** group (Pay Elements, Wage Scales, CBA Ref, Tenant Config). |
| P5 | Confirm **vessel 04** exists. In the Module Navigator go to Vessels (or Crewing → Vessels). | A vessel named "vessel 04" is listed. |

### Persona-switch guide

Switch personas using the round user icon (P2). When you pick a **Ship** persona you must also choose the vessel — always choose **vessel 04**. Ship personas navigate to the monthly entry screens via **Accounts → Vessel Portage** (the sidebar has separate "Payroll Run", "Vessel Portage", and "Contracts" items).

| Phase | Persona |
|---|---|
| A–F | Office — **Sail Admin** |
| G | Ship — **Vessel Admin** (vessel 04) |
| H–J, J2 | Office — Sail Admin |
| K | Office — Sail Admin (submit) + Office — **Admin** (approve); auto-lock fires on approval |
| L | Office — Sail Admin |
| M | Ship — Vessel Admin (April entry); then Office — Sail Admin (April stays **unlocked** until N6) |
| N | Office — Sail Admin (+ Office — Admin for the settlement approval **and** the April portage approval in N6) |
| O | Office — Sail Admin; permissions test as Ship — Vessel User |

### The working-set crew (the five crew members you will track closely)

Vessel 04 has **26 active crew** in March 2026. This script focuses on five of them ("the working set") because they cover every pay feature. The other 21 appear only in the warning tally (Appendix C). All five are pre-loaded; do **not** create new crew members.

| Code | Name | Rank | Sign-on | Sign-off |
|---|---|---|---|---|
| V1 | SANJAY VERMA | Master | 01-Mar-2026 | — |
| V2 | IVAN JURIC | Chief Officer | 01-Mar-2026 | — (Year 2 step 16-Apr-2026) |
| V3 | AMIT SHARMA | Able Seaman | 07-Mar-2026 | — |
| V4 | DMITRIY SOKOLOV | Able Seaman | 07-Mar-2026 | 20-Apr-2026 (recorded on board in Phase G) |
| V5 | MANOJ REDDY | Able Seaman | 07-Mar-2026 | — |

---

## Phase A — Tenant configuration (Office / Sail Admin)

Menu: **Accounts → Config → Tenant Config**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| A1 | Open Tenant Config. | ⚠ A settings form loads showing preparation mode, proration basis, day inclusion rule, functional currency, FX policy, GL wages payable account, max allotment percent, auto-lock, and vessel entry tab slots. | | |
| A2 | Set **Preparation mode** = `Vessel prepares`, **Proration basis** = `30-day month`, **Day inclusion rule** = `Both inclusive`, **Functional currency** = `USD`. | Values accepted. **The 30-day-month proration basis is essential — every figure in Appendix A assumes it.** | | |
| A3 | Set **GL wages payable account** = `3000`, **Max allotment percent** = `80`, **Auto-lock on approval** = ON. Save. | A success message; reopening the page shows the saved values. | | |
| A4 | Leave **Vessel entry tab 1** disabled for now (you will enable it in B6 after the COMM element exists). | — | | |
| A5 | ⚠ [NEG] Enable Vessel entry tab 1 with a label but **no pay element selected**, then try to save. | Refused with a validation error (an extra tab requires a bound pay element). Disable the tab again and save successfully. | | |

---

## Phase B — Pay elements (Office / Sail Admin)

Menu: **Accounts → Config → Pay Elements**.

**B1 — Seed the standard elements.** Instead of typing every element by hand, use the built-in seed.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| B1 | Click **"Load standard maritime elements"** (the standard-seed action). | **11 elements** are created. Verify each against the reference table below. | | |
| B2 | Verify the seeded list matches this table (codes and types): | All 11 present, codes exactly as listed. | | |

| Code | Name | Type | Notes |
|---|---|---|---|
| BASIC | Basic Wage | Earning | scale lookup, prorated |
| GOT | Guaranteed Overtime | Earning | scale lookup, prorated |
| OT | Variable Overtime | Earning | rate × quantity, not prorated |
| LEAVE | Leave Pay | Earning | scale lookup, prorated, **payable at settlement** |
| SENIORITY | Seniority Bonus | Earning | posts 0.00 in this test (see Appendix B) |
| SUBS | Subsistence Allowance | Earning | posts 0.00 unless used as a pay item (J2) |
| UNION | Union Dues | Deduction | posts 0.00 in this test (see Appendix B) |
| ALLOT | Allotment | Deduction | manual / standing |
| ADVANCE | Advance Recovery | Deduction | cash advances & office recoveries |
| BOND | Bond / Slop Chest | Deduction | onboard shop purchases |
| PF | Provident Fund (Employer) | Employer contribution | posts 0.00 in this test (see Appendix B) |

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| B3 | Add GL codes to the seeded elements (edit each element): BASIC `1000`, GOT `1100`, OT `1200`, LEAVE `1300`, SENIORITY `1400`, SUBS `1500`, UNION `2100`, ALLOT `2200`, ADVANCE `2300`, BOND `2400`, PF `2500`. | Each element saves with its GL code. | | |
| B4 | Manually create element `COMM` / **Radio / Telephone**: type **Deduction**, category **Communication**, calc method **Manual entry**, payment timing **Paid on board**, GL code `2600`. | Created. The calc method **must** be Manual entry — the extra vessel tab (B6) only accepts manual-entry / rate×qty elements. | | |
| B5 | Manually create element `OTHD` / **Other Deduction**: type **Deduction**, category **One-off**, calc method **Manual entry**, payment timing **Paid on board**, GL code `2700`. | Created. (Used only as a settlement adjustment in Phase N.) | | |
| B6 | Return to **Tenant Config**; enable **Vessel entry tab 1** with label `Radio / Telephone` bound to element `COMM`. Save. | Config saved; reopening shows the extra tab configured. | | |
| B7 | [NEG] Try to create another element reusing code `BASIC`. | Refused: `A pay element with code "BASIC" already exists`. | | |

---

## Phase C — Wage scale (Office / Sail Admin)

Menu: **Accounts → Config → Wage Scales**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| C1 | Click **New Wage Scale**. Enter name `VESSEL 04 SCALE 2026`, currency `USD`, effective from `2025-01-01`, scope fleet-wide (no specific vessel type/group). Save. | Scale is created in **Draft** status. **The 2025-01-01 effective date is now a choice, not a requirement**: several vessel-04 crew signed on in mid-2025, and the sync used to refuse engagements whose sign-on predates every active scale. Since 29-Jul-2026 the sync instead attaches the earliest applicable active scale and reports a warning per affected crew. If you use a later date (e.g. 2026-01-01), E1 additionally shows **5** "sign-on … predates every wage scale" sync warnings (re-verified: all engagement counts, run warning counts — 47/21 March, 19 April — and Appendix A figures are unchanged, since the scale still covers the 2026-03/04 test months). Keep 2025-01-01 to follow this script verbatim with no extra warnings — and note D1 still requires the CBA effective date to be on or before the scale's effective-from. | | |
| C2 | Add all 16 lines from the table below (rank + element + experience year + amount; OT lines take an hourly *rate* instead of a monthly amount). | After each save the line appears. Scale stays **Draft**. Total lines: 16. | | |

| Line | Rank | Rank code | Element | Year | Amount |
|---|---|---|---|---|---|
| 1 | Master | R001 | BASIC | Year 1 | `7000.00` |
| 2 | Master | R001 | GOT | Year 1 | `1400.00` |
| 3 | Master | R001 | OT | Year 1 | `17.50` /hr |
| 4 | Master | R001 | LEAVE | Year 1 | `700.00` |
| 5 | Chief Officer | R002 | BASIC | Year 1 | `5000.00` |
| 6 | Chief Officer | R002 | GOT | Year 1 | `1000.00` |
| 7 | Chief Officer | R002 | OT | Year 1 | `12.50` /hr |
| 8 | Chief Officer | R002 | LEAVE | Year 1 | `500.00` |
| 9 | Chief Officer | R002 | BASIC | **Year 2** | `5500.00` |
| 10 | Chief Officer | R002 | GOT | **Year 2** | `1100.00` |
| 11 | Chief Officer | R002 | OT | **Year 2** | `13.75` /hr |
| 12 | Chief Officer | R002 | LEAVE | **Year 2** | `550.00` |
| 13 | Able Seaman | R015 | BASIC | Year 1 | `3000.00` |
| 14 | Able Seaman | R015 | GOT | Year 1 | `600.00` |
| 15 | Able Seaman | R015 | OT | Year 1 | `7.50` /hr |
| 16 | Able Seaman | R015 | LEAVE | Year 1 | `300.00` |

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| C3 | ⚠ Spot-check: open the Chief Officer BASIC entries. | Two separate CO BASIC rows exist (Year 1 = 5,000 and Year 2 = 5,500). | | |

---

## Phase D — CBA reference, floor violation, and scale activation (Office / Sail Admin)

Menu: **Accounts → Config → CBA Ref**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| D1 | Create a CBA reference: name `ITF MINIMUM 2026`, effective from `2025-01-01`, floor: rank **Able Seaman (R015)**, element **BASIC**, minimum `3200.00` USD. Save. | Saved with 1 floor entry. **The CBA effective date must be 2025-01-01** (on or before the scale's effective date) — the floor check evaluates CBA references as of the scale's effective-from date. | | |
| D2 | Note for awareness: the scale has AB BASIC = 3,000 and the CBA minimum is 3,200 — a deliberate deficit of **200.00**. | — | | |

Menu: **Accounts → Config → Wage Scales** → open **VESSEL 04 SCALE 2026**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| D3 | [NEG] Click **Activate** *without* acknowledging the floor violation. | Refused: `Scale has lines below CBA minimums; acknowledge to activate anyway`. The violation detail is AB (R015) · BASIC · scale 3,000.00 · minimum 3,200.00 · deficit 200.00. | | |
| D4 | Activate again **with** the acknowledgement checked. | Scale status changes to **Active**. ⚠ Acknowledged-by / acknowledged-at are recorded. | | |
| D5 | [NEG] Attempt to activate the scale a second time. | Refused: `Only draft scales can be activated`. | | |
| D6 | [NEG] Overlapping scale: create a second scale `OVERLAP TEST 2026`, effective from `2026-06-01`, and add **one line** (AB / BASIC / `3300.00`). Then activate it (acknowledge if prompted). | Refused: `An active scale already exists for this vessel type/group with an overlapping effectivity period`. **The draft must have at least one line** — a line-less draft fails earlier with `Cannot activate a scale with no lines`. Delete the OVERLAP TEST draft afterwards. | | |

---

## Phase E — Engagement sync (Office / Sail Admin)

Menu: **Accounts → Payroll Run** → vessel 04 → period **2026-03** → Crew & Engagements.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| E1 | Click **Sync Engagements** for vessel 04, period 2026-03. | Result: **26 created, 0 errors, 3 skipped (no period overlap)**. The 3 skipped are assignments that ended before March 2026 (e.g. IRWAN SUBEKTI, signed off 28-Feb-2026) — correct behavior, see Appendix B. (With the recommended 2025-01-01 scale date there are **0** sync warnings; a later scale date adds pre-scale sign-on warnings, see C1.) | | |
| E2 | Scroll the engagement list. Confirm the five working-set crew appear with correct start dates (V1/V2: 01-Mar; V3/V4/V5: 07-Mar). | All five listed. Total 26 engagements (Appendix D). | | |
| E3 | Confirm engagements are linked to scale "VESSEL 04 SCALE 2026". | No "no scale" badge. (Some crew have ranks with no scale *lines* — that surfaces later as warnings, not as sync errors.) | | |
| E4 | [NEG] Run the sync a second time. | **0 created, 26 skipped (already exist)**. | | |

---

## Phase F — Seniority anchor warning sequence (Office / Sail Admin)

The engine cannot pick the Year 1 / Year 2 rate until the office confirms each crew member's seniority anchor. Until confirmed it runs on the Year 1 default and warns.

### F1 — First calculation run (47 warnings)

Menu: **Accounts → Payroll Run** → vessel 04 → **2026-03** → **Run Calculation**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| F1 | Run Calculation for March 2026. | Run completes with **47 warnings**: **26** seniority-anchor warnings + **21** no-scale-line warnings. | | |
| F2 | Confirm the 26 anchor warnings cover exactly the 26 engagements, and the 21 no-scale-line warnings match Appendix C (ranks with no lines in the scale). | ✓ Master, Chief Officer and Able Seaman crew have **no** no-scale warnings. | | |

### F2 — Bulk-confirm anchors for 25 crew, set V2 individually

Menu: **Accounts → Contracts** (or the Crew & Engagements list) → bulk selection.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| F3 | Select all **25** engagements **except IVAN JURIC (V2)** and apply **"Confirm seniority anchor (Year 1 default)"**. | 25 confirmed in one action; their anchor warnings clear. | | |
| F4 | Open IVAN JURIC's contract → Seniority section. Set the anchor so that **Year 2 starts 2026-04-16** (in-rank since `2025-04-16`; next step date `2026-04-16`). Save. | Saved; V2's anchor warning clears. Next step date shows 16-Apr-2026. | | |

### F3 — Second calculation run (21 warnings)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| F5 | Run Calculation again for March 2026. | **21 warnings** — 0 anchor warnings, 21 no-scale-line (Appendix C). | | |
| F6 | Verify base figures (no entries yet, pure scale): V1 gross **8,400.00**, V2 gross **6,000.00**, V3/V4/V5 gross **3,000.00** each (already prorated ×25/30 for the 07-Mar sign-ons). Leave accrual: V1 700, V2 500, V3/V4/V5 250 each. | ✓ All five match. | | |

---

## Phase G — Vessel monthly entry, March 2026 (Ship / Vessel Admin on vessel 04)

Switch persona to **Ship — Vessel Admin (vessel 04)**. Navigate via **Accounts → Vessel Portage** → March 2026. The entry screen has tabs (Overtime, Cash Advances, Allotments, Bond / Slop Chest, the extra "Radio / Telephone" tab from B6, CTM, …).

### G0 — Save mechanics (how the entry grids behave)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G1 | ⚠ Type a value into any grid cell and *don't* save. | The tab shows a "dirty" indicator (unsaved-changes badge). | | |
| G2 | ⚠ Switch to another tab with unsaved changes. | Changes are **auto-saved** on tab switch — no data loss, the dirty badge clears. | | |
| G3 | [NEG] With at least one unsaved change somewhere, click **Submit**. | Refused with the message: `You have <count> unsaved change(s). Save every tab before submitting the month.` — where `<count>` is the number of unsaved changes ("1 unsaved change" in the singular). Save everything before G13. | | |

### G1 — Variable overtime (OT tab)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G4 | For **SANJAY VERMA (V1)**: enter **10 hours**. | Amount = 10 × 17.50 = **175.00**. | | |
| G5 | For **AMIT SHARMA (V3)**: enter **20 hours**. | Amount = 20 × 7.50 = **150.00**. | | |

### G2 — CTM and cash advance

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G6 | Open the **CTM** tab. Verify the opening-balance note. | First month: opening balance 0.00 with the note `No prior balance found — opening at 0.00`. | | |
| G7 | Record cash **received** from the office: `1000.00`. | CTM received = 1,000.00. | | |
| G8 | Add cash advance: crew = **DMITRIY SOKOLOV (V4)**, amount **300.00**, date **2026-03-12**. | Advance saved. A **mirror line** appears in the CTM ledger: cash advance to crew, 300.00, dated **2026-03-12** (the advance date, not today). | | |
| G9 | Add a CTM **expense**: amount **150.00**, date **2026-03-28**, description `Port charges`. | Expense line saved. CTM closing balance = 1,000 − 300 − 150 = **550.00**, no imbalance flag. | | |

### G3 — Allotment, bond, extra tab

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G10 | Allotments tab: for **IVAN JURIC (V2)** enter an extra one-off allotment of **600.00** for March only. | Saved. | | |
| G11 | Bond / Slop Chest tab: for **SANJAY VERMA (V1)** add one purchase `Goods`, 1 × **80.00**, date 2026-03-20. | Saved. Note: bond purchases post automatically as an office-origin, already-accepted rollup line — they do **not** go through the office accept/reject queue in Phase H. This is by design (single-posting-path): the office controls bond entries by editing, cancelling, or zeroing the bond **item** on this tab (which recomputes or removes the rollup) at any time until the month locks — not via transaction accept/reject. | | |
| G12 | Radio / Telephone tab (extra tab from B6): **V1** = **25.00**, **MANOJ REDDY (V5)** = **40.00**. | Both saved. | | |

### G4 — Sign-off V4 and submit

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G13 | Record sign-off for **DMITRIY SOKOLOV (V4)**: end date **2026-04-20** (sign-off applies to period 2026-04). | Saved; V4's engagement shows end date 20-Apr-2026. Note: the next April sync will flag a discrepancy because the crewing assignment is still open — that is **expected** (see M1). | | |
| G14 | Click **Submit to office** for March 2026. | Submission succeeds: **6 transactions** submitted (V1 OT, V3 OT, V4 cash advance, V2 extra allotment, V1 COMM, V5 COMM). The V1 bond line is *not* among them (see G11). A calculation runs automatically as part of submission. | | |

---

## Phase H — Office review of vessel entries (Office / Sail Admin)

Switch back to **Office — Sail Admin**. Menu: **Accounts → Monthly Txns** (or the Payroll Run review step) → vessel 04 → March 2026.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| H1 | Open the submitted-entries review. | Exactly **6** entries in "Submitted" state, each with Accept / Reject. | | |
| H2 | **Accept** five entries: V1 OT (175.00), V3 OT (150.00), V4 cash advance (300.00), V2 extra allotment (600.00), V1 COMM (25.00). | Each shows "Accepted". | | |
| H3 | **Reject** V5's COMM entry (40.00) with review comment `No receipt attached — resubmit with receipt`. A comment is **required** to reject. | Entry shows "Rejected"; V5's COMM never reaches the ledger. | | |
| H4 | ⚠ Switch to Ship — Vessel Admin and confirm the rejection (with reason) is visible vessel-side; then switch back. | Rejected status + reason visible. | | |

---

## Phase I — Office money entries, March 2026 (Office / Sail Admin)

### I1 — Standing allotment for V2

Menu: **Accounts → Allotments & Cash** → New Allotment.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| I1 | Create a standing allotment: crew **IVAN JURIC (V2)**, beneficiary `Elena Juric` (Spouse), fixed amount **800.00** USD, valid from `2026-03-01`, status Active. | Saved as Active. | | |
| I2 | After the next calc run (J1) V2's allotment deductions total **1,400.00** (800 standing + 600 extra). | Two ALLOT lines: 800 and 600. | | |

### I2 — Office advance and recovery for V5

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| I3 | Create an office advance: crew **MANOJ REDDY (V5)**, principal **600.00**, recovery **200.00** per month, **first recovery month `2026-03`** (required), status Disbursed. | Saved. Recovery schedule: Mar 200, Apr 200, May 200. | | |
| I4 | After the next calc run, March shows an ADVANCE deduction of **200.00** for V5 (instalment 1 of 3). | ✓ | | |

### I3 — Office bond purchase for V4

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| I5 | Add a bond purchase for **DMITRIY SOKOLOV (V4)**: item `Cigarettes`, 2 × **25.00** = 50.00, date 2026-03-15, period 2026-03. | Bond line 50.00 for V4 (auto-accepted rollup, same as G11). | | |

---

## Phase J — Calculation run & exact figures (Office / Sail Admin)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| J1 | Run Calculation for vessel 04, March 2026. | Completes with **21 warnings** (all no-scale-line). | | |
| J2 | Verify each working-set crew member against the table below (Appendix A has the full arithmetic). | ✓ | | |

**March 2026 — expected figures for the working set**

> Proration: V3, V4, V5 signed on 07-Mar-2026 → 25 days (both inclusive), factor 25/30. BASIC, GOT and LEAVE prorate; OT does not.

| Crew | Days | BASIC | GOT | OT | Gross paid | Deductions | Net on board | Leave accrual |
|---|---|---|---|---|---|---|---|---|
| V1 SANJAY VERMA | 30 | 7,000.00 | 1,400.00 | 175.00 | **8,575.00** | 105.00 ¹ | **8,470.00** | 700.00 |
| V2 IVAN JURIC | 30 | 5,000.00 | 1,000.00 | — | **6,000.00** | 1,400.00 ² | **4,600.00** | 500.00 |
| V3 AMIT SHARMA | 25 | 2,500.00 | 500.00 | 150.00 | **3,150.00** | — | **3,150.00** | 250.00 |
| V4 DMITRIY SOKOLOV | 25 | 2,500.00 | 500.00 | — | **3,000.00** | 350.00 ³ | **2,650.00** | 250.00 |
| V5 MANOJ REDDY | 25 | 2,500.00 | 500.00 | — | **3,000.00** | 200.00 ⁴ | **2,800.00** | 250.00 |
| **Vessel total** | | | | | **23,725.00** | **2,055.00** | **21,670.00** | **1,950.00** |

¹ BOND 80.00 + COMM 25.00 · ² ALLOT 800.00 + 600.00 · ³ cash advance 300.00 + bond 50.00 · ⁴ ADVANCE recovery 200.00 (1 of 3)

| Step | Check | Expected result | P/F | Notes |
|---|---|---|---|---|
| J3 | Vessel totals: Gross **23,725.00**, Deductions **2,055.00**, Net **21,670.00**. | ✓ | | |
| J4 | Drill into V3: BASIC = 3,000 × 25/30 = **2,500.00** with proration indication. | ✓ | | |
| J5 | V5 has **no** COMM line (rejected in H3); only deduction is ADVANCE 200.00. | ✓ | | |
| J6 | Balance C/F per crew = Net on board (all B/F = 0.00, first month). | ✓ | | |

---

## Phase J2 — Contract pay items, timing override, allotment suspension (Office / Sail Admin)

Each exercise below is: apply → recalculate March → verify → remove/revert → recalculate → verify the baseline is restored. Both figures are stated. Do all of this **before** Phase K (March must still be unlocked). Appendix A figures are unchanged by this phase — every change is reverted.

### J2.1 — Contract pay items (all three modes)

Open the crew member's contract (Accounts → Contracts) → pay items section.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| J2-1 | V1: add pay item **Add element** SUBS `200.00`. Recalc March. | V1 gross **8,775.00**, net **8,670.00** (8,775 − 105). | | |
| J2-2 | Remove the SUBS pay item. Recalc. | V1 back to gross **8,575.00** / net **8,470.00**. | | |
| J2-3 | V3: add pay item **Replace scale value** on BASIC = `3100.00`. Recalc. | V3 gross **3,233.33** (3,100 × 25/30 = 2,583.33 + GOT 500 + OT 150), net **3,233.33**. | | |
| J2-4 | Remove it. Recalc. | V3 back to **3,150.00**. | | |
| J2-5 | V5: add pay item **Suppress element** on GOT. Recalc. | V5 gross **2,500.00**, deductions 200.00, net **2,300.00**. | | |
| J2-6 | Remove it. Recalc. | V5 back to gross **3,000.00** / net **2,800.00**. | | |

### J2.2 — Payment-timing override (V1 LEAVE paid on board)

On V1's contract, find the LEAVE element's timing toggle: `Pay Leave Pay on board (instead of at settlement)?`

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| J2-7 | Turn the override ON. Recalc March. | V1 gross **9,275.00** (8,575 + LEAVE 700 now paid on board), net **9,170.00**, leave accrual **0.00**. | | |
| J2-8 | Turn it OFF. Recalc. | V1 back to gross **8,575.00** / net **8,470.00** / accrual **700.00**. | | |

### J2.3 — Allotment suspend / reactivate (V2)

In **Allotments & Cash**, open Elena Juric's standing allotment.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| J2-9 | **Suspend** it. Recalc March. | V2 deductions drop to **600.00** (only the extra one-off remains), net **5,400.00**. | | |
| J2-10 | **Reactivate** it. Recalc. | V2 back to deductions **1,400.00** / net **4,600.00**. | | |

---

## Phase K — Approval & locking (Office — Sail Admin + Office — Admin)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| K1 | As **Sail Admin**: open the March 2026 portage and **Submit for approval** with **one approver**: `MARIA FERNANDEZ`. | Status changes to submitted / awaiting approval with 1 pending approver. | | |
| K2 | Switch to **Office — Admin**. Open the same portage and **Approve** it. | Approved — and because Auto-lock is ON (A3), the period is immediately **Locked**. | | |
| K3 | [NEG] Try to add or edit a monthly transaction in March. | Refused: `Portage bill … is locked; monthly transactions are read-only`. | | |
| K4 | [NEG] Try to run the March calculation again. | Refused (409): the message ends `…post an adjustment run into a later open period instead`. | | |
| K5 | [NEG] Try to add a CTM line in March. | Refused: `CTM is locked; lines are read-only`. The March CTM status is **locked** and its closing balance (550.00) is frozen. | | |
| K6 | ⚠ Note: a separation-of-duties check (submitter ≠ approver) exists but **cannot be verified hands-on under `AUTH_BYPASS`** (every persona resolves to the same technical user). SoD is covered by automated tests — do not test it manually. | — | | |

---

## Phase L — Portage bill & print (Office / Sail Admin)

Menu: **Accounts → Portage Bill** → vessel 04 → March 2026.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| L1 | Verify header: vessel 04, March 2026, USD, status **Locked**. | ✓ | | |
| L2 | Verify all 26 crew are listed; the 5 working-set crew show the Phase J figures; the 21 Appendix C crew show zero wages. | ✓ | | |
| L3 | Verify totals: Gross **23,725.00**, Net **21,670.00**, Leave accrual **1,950.00**. | ✓ | | |
| L4 | ⚠ Export / print. | A printable view/PDF is generated; figures match on-screen. | | |

---

## Phase M — April 2026: year-step, sign-off discrepancy, second month

### Context

- **V2** reaches Year 2 on 16-Apr-2026 → the engine splits April: 1–15 at Year 1, 16–30 at Year 2.
- **V4** has the on-board sign-off 20-Apr-2026 (G13); he is settled in Phase N.
- **V5**'s recovery continues: instalment 2 of 3 = 200.00.
- V2's standing 800.00 allotment recurs automatically; the March-only 600.00 does not.

### M1 — Sync April & CTM carry-forward (Office / Sail Admin)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| M1 | Run engagement sync for period **2026-04**. | 0 created (all exist). One **attention** item for V4: `sign-off date was set manually to 2026-04-20 but the crewing assignment says open — review the contract`. This is the **expected** consequence of G13 — not a defect. | | |
| M2 | Open the April CTM. | Opening balance **550.00** with the note `Opening balance carried from 2026-03`. | | |

### M2 — Vessel entry & calc (Ship — Vessel Admin, then Office)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| M3 | As Vessel Admin: April OT for **V1** = **8 hours** (8 × 17.50 = 140.00). Submit April to office. | Submitted. | | |
| M4 | As Sail Admin: accept V1's OT entry, then Run Calculation for April. | Completes with **19 warnings** (all no-scale-line — two of the Appendix C crew left in March, see C2). | | |
| M5 | Verify V2's year-step split: Apr 1–15 BASIC 2,500 + GOT 500 (Year 1); Apr 16–30 BASIC 2,750 + GOT 550 (Year 2). Gross **6,300.00**, deduction 800.00, net **5,500.00**, leave accrual **525.00**. | ✓ | | |
| M6 | Verify the rest (full table in Appendix A §A3): V1 gross **8,540.00** / net **8,540.00**; V3 gross **3,600.00**; V4 gross **2,400.00** (20 days, Apr 1–20) net **2,400.00**; V5 gross **3,600.00**, ADVANCE 200.00 (instalment 2), net **3,400.00**. | ✓ | | |

> **April is deliberately NOT approved/locked yet.** The settlement in Phase N runs while April is still open — this lets you exercise the settlement-skip re-run (N4) hands-on. April is locked in N6, *after* the settlement.

---

## Phase N — Settlement of V4 while April is open, skip re-run, then April lock (Office / Sail Admin)

Menu: **Accounts → Settlements** → New Settlement → engagement of DMITRIY SOKOLOV. April 2026 must still be **open** (unlocked) — do not submit the April portage before N6.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| N1 | Compute the settlement. | Draft settlement: unpaid balance **5,050.00** (2,650 Mar + 2,400 Apr), accrued leave **450.00** (250 + 200), net payable **5,500.00**. Settlement date 2026-04-20, period 2026-04. (Identical whether April is open or locked — the settlement reads the ledger, not the lock state.) | | |
| N2 | Add an adjustment: element **OTHD**, type **Deduction**, amount `50.00`, description `Lost cabin key`. | Net payable becomes **5,450.00**. | | |
| N3 | Submit the settlement with approver `MARIA FERNANDEZ`; approve as Office — Admin. | Status draft → submitted → **approved**. From this point V4's engagement is **frozen** for the engine. | | |
| N4 | **Settlement-skip re-run.** With the settlement approved and April still open, run the April calculation again (Payroll Run → vessel 04 → 2026-04 → Run Calculation). | The run **succeeds** but V4 is skipped. Toast: `18 ledger lines for 4 crew (19 warnings); 1 crew excluded: already settled`. A blue banner above the totals grid reads `1 crew excluded from recalculation (already settled — existing ledger lines preserved)` with the row `DMITRIY SOKOLOV — settlement approved`. | | |
| N5 | Verify after the re-run: the Portage workspace still shows **5** crew. V4's April figures are **unchanged** (gross **2,400.00**, net **2,400.00** — his ledger lines were preserved, not recomputed), and the other four recomputed to the same values: V1 8,540.00; V2 6,300.00 / ded 800.00 / net 5,500.00 / accrual 525.00; V3 3,600.00; V5 3,600.00 / ADVANCE 200.00 / net 3,400.00. Vessel totals: gross **24,440.00**, net **23,440.00**. | ✓ All unchanged from M5/M6. | | |
| N6 | **Mark paid** with paid date `2026-04-25` and payment reference `WIRE-0425-V4` (both required). Then submit April for approval (one approver `MARIA FERNANDEZ`) and approve as Office — Admin. | Settlement status **paid** (V4's engagement status becomes *settled*). April portage approved → auto-**locked**, still listing all 5 crew with V4's preserved 2,400.00. Note: a re-run attempted between mark-paid and the lock would also skip V4, but **silently** (no banner — the settled engagement simply drops out of the computed set; lines and totals still preserved). The banner in N4 only appears while the settlement is submitted/approved. | | |
| N7 | **Lock** the settlement. | Status **locked**; figures frozen (net 5,450.00 / balance 5,050.00 / accruals 450.00). | | |
| N8 | [NEG] Try to re-run the April vessel calculation. | Refused (409): `…is locked; post an adjustment run into a later open period instead`. | | |
| N9 | [NEG] Try to re-run the calculation for V4's single engagement in April. | Refused (409): the message ends `…the engine refuses to run against it`. (Inside an *open* period the same freeze produces the skip you saw in N4; against a locked period the engine refuses outright.) | | |

---

## Phase O — Reports (Office / Sail Admin)

### O1 — Payslips

Menu: **Accounts → Reports → Payslips**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O1 | Payslip **AMIT SHARMA (V3)**, 2026-03. | 25 days served; BASIC 2,500.00, GOT 500.00, OT 150.00; gross 3,150.00, deductions 0.00, net 3,150.00; B/F 0.00, C/F 3,150.00; leave accrual 250.00. | | |
| O2 | Payslip **IVAN JURIC (V2)**, 2026-04. | Split earning lines: BASIC 01–15 Apr 2,500.00; GOT 01–15 Apr 500.00; BASIC 16–30 Apr 2,750.00; GOT 16–30 Apr 550.00. Gross 6,300.00, ALLOT 800.00, net 5,500.00, B/F 4,600.00 → C/F 10,100.00. | | |
| O3 | Payslip **DMITRIY SOKOLOV (V4)**, 2026-04. | 20 days served; gross 2,400.00, net 2,400.00; B/F 2,650.00, **C/F 0.00** (cleared by the settlement). | | |

### O2 — GL export (March 2026)

Menu: **Accounts → Reports → GL Export** → vessel 04 → March 2026.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O4 | Generate the export. Verify **total DR = total CR = 23,725.00**. | ✓ Balanced. | | |
| O5 | Verify every row against this table: | ✓ | | |

| GL code | Label | DR | CR |
|---|---|---|---|
| 1000 | Basic Wage (BASIC) | 19,500.00 | |
| 1100 | Guaranteed Overtime (GOT) | 3,900.00 | |
| 1200 | Variable Overtime (OT) | 325.00 | |
| 2200 | Allotment (ALLOT) | | 1,400.00 |
| 2300 | Advance Recovery (ADVANCE) | | 500.00 ¹ |
| 2400 | Bond / Slop Chest (BOND) | | 130.00 ² |
| 2600 | Radio / Telephone (COMM) | | 25.00 |
| 3000 | Net wages payable | | 21,670.00 |

¹ 300.00 vessel cash advance (V4) + 200.00 office recovery (V5). · ² 80.00 (V1) + 50.00 (V4).

### O3 — Fleet summary

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O6 | Fleet summary for 2026-03. | Vessel 04: 5 computing crew, gross **23,725.00**, deductions **2,055.00**, net **21,670.00**, settlement accrual **1,950.00**. | | |

### O4 — Permissions negative test (Ship — Vessel User)

Switch to **Ship — Vessel User (vessel 04)**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O7 | ⚠ [NEG] Attempt to open Config → Wage Scales. | Access denied or hidden. | | |
| O8 | ⚠ [NEG] Attempt to open Reports → GL Export. | Access denied or hidden (office-only). | | |
| O9 | ⚠ [NEG] Attempt to trigger a calc run. | Button hidden/disabled; a Vessel User can view but not calculate. | | |

---

## Appendix A — Worked arithmetic

### A1 — Scale values (full month, 30 days)

| Rank | BASIC | GOT | LEAVE | OT rate |
|---|---|---|---|---|
| Master (R001) | 7,000.00 | 1,400.00 | 700.00 | 17.50/hr |
| Chief Officer Year 1 (R002) | 5,000.00 | 1,000.00 | 500.00 | 12.50/hr |
| Chief Officer Year 2 (R002) | 5,500.00 | 1,100.00 | 550.00 | 13.75/hr |
| Able Seaman (R015) | 3,000.00 | 600.00 | 300.00 | 7.50/hr |

### A2 — March 2026 (verified live 29-Jul-2026)

Proration V3/V4/V5: 07–31 Mar inclusive = 25 days; factor 25/30.

| Item | V1 | V2 | V3 | V4 | V5 |
|---|---|---|---|---|---|
| Days | 30 | 30 | 25 | 25 | 25 |
| BASIC | 7,000.00 | 5,000.00 | 2,500.00 | 2,500.00 | 2,500.00 |
| GOT | 1,400.00 | 1,000.00 | 500.00 | 500.00 | 500.00 |
| OT | 175.00 | — | 150.00 | — | — |
| **Gross** | **8,575.00** | **6,000.00** | **3,150.00** | **3,000.00** | **3,000.00** |
| ALLOT | — | 1,400.00 | — | — | — |
| Cash advance | — | — | — | 300.00 | — |
| BOND | 80.00 | — | — | 50.00 | — |
| COMM | 25.00 | — | — | — | — |
| ADVANCE recovery | — | — | — | — | 200.00 |
| **Deductions** | **105.00** | **1,400.00** | **0.00** | **350.00** | **200.00** |
| **Net on board** | **8,470.00** | **4,600.00** | **3,150.00** | **2,650.00** | **2,800.00** |
| LEAVE accrual | 700.00 | 500.00 | 250.00 | 250.00 | 250.00 |
| Balance C/F | 8,470.00 | 4,600.00 | 3,150.00 | 2,650.00 | 2,800.00 |

**Totals:** Gross 23,725.00 · Deductions 2,055.00 · Net 21,670.00 · Leave accrual 1,950.00

### A3 — April 2026 (verified live 29-Jul-2026)

V4: Apr 1–20 = 20 days, factor 20/30. V2: split 15 days Year 1 + 15 days Year 2.

| Item | V1 | V2 | V3 | V4 | V5 |
|---|---|---|---|---|---|
| Days | 30 | 30 | 30 | 20 | 30 |
| BASIC | 7,000.00 | 2,500.00 + 2,750.00 = **5,250.00** | 3,000.00 | 2,000.00 | 3,000.00 |
| GOT | 1,400.00 | 500.00 + 550.00 = **1,050.00** | 600.00 | 400.00 | 600.00 |
| OT | 140.00 | — | — | — | — |
| **Gross** | **8,540.00** | **6,300.00** | **3,600.00** | **2,400.00** | **3,600.00** |
| Deductions | 0.00 | 800.00 | 0.00 | 0.00 | 200.00 |
| **Net on board** | **8,540.00** | **5,500.00** | **3,600.00** | **2,400.00** | **3,400.00** |
| LEAVE accrual | 700.00 | 250.00 + 275.00 = **525.00** | 300.00 | 200.00 | 300.00 |
| Balance B/F | 8,470.00 | 4,600.00 | 3,150.00 | 2,650.00 | 2,800.00 |
| **Balance C/F** | **17,010.00** | **10,100.00** | **6,750.00** | **5,050.00** | **6,200.00** |

### A4 — V4 settlement (verified live)

| Item | Amount |
|---|---|
| Unpaid balance (Mar 2,650 + Apr 2,400) | 5,050.00 |
| Accrued leave (Mar 250 + Apr 200) | 450.00 |
| Adjustment: OTHD "Lost cabin key" (deduction) | −50.00 |
| **Net settlement payable** | **5,450.00** |

### A5 — CBA floor violation

ITF MINIMUM 2026 · Able Seaman (R015) · BASIC · scale 3,000.00 vs minimum 3,200.00 · deficit **200.00**. Deliberate; acknowledged at activation (D4); informational thereafter.

---

## Appendix B — Items to ignore (expected, not defects)

| # | Observation | Why it is expected |
|---|---|---|
| B-1 | Seeded elements SENIORITY, SUBS, UNION and PF post **0.00** in every calc run. | The wage scale has no lines for them; they only produce amounts via scale lines or pay items. |
| B-2 | The March sync reports **3 skipped (no period overlap)**. | Three vessel-04 assignments ended before March 2026 (incl. IRWAN SUBEKTI, signed off 28-Feb-2026). |
| B-3 | The April sync raises an attention item for V4 (`…crewing assignment says open — review the contract`). | Deliberate: the sign-off was recorded in Accounts (G13) but not in the crewing module. |
| B-4 | Separation-of-duties cannot be triggered manually. | Under `AUTH_BYPASS` all personas resolve to one technical user; SoD is covered by automated tests (K6). |
| B-5 | 21 (March) / 19 (April) "no scale line" warnings. | The scale deliberately covers only 3 ranks; see Appendix C. |

---

## Appendix C — The non-computing crew (no scale lines for their rank)

These crew produce the no-scale-line warnings (21 in March, 19 in April). Not a defect — the scale deliberately covers only Master, Chief Officer and Able Seaman.

### C1 — March 2026 (21 warnings)

| Name | Rank | Rank code |
|---|---|---|
| VIKRAM REDDY | 2nd Officer | R003 |
| DEDE ANDREA ISMAIL | 3rd Officer | R004 |
| MARIA DELA CRUZ | 3rd Officer | R004 |
| ROMAN LYSENKO | Chief Engineer | R005 |
| TOMISLAV MARIC | 2nd Engineer | R006 |
| SANJAY KUMAR | 3rd Engineer | R007 |
| MYKOLA TKACHENKO | 4th Engineer | R008 |
| ROMAN KOVALENKO | Electrical Officer | R010 |
| DIMUTH MENDIS | Deck Cadet | R012 |
| HTET LWIN | Bosun | R014 |
| MIN KAUNG KHANT | Ordinary Seaman | R016 |
| AUNG PYONE MYINT MYAT | Ordinary Seaman | R016 |
| AGUS NUGROHO | Ordinary Seaman | R016 |
| DEEPAK DAS | Pumpman | R017 |
| MADE SAPUTRA | Fitter | R018 |
| NAING KYAW | Motorman | R019 |
| KYAW ZIN LATT | Oiler | R021 |
| MYO MIN THU | Oiler | R021 |
| FLORIN DUMITRU | Oiler | R021 |
| ADRIAN MATEI | Chief Cook | R022 |
| MAREK SZYMANSKI | Messman | R023 |

### C2 — April 2026 (19 warnings)

Same list **minus** DEDE ANDREA ISMAIL (signed off 01-Mar-2026) and AUNG PYONE MYINT MYAT (signed off 08-Mar-2026).

---

## Appendix D — The 26 active engagements in March 2026

| Name | Rank | Sign-on | Sign-off |
|---|---|---|---|
| SANJAY VERMA | Master | 01-Mar-2026 | — |
| IVAN JURIC | Chief Officer | 01-Mar-2026 | — |
| VIKRAM REDDY | 2nd Officer | 01-Mar-2026 | — |
| MARIA DELA CRUZ | 3rd Officer | 01-Mar-2026 | — |
| ROMAN LYSENKO | Chief Engineer | 01-Mar-2026 | — |
| TOMISLAV MARIC | 2nd Engineer | 01-Mar-2026 | — |
| SANJAY KUMAR | 3rd Engineer | 01-Mar-2026 | — |
| MYKOLA TKACHENKO | 4th Engineer | 01-Mar-2026 | — |
| ROMAN KOVALENKO | Electrical Officer | 01-Mar-2026 | — |
| DIMUTH MENDIS | Deck Cadet | 01-Mar-2026 | — |
| HTET LWIN | Bosun | 01-Mar-2026 | — |
| ADRIAN MATEI | Chief Cook | 01-Mar-2026 | — |
| AMIT SHARMA | Able Seaman | 07-Mar-2026 | — |
| DMITRIY SOKOLOV | Able Seaman | 07-Mar-2026 | 20-Apr-2026 |
| MANOJ REDDY | Able Seaman | 07-Mar-2026 | — |
| AGUS NUGROHO | Ordinary Seaman | 07-Mar-2026 | — |
| DEEPAK DAS | Pumpman | 07-Mar-2026 | — |
| MADE SAPUTRA | Fitter | 09-Mar-2026 | — |
| FLORIN DUMITRU | Oiler | 09-Mar-2026 | — |
| MAREK SZYMANSKI | Messman | 09-Mar-2026 | — |
| NAING KYAW | Motorman | 09-Mar-2026 | — |
| KYAW ZIN LATT | Oiler | 04-Jul-2025 | — |
| MYO MIN THU | Oiler | 10-Jun-2025 | — |
| AUNG PYONE MYINT MYAT | Ordinary Seaman | 20-Aug-2025 | 08-Mar-2026 |
| DEDE ANDREA ISMAIL | 3rd Officer | 05-Sep-2025 | 01-Mar-2026 |
| MIN KAUNG KHANT | Ordinary Seaman | 10-Sep-2025 | 14-Apr-2026 |

> The three assignments skipped by the sync (no March overlap, incl. IRWAN SUBEKTI, sign-off 28-Feb-2026) are correctly excluded.

---

## Defect report template

```
DEFECT REPORT
─────────────────────────────────────────────────────
Script step:          [e.g. J3]
Date/time:            [YYYY-MM-DD HH:MM]
Tester:               [name]
Build (git commit):   [SHA]

Summary:              [one sentence]

Steps to reproduce:
  1.
  2.
  3.

Expected result:      [from the script]
Actual result:        [what you saw, including exact amounts if monetary]
Severity:             [ ] Blocker  [ ] Major  [ ] Minor  [ ] Cosmetic
Screenshot/log path:  [attach if available]
```

---

## Sign-off sheet

| | |
|---|---|
| **Tester name** | |
| **Date started** | |
| **Date completed** | |
| **Git commit hash** | |
| **Total steps** | |
| **Pass** | |
| **Fail** | |
| **Blocked / skipped** | |
| **Open defects** | (list defect IDs / step numbers) |
| **Sign-off decision** | [ ] Pass  [ ] Pass with defects  [ ] Fail |
| **Signature** | |
