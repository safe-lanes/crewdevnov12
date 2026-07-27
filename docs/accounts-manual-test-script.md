# Accounts Module — Manual Test Script
## From an empty configuration to reports & settlements

| | |
|---|---|
| **Purpose** | Verify the entire Accounts module end-to-end: tenant configuration, pay elements, wage scales, CBA floors, crew engagements, vessel-side monthly entry, office review, wage calculation, money screens, approvals & locking, portage bill, a second month with a mid-month wage step, final settlement, and reports. |
| **Build under test** | Development build served by the "Start application" workflow (port 5000). Record the git commit hash on the sign-off sheet before starting. |
| **Script date** | 27 July 2026 |
| **Estimated time** | 6–7 hours for one careful pass (phases A–O). Natural break points: after Phase H and after Phase K. |
| **Audience** | Manual testers. **No maritime or payroll knowledge is required.** Every term is defined in the Glossary; every value to type is given exactly; every expected figure is pre-computed in Appendix A. |
| **Recording results** | Print or copy this document. For each step, tick Pass/Fail and note anything unexpected in the Notes column. Use the Defect Report Template at the end for every Fail. |
| **Verification status** | Every money figure in this script was verified against the live calculation engine on 27 Jul 2026 (API-level walk-through). Steps whose exact on-screen wording could not be verified hands-on are marked ⚠ — treat small wording differences there as a Note, not a Fail, as long as the meaning and the figures match. |

---

## Glossary — read this first

| Term | Plain-English meaning |
|---|---|
| **Tenant** | Your company's own workspace inside the app. "Tenant configuration" = company-wide settings. |
| **Vessel** | A ship. Each vessel keeps its own monthly wage records. |
| **Crew / Rank** | Crew = the people working on a ship. Rank = their job title (e.g. Master = the captain; Chief Officer = second in command; Able Seaman = an experienced deckhand). |
| **Engagement** | One person's employment contract on one vessel, with a start (sign-on) and end (sign-off) date. |
| **Sign-on / Sign-off** | The day a crew member starts / stops working aboard. |
| **Pay element** | One building block of pay, e.g. "Basic Wage" or "Allotment". Each is an *earning* (money to the crew) or a *deduction* (money withheld). |
| **Wage scale** | A price list: for each rank, the monthly amount of each pay element. |
| **Year-step / Seniority step** | A pay rise after serving a defined time in the rank (year 1 rate → year 2 rate). |
| **CBA** | Collective Bargaining Agreement — a union contract that sets **minimum** wages. The app warns when a wage scale pays below a CBA minimum ("floor violation"). |
| **Proration** | Paying part of a monthly amount when someone works only part of the month. This app uses a **30-day month**: a full month always counts as 30 days, no matter the calendar. |
| **Portage bill** | The vessel's monthly wage summary: one row per crew member with earnings, deductions and net pay. |
| **Monthly transaction** | A single one-off money line for one crew member in one month (e.g. overtime hours, a cash advance). |
| **Overtime — fixed vs variable** | Fixed overtime = a flat monthly allowance. Variable overtime = extra hours × an hourly rate. |
| **Allotment** | A standing instruction to send part of the wage to a family member's bank account ashore. |
| **Cash advance** | Wages paid early, in cash, on board. Deducted from that month's pay. |
| **Advance (office) & recovery** | A loan arranged by the office, paid back ("recovered") in monthly instalments withheld from pay. |
| **Bond / Slop chest** | The ship's small onboard shop (cigarettes, chocolate…). Purchases are deducted from pay. |
| **CTM** | Cash To Master — the box of physical cash the captain holds. Cash advances paid on board reduce it. |
| **Net on board** | What the crew member is actually owed for the month: on-board earnings minus deductions. |
| **Leave pay / Settlement accrual** | Money earned monthly but **only paid at the end of the contract** (at settlement). It accrues in a side balance. |
| **Balance B/F and C/F** | Brought Forward / Carried Forward — the running unpaid balance entering / leaving the month. |
| **Settlement** | The final pay-off when a contract ends: unpaid balances + accrued leave ± adjustments. |
| **GL export** | An accounting report where every amount becomes a debit (DR) or credit (CR) per General Ledger account code. Total DR must equal total CR. |
| **Calc run** | Pressing "Run Calculation": the engine computes every wage line for a vessel-month. |
| **Locking** | After final approval a month becomes read-only ("locked"). Nothing in it can change. |

---

## Prerequisites

| # | Action | Expected result |
|---|---|---|
| P1 | Confirm the application is running: open the app preview URL (dev server, port 5000). | The login/landing page loads without errors. |
| P2 | Confirm you are on a **development** environment with the developer persona switcher available (`AUTH_BYPASS=true`). Look for a round **user icon** at the right end of the top navigation bar. | Clicking it opens a persona menu with **Office** personas (Sail Admin, Admin, User) and **Ship** personas (Vessel Admin, Vessel User). |
| P3 | **Clean state.** This script creates all of its own data with fresh, uniquely named records (vessel "MV CHECKMATE", scale "MTS SCALE 2026", and the five crew names listed in the dataset table below, e.g. "JOHN MASTERSON"). You do **not** need to wipe the database, but the vessel and crew names below must not already exist. If they do (a previous aborted run), either delete those records or append a suffix (e.g. "MV CHECKMATE 2") **consistently everywhere** in this script. | No records named "MV CHECKMATE" or "MTS SCALE 2026" exist. |
| P4 | The Accounts module is reached via the **Module Navigator** (grid icon in the top bar) → **Accounts**. Open it once now. | Accounts sidebar appears with sections: Master Tables (Pay Elements, Wage Scales, CBA Reference), Payroll (Payroll Run, Portage Bill, Monthly Txns, Settlements, Vessel Portage), Crew Finance (Allotments, Cash & Bond), Reports (Payslips, GL Export, Fleet Summary), Admin (Tenant Config). |

### Persona-switch guide

Switch personas with the round user icon (P2). When you pick a **Ship** persona you must also pick the vessel — always choose **MV CHECKMATE**.

| Phase | Persona |
|---|---|
| A–E | Office — **Sail Admin** |
| F | Ship — **Vessel Admin** (on MV CHECKMATE) |
| G | Office — Sail Admin (review) and Ship — Vessel Admin (see rejection) |
| H–K | Office — Sail Admin (plus Office — **Admin** as second approver in J) |
| L | Ship — Vessel Admin (entry), then Office — Sail Admin (calc) |
| M–N | Office — Sail Admin |
| O | Ship — Vessel User, plus notes |

### The test dataset (created by you during the script)

One vessel (**MV CHECKMATE**), five crew in three ranks, two months (**March 2026** and **April 2026**), all round numbers:

| Code | Name | Rank | Sign-on | Sign-off |
|---|---|---|---|---|
| C1 | JOHN MASTERSON | Master (MST) | 01-Mar-2026 | — |
| C2 | CARLOS OFICIAL | Chief Officer (CO) | 01-Mar-2026 | — (year-step 16-Apr-2026) |
| C3 | ANDRES BODEGA | Able Seaman (AB) | 01-Mar-2026 | — |
| C4 | BEN DECKER | Able Seaman (AB) | 01-Mar-2026 | — |
| C5 | SAMUEL PARTIDA | Able Seaman (AB) | 15-Mar-2026 | 20-Apr-2026 |

---

## Phase A — Tenant configuration (Office / Sail Admin)

Menu: **Accounts → Admin → Tenant Config**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| A1 | Open Tenant Config. | A settings form loads showing preparation mode, proration basis, day inclusion rule, functional currency, FX policy, GL wages payable account, max allotment percent, employment models, seniority settings, auto-lock, and two "Vessel entry tab" slots. | | |
| A2 | Set **Preparation mode** = `Vessel prepares`, **Proration basis** = `30-day month` (thirty_day_month), **Day inclusion rule** = `Both inclusive`, **Functional currency** = `USD`, **FX policy** = `Month end`. | Values accepted. | | |
| A3 | Set **GL wages payable account** = `2100`, **Max allotment percent** = `80`, **Auto-lock on approval** = ON. Enable employment model `Voyage contract`. | Values accepted. | | |
| A4 | Leave **Vessel entry tab 1** DISABLED for now (you will enable it in B10 after its pay element exists). Save the configuration. | A success message; reopening the page shows the saved values. | | |
| A5 | ⚠ Negative: enable Vessel entry tab 1 with a **label but no pay element** and try to save. | Save is refused with a validation error (tab label and element are both required). Disable the tab again and save. | | |

## Phase B — Pay elements from empty (Office / Sail Admin)

Menu: **Accounts → Master Tables → Pay Elements**. Create nine elements. For every one: **Rounding rule** = `Nearest`, **Rounding precision** = `0.01`, **Status** = `Active`, **Payment timing** = `Paid on board` unless stated. "GL" is the GL code field.

| Step | Create element (Code / Name) | Type / Category / Calc method / special settings | Expected result | P/F | Notes |
|---|---|---|---|---|---|
| B1 | `BASIC` / Basic Wage | Earning / Basic / Scale lookup / **Prorate ON** / GL `5001` | Saved; appears in the list. | | |
| B2 | `FOT` / Fixed Overtime | Earning / Fixed overtime / Scale lookup / Prorate ON / GL `5002` | Saved. | | |
| B3 | `OTV` / Overtime (variable) | Earning / Variable overtime / Rate × quantity / Prorate OFF / GL `5003` | Saved. | | |
| B4 | `LEAVE` / Leave Pay | Earning / **Leave** / Scale lookup / Prorate ON / **Payment timing = Payable at settlement** / GL `5004` | Saved. | | |
| B5 | `ALLOT` / Allotment | Deduction / Allotment / Manual entry / GL `2200` | Saved. | | |
| B6 | `ADVR` / Advance Recovery | Deduction / Advance recovery / Fixed amount / GL `2300` | Saved. | | |
| B7 | `BOND` / Bond / Slop Chest | Deduction / Bond–slop chest / Manual entry / GL `2400` | Saved. | | |
| B8 | `COMM` / Radio / Telephone | Deduction / Communication / Manual entry / GL `2500` | Saved. | | |
| B9 | `OTHD` / Other Deduction | Deduction / One-off / Manual entry / GL `2600` | Saved. | | |
| B10 | Return to **Tenant Config**; enable **Vessel entry tab 1** with label `Radio / Telephone`, bound to element `COMM`. Save. | Saved; config now shows the extra tab bound to COMM. | | |
| B11 | ⚠ Negative: try to create another element re-using code `BASIC`. | Refused with a duplicate-code error. | | |

## Phase C — Wage scale (Office / Sail Admin)

Menu: **Accounts → Master Tables → Wage Scales**. Create scale **`MTS SCALE 2026`**, currency `USD`, effective from `01-Jan-2026`. Then add lines. "Year 1" = experience 0–11 months; "Year 2" = 12–23 months. Amounts are **monthly USD**; OTV is an **hourly rate**.

| Step | Rank / Year | Lines to enter | Expected result | P/F | Notes |
|---|---|---|---|---|---|
| C1 | Create the scale header as above (status Draft). | Scale saved in Draft. | | |
| C2 | Master (MST), Year 1 | BASIC `6000.00`, FOT `1200.00`, LEAVE `600.00`, OTV rate `15.00` | 4 lines saved. | | |
| C3 | Chief Officer (CO), Year 1 | BASIC `4000.00`, FOT `800.00`, LEAVE `400.00`, OTV rate `10.00` | 4 lines saved. | | |
| C4 | Chief Officer (CO), **Year 2** | BASIC `4400.00`, FOT `880.00`, LEAVE `440.00`, OTV rate `11.00` | 4 lines saved (CO now has two year-steps). | | |
| C5 | Able Seaman (AB), Year 1 | BASIC `3000.00`, FOT `600.00`, LEAVE `300.00`, OTV rate `7.50` | 4 lines saved. Scale total: 16 lines. | | |

## Phase D — CBA floor violation and acknowledged activation

Menu: **Accounts → Master Tables → CBA Reference**, then back to the scale.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| D1 | Create a CBA reference: name `ITF TEST 2026`, rank `Able Seaman`, pay element `BASIC`, minimum amount `3200.00`, currency USD, effective from `01-Jan-2026`. | Saved. | | |
| D2 | On scale `MTS SCALE 2026`, run the **floor check**. | Exactly **one violation**: rank AB, element Basic Wage, scale amount **3,000.00**, CBA minimum **3,200.00**, deficit **200.00** (Appendix A.1). | | |
| D3 | Try to **Activate** the scale *without* acknowledging. | Refused with: *"Scale has lines below CBA minimums; acknowledge to activate anyway"*. Scale stays Draft. | | |
| D4 | Activate again, this time ticking the acknowledge option. | Activation succeeds; scale status = **Active**. | | |

## Phase E — Crew, engagements and seniority (Office / Sail Admin)

The vessel and crew come from the wider system: create vessel **MV CHECKMATE** under **Admin module → Masters → Vessel**, the five crew (table above, names exactly as written) under **Admin → Crew Pool**, and assign them to MV CHECKMATE with the sign-on dates above via the **Rotation** module. Then sync them into Accounts.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| E1 | ⚠ Module Navigator (grid icon) → **Admin** module → **Masters → Vessel** → create a vessel named exactly `MV CHECKMATE` (fill any other mandatory fields with sensible defaults and note what you chose). Save. | Vessel appears in the vessel list. | | |
| E2 | ⚠ Admin module → **Crew Pool** ("All") → create the 5 crew, names **exactly** as in the dataset table (JOHN MASTERSON, CARLOS OFICIAL, ANDRES BODEGA, BEN DECKER, SAMUEL PARTIDA), with ranks Master / Chief Officer / Able Seaman ×3 respectively. Save each. | All 5 appear in the crew pool with the correct rank. | | |
| E3 | ⚠ Module Navigator → **Rotation** module → assign each crew member to MV CHECKMATE with the exact sign-on dates from the dataset table (all 01-Mar-2026 except SAMUEL PARTIDA = 15-Mar-2026). | All 5 assignments exist with the correct dates. | | |
| E4 | ⚠ Back in Accounts: **Payroll → Payroll Run** → select vessel MV CHECKMATE → Step 1 "Crew & Engagement Review" → run the engagement **sync**. | 5 engagements appear, one per crew member, each showing rank, the correct sign-on date, wage scale `MTS SCALE 2026`, scale year 1. | | |
| E5 | ⚠ On C2 (CARLOS OFICIAL), set the seniority so his **next year-step falls on 16-Apr-2026** (manual seniority anchor: served in rank since 16-Apr-2025). | C2's engagement shows next step date 16-Apr-2026. **This date drives Phase L** — if it is wrong, L3 will fail. | | |
| E6 | Confirm C5 (SAMUEL PARTIDA) shows sign-on 15-Mar-2026 and C1–C4 show 01-Mar-2026. | Correct dates shown. | | |

> ⚠ Phase E is the only phase whose exact screen flow was not machine-verified; if a step's location differs, note where you actually performed it. All later figures depend only on the resulting data (dates, ranks, scale), which later phases confirm.

## Phase F — Vessel monthly entry, March 2026 (Ship / Vessel Admin on MV CHECKMATE)

Menu (as ship user): **Accounts → Vessel Portage**, month **March 2026**. Tabs: Crew & wages, Overtime, Cash advances, Allotments, Bond/slop chest, Other deductions, **Radio / Telephone** (your extra tab), CTM, Submit month.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| F1 | Open the **Overtime** tab. | One row per crew member. Read-only info columns show the OT **rate** and **Guaranteed hrs** from the scale: MST rate 15.00 / guaranteed **80** hrs; CO 10.00 / **80**; AB 7.50 / **80** (Appendix A.2). | | |
| F2 | Enter overtime hours: C1 = `10`, C3 = `20`. | Amounts auto-compute: C1 **150.00**, C3 **150.00** (A.3). An unsaved-changes counter appears (e.g. "2 unsaved changes"). | | |
| F3 | Click **Save** on the tab. | Toast "Overtime saved" (tab label + "saved"); counter clears. | | |
| F4 | **Cash advances** tab: add a dated column for `10-Mar-2026` ("+ Add date"), enter `300.00` for C3. Save. | Saved. | | |
| F5 | Open the **CTM** tab. | A line of type "cash advance to crew", amount **300.00**, exists for C3's advance. **Known issue:** the line's date shows the *entry* date (today), not 10-Mar-2026 — see Appendix B.1; do not fail. | | |
| F6 | **Allotments** tab: standing allotments column is read-only (empty for now — the office allotment is created in Phase I; ignore). In "This month extra" enter `500.00` for C2. Save. | Saved. | | |
| F7 | **Bond/slop chest** tab: add dated column `20-Mar-2026`, enter `60.00` for C1. Save. | Saved. | | |
| F8 | **Other deductions** tab: for C4 enter amount `45.00`, remarks `Crew mess damage`. Save. | Saved. | | |
| F9 | **Radio / Telephone** (extra) tab: enter `25.00` for C1. Save. | Saved — the extra tab accepts entries exactly like a built-in tab. | | |
| F10 | Make any small edit on any tab (do **not** save), then open **Submit month** and click Submit. | Submission is blocked with a toast telling you there are unsaved changes ("You have N unsaved change(s). Save every tab before submitting the month."). | | |
| F11 | Switch to another tab with the edit still unsaved. | Toast "Changes auto-saved" — tab switching auto-saves. Undo the stray edit (set the value back) and save. | | |
| F12 | Submit the month. | Status becomes **Submitted**; entry tabs become read-only for the vessel. | | |

## Phase G — Office review (accept / reject)

As **Office / Sail Admin**: **Accounts → Payroll → Monthly Txns**, vessel MV CHECKMATE, March 2026. You should see 7 vessel entries (2 overtime, 1 advance, 1 extra allotment, 1 bond, 1 other, 1 radio).

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G1 | **Reject** (X icon) C4's Other Deduction of 45.00. The "Reject Entry" dialog demands a reason; enter `No receipt attached — resubmit with the receipt number` and click Reject. | Rejecting without a comment is refused ("A review comment is required"); with the comment, the row's status becomes **Rejected**. | | |
| G2 | **Accept** (check icon) each of the remaining 6 entries. | All show status **Accepted**. | | |
| G3 | Switch to Ship / Vessel Admin, open March, find the rejected entry. | The row shows Rejected with the exact comment from G1. Switch back to Office. | | |

## Phase H — Calculation run & exact figures (Office / Sail Admin)

> **STOP — do not run H1 yet.** First execute Phase I steps **I1–I5** (office money screens). The calculation reads the standing allotment (800), the office advance (500) and the bond rollup (50); if you run the calc before creating them, every figure from H2 onward will be wrong. Execution order for this part of the script: **G → I1–I5 → H → I6 → J**.

Menu: **Accounts → Payroll → Payroll Run**, MV CHECKMATE, March 2026, Step 2 → **Run Calculation**.

| Gate | Check before continuing |
|---|---|
| ☐ | I1 done — standing allotment 800.00 for C2 exists |
| ☐ | I3 done — office advance 500.00 / recovery 200.00 for C4 exists |
| ☐ | I4–I5 done — bond rollup 50.00 for C4 exists |

| Step | Action | Expected result (all figures Appendix A.4–A.6) | P/F | Notes |
|---|---|---|---|---|
| H1 | Run the calculation for March 2026. | Run completes; per-crew rows appear. | | |
| H2 | Check per-crew totals: | C1: deductions **85.00**, net on board **7,265.00** · C2: 1,300.00 / **3,500.00** · C3: 300.00 / **3,450.00** · C4: 250.00 / **3,350.00** · C5: 0.00 / **2,040.00**. | | |
| H3 | Check vessel totals. | Earnings **21,540.00**, deductions **1,935.00**, net **19,605.00** (A.6). | | |
| H4 | Drill into **C5** (partial month). | Lines: Basic Wage **1,700.00**, Fixed Overtime **340.00** (both 15–31 Mar, **17** days served), Leave Pay **170.00** marked as settlement accrual. Derivation shown like "Monthly 3,000 × 17/30 days". | | |
| H5 | Drill into **C2**. | TWO allotment deduction lines: **800.00** (standing, from the register) and **500.00** (this-month extra) — never merged. Earnings 4,000 + 800; leave accrual 400. | | |
| H6 | Drill into **C4**. | Deductions: advance recovery **200.00** (first instalment of the 500 advance) and bond **50.00** (the office rollup, I4–I5). The rejected 45.00 does **not** appear. | | |
| H7 | Check leave/settlement accrual columns. | Leave this month: C1 600, C2 400, C3 300, C4 300, C5 170 → vessel accrual **1,770.00** (A.5). Balance B/F all **0.00**; Balance C/F equals each net (first month). | | |

## Phase I — Office money screens (execute I1–I5 before H1)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| I1 | **Crew Finance → Allotments**: create for C2 — beneficiary `MARIA OFICIAL`, relationship Spouse, type Fixed, value `800.00`, USD, bank `BDO Unibank`, account `004512345678`, valid from `01-Mar-2026`, status Active. | Saved. | | |
| I2 | Look at the allotments list, "Bank" column. | The account number is **masked**: shows as `•••• 5678` (only last 4 digits). | | |
| I3 | **Crew Finance → Cash & Bond → Advances**: create for C4 — amount `500.00`, USD, date `05-Mar-2026`, **Recovery per month `200.00`**, remarks `Family emergency`. | Before saving, the form shows "Recovery schedule preview — **3 month(s)**" with the final month highlighted (amber badge): 200 / 200 / **100** — the last instalment is clamped to the remaining balance (A.7). | | |
| I4 | **Cash & Bond → Bond**: create two items for C4 in March — `Cigarettes`, qty `2`, unit price `15.00`, total `30.00`, sale date 12-Mar-2026; and `Chocolate`, qty `1`, unit `20.00`, total `20.00`, sale date 18-Mar-2026 (auto-deduct ON). | Both saved. | | |
| I5 | Check the "Monthly Transaction Rollup" section (Bond tab) and Monthly Txns for March. | Exactly **one** rollup transaction for C4, amount **50.00** (30 + 20) — itemized purchases roll into a single monthly deduction, never two. | | |
| I6 | (After H1) Re-open the drill-downs of C2 and C4. | Each deduction appears **exactly once**: allotment 800 + 500 for C2; recovery 200 + bond 50 for C4. No doubling. | | |

## Phase J — Approval & locking (two office personas)

Menu: **Payroll Run → Office Review & Approvals** (March 2026). You will use **Sail Admin** (approver 1) and **Admin** (approver 2).

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| J1 | As Sail Admin, send the March portage bill for approval, naming **two approvers**: the Sail Admin user and the Admin user. | Status becomes **Office review**; two approval rows appear, both **Pending**. | | |
| J2 | Still as Sail Admin, try to decide the **Admin's** approval row (or vice-versa after switching). | Refused: *"This approval is assigned to a different approver"*. | | |
| J3 | As Sail Admin, approve your own row. | Row 1 = Approved; status still Office review (one approval outstanding). | | |
| J4 | Switch persona to Office **Admin**; approve the second row (comment `Checked against portage bill`). | Row 2 = Approved and — because auto-lock is ON — the month becomes **Locked** immediately. | | |
| J5 | As Office, try to **re-run the calculation** for March. | Refused with: *"Portage bill for vessel … period 2026-03 is locked; post an adjustment run into a later open period instead"*. | | |
| J6 | As Office, try to add a monthly transaction into March. | Refused: *"…locked; monthly transactions are read-only"*. | | |
| J7 | As Ship / Vessel Admin, try to edit any March tab. | Refused: *"Month 2026-03 is locked; vessel edits are not allowed"* — nothing is applied. | | |

## Phase K — Portage bill & print (Office / Sail Admin)

Menu: **Payroll → Portage Bill**, MV CHECKMATE, March 2026.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| K1 | Open the portage bill grid. | Columns: Crew, Rank, Sign On, Sign Off, one column per element code, Gross, Deductions, Net On Board, Balance B/F, Balance C/F, Leave C/F. One row per crew (5) plus a pinned **TOTAL** row. | | |
| K2 | Check the TOTAL row. | Gross **21,540.00** · Deductions **1,935.00** · Net On Board **19,605.00** · Leave C/F **1,770.00**. | | |
| K3 | Spot-check row C1. | Gross 7,350.00 (6,000 + 1,200 + 150 OT) · Deductions 85.00 · Net 7,265.00. | | |
| K4 | Click **Print**. | A printable portage bill renders with the same figures. | | |

## Phase L — Second month, April 2026 (mid-month step, carry-forward)

As **Ship / Vessel Admin**, month **April 2026**: enter overtime C1 = `8` hours (only entry this month). Save, Submit. As **Office**: accept it, then Run Calculation for April.

| Step | Action | Expected result (A.8–A.10) | P/F | Notes |
|---|---|---|---|---|
| L1 | Vessel: April Overtime C1 = 8 hrs; save; submit month. | OT amount **120.00** (8 × 15). Submitted. | | |
| L2 | Office: accept the entry; run April calculation. | Run completes for 5 crew (C5 serves 1–20 Apr). | | |
| L3 | Drill into **C2** — the mid-month year-step (16-Apr). | Basic Wage appears **twice**: **2,000.00** (1–15 Apr, 15 days, year-1 rate 4,000) and **2,200.00** (16–30 Apr, 15 days, year-2 rate 4,400). Fixed OT likewise 400.00 + 440.00; Leave 200.00 + 220.00. The two segments' days are 15 + 15 = **30** — never 29 or 31. | | |
| L4 | C2 April totals. | Earnings 5,040.00; deduction = standing allotment **800.00** only (no extra this month); net **4,240.00**. | | |
| L5 | Check carry-forward (Balance B/F) for all crew. | Equals March net exactly: C1 7,265.00 · C2 3,500.00 · C3 3,450.00 · C4 3,350.00 · C5 2,040.00. | | |
| L6 | C4 April drill-down. | Advance recovery **200.00** again (instalment 2 of 3). Net **3,400.00**; Balance C/F **6,750.00**. | | |
| L7 | C5 April (partial, sign-off 20-Apr). | Basic **2,000.00**, FOT **400.00**, Leave **200.00** — 20 days served (1–20 Apr, both inclusive). Net 2,400.00; Balance C/F **4,440.00**; Leave C/F **370.00** (170 + 200). | | |
| L8 | C1 April totals. | Net **7,320.00** (7,200 + 120 OT, no deductions); Balance C/F **14,585.00**. | | |

## Phase M — Settlement of C5 (Office / Sail Admin)

Menu: **Payroll → Settlements → New Settlement**. C5's engagement (ended 20-Apr-2026) appears in the ended-engagements list.

| Step | Action | Expected result (A.11) | P/F | Notes |
|---|---|---|---|---|
| M1 | Select C5's engagement and click **Compute**. | A draft settlement: unpaid on-board balance **4,440.00** + settlement accruals (leave) **370.00** = net payable **4,810.00**. | | |
| M2 | In "C · Settlement Adjustments" click **Add Adjustment**: pay element `OTHD`, type **Deduction**, amount `50.00`, remarks `Lost cabin key`. | Net payable changes to exactly **4,760.00** (4,810 − 50). | | |
| M3 | Click **Submit for Approval**, approver = the Office **Admin** user. | Status **Submitted**. Adding another adjustment is now refused ("Adjustments can only be edited while draft"). | | |
| M4 | Switch to Office Admin; approve the settlement. | Status **Approved**. | | |
| M5 | Click **Mark Paid**; paid date `05-May-2026`, reference `TT-2026-0455`. | Status **Paid** with that date and reference. | | |
| M6 | Verify the leave balance: C5's Leave C/F of 370.00 has been paid out in the settlement; his ledger's leave balance after settlement is **0**. If C5 were re-engaged, his next month would open with Balance B/F **0.00** (settled balances do not carry forward). | As stated. | | |
| M7 | Click **Print Statement**. | A printable settlement statement renders showing 4,440.00 + 370.00 − 50.00 = **4,760.00**. | | |

## Phase N — Reports (Office / Sail Admin)

| Step | Action | Expected result (A.12) | P/F | Notes |
|---|---|---|---|---|
| N1 | **Reports → Payslips**: view C5's **March** payslip. | Days served **17**; earnings Basic 1,700.00 + Fixed OT 340.00; settlement accrual Leave 170.00; net on board **2,040.00** — identical to the H4 drill-down, line for line. | | |
| N2 | **Reports → GL Export**, MV CHECKMATE, March 2026. | Rows (DR/CR): 5001 Basic Wage DR **17,700.00** · 5002 Fixed OT DR **3,540.00** · 5003 Variable OT DR **300.00** · allotments CR **1,300.00** total (the standing 800 and the extra 500 may show as two rows) · 2300 Advance Recovery CR **500.00** · 2400 Bond CR **110.00** · 2500 Radio CR **25.00** · 2100 Net wages payable CR **19,605.00**. | | |
| N3 | Check the GL totals row. | DR **21,540.00** = CR **21,540.00**, flagged **balanced**. Memo: settlement accrual 1,770.00. No "UNMAPPED" row (every element got a GL code in Phase B). | | |
| N4 | **Reports → Fleet Summary**, March 2026, row MV CHECKMATE. | Crew count **5**, gross **21,540.00**, deductions **1,935.00**, net payable **19,605.00**, settlement accrual **1,770.00** — reconciling exactly with the portage bill TOTAL row (K2). | | |

## Phase O — Permissions & negative tests

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O1 | As **Ship / Vessel Admin** on MV CHECKMATE, attempt to view another vessel's monthly transactions (pick any other vessel if one exists; otherwise via URL manipulation of the vessel parameter). | Refused: *"You are not assigned to this vessel"*. | | |
| O2 | As **Ship / Vessel User**, open the Accounts module. | Only vessel-side screens are available; office screens (Pay Elements, Wage Scales, approvals, Tenant Config) are not reachable in the navigation. | | |
| O3 | As Ship persona, check that office master screens are not offered in the sidebar/navigation. | Confirmed. **Note:** in this development build, direct *API* calls with a ship identity are not fully blocked for some office endpoints (Appendix B.2) — test at the UI level only; do not fail this run for API-level gaps. | | |
| O4 | Repeat F-style entry attempt on **March** (locked) as Ship. | Still refused (as J7). | | |
| O5 | As Office, try to activate a second wage scale with a line below the CBA floor without acknowledging (re-use D3 flow on a throwaway draft scale). | Same refusal text as D3. | | |

---

## Appendix A — Worked arithmetic (every figure above)

**Conventions.** Proration basis = 30-day month: a full month is 30/30 regardless of calendar length. Day counting is *both inclusive*. Prorated amount = monthly × daysServed ÷ 30, rounded to the nearest 0.01.

**A.1 CBA deficit** — AB Basic 3,000.00 vs CBA minimum 3,200.00 → deficit 3,200 − 3,000 = **200.00**.

**A.2 Guaranteed OT hours** = Fixed OT monthly ÷ OT hourly rate: MST 1,200 ÷ 15 = **80**; CO 800 ÷ 10 = **80**; AB 600 ÷ 7.50 = **80**.

**A.3 Variable OT (March)** — C1: 10 h × 15.00 = **150.00**; C3: 20 h × 7.50 = **150.00**. (April C1: 8 × 15.00 = **120.00**.)

**A.4 March per-crew** (full month = 30/30 unless noted):
- **C1 (Master)**: earnings 6,000 + 1,200 + 150 = 7,350.00; deductions bond 60 + radio 25 = 85.00; **net 7,265.00**; leave accrual 600.
- **C2 (CO, year 1)**: 4,000 + 800 = 4,800.00; deductions allotment 800 + 500 = 1,300.00; **net 3,500.00**; leave 400.
- **C3 (AB)**: 3,000 + 600 + 150 = 3,750.00; deduction cash advance 300.00; **net 3,450.00**; leave 300.
- **C4 (AB)**: 3,000 + 600 = 3,600.00; deductions recovery 200 + bond rollup 50 = 250.00 (the rejected 45 is excluded); **net 3,350.00**; leave 300.
- **C5 (AB, 15–31 Mar)**: 15→31 March both inclusive = 17 calendar days (counts as 17/30). Basic 3,000 × 17/30 = **1,700.00**; FOT 600 × 17/30 = **340.00**; Leave 300 × 17/30 = **170.00** (accrual). **Net 2,040.00**.

**A.5 March leave accrual total** = 600 + 400 + 300 + 300 + 170 = **1,770.00**.

**A.6 March vessel totals** — earnings 7,350 + 4,800 + 3,750 + 3,600 + 2,040 = **21,540.00** (leave accruals are *not* on-board earnings); deductions 85 + 1,300 + 300 + 250 + 0 = **1,935.00**; net 21,540 − 1,935 = **19,605.00**.

**A.7 Advance recovery schedule** — advance 500.00, recovery 200.00/month: instalments 200 (Mar), 200 (Apr), then min(200, 500 − 400) = **100** (May). 3 months; final clamped.

**A.8 C2 April mid-month step (step date 16-Apr)** — segment 1 = 1–15 Apr = 15 days; segment 2 = 16–30 Apr = 30 − 15 = 15 days (segments always sum to 30). Basic: 4,000 × 15/30 = **2,000.00**; 4,400 × 15/30 = **2,200.00** (total 4,200). FOT: 400.00 + 440.00 = 840. Leave: 200.00 + 220.00 = 420. Earnings 4,200 + 840 = 5,040; net 5,040 − 800 = **4,240.00**.

**A.9 April others** — C1: 6,000 + 1,200 + 120 = 7,320.00 net (no deductions). C3: 3,600.00 net. C4: 3,600 − 200 = **3,400.00**. C5 (1–20 Apr = 20 days): Basic 3,000 × 20/30 = 2,000.00; FOT 400.00; Leave 200.00; net **2,400.00**.

**A.10 Balances C/F after April** — B/F (= March net) + April net: C1 7,265 + 7,320 = **14,585.00** · C2 3,500 + 4,240 = **7,740.00** · C3 3,450 + 3,600 = **7,050.00** · C4 3,350 + 3,400 = **6,750.00** · C5 2,040 + 2,400 = **4,440.00**. C5 leave C/F = 170 + 200 = **370.00**.

**A.11 C5 settlement** — unpaid on-board balance 4,440.00 + leave accrual 370.00 = 4,810.00; minus adjustment 50.00 → **4,760.00**.

**A.12 GL export (March)** — DR: Basic 6,000+4,000+3,000+3,000+1,700 = **17,700.00**; Fixed OT 1,200+800+600+600+340 = **3,540.00**; Variable OT 150+150 = **300.00**. DR total **21,540.00**. CR: allotments 1,300 + recovery/advance 500 (200 recovery + 300 cash advance) + bond 110 (60 + 50) + radio 25 + net wages payable 19,605 = **21,540.00**. Balanced.

## Appendix B — Known issues to ignore (do not raise as defects)

1. **CTM auto-line date** (observed 27-Jul-2026): when the vessel records a *dated* cash advance, the mirrored CTM "cash advance to crew" line is dated with the **entry date (today)**, not the advance's dated column. Amount and linkage are correct.
2. **Dev-build API permission gaps** (observed 27-Jul-2026): with `AUTH_BYPASS=true`, some office-only API endpoints (e.g. creating pay elements, running a calculation) do not reject a ship identity, and unauthenticated GETs may return data. Vessel *scoping* (O1) works. Test permissions at the UI level in this build.
3. The standing allotment may appear in the GL export as its own row (pseudo-code separate from the ALLOT element row). The combined allotment credit must still be 1,300.00.

## Defect report template

```
ID: DEF-___        Date: ____-__-__      Tester: ______________
Script step: (e.g. H4)                   Persona/vessel: ______________
Build/commit: ______________
Summary (one line): ______________________________________________
Steps to reproduce: 1) ... 2) ... 3) ...
Expected (from the script, incl. exact figure): ___________________
Actual (screenshot attached? Y/N): ________________________________
Severity: Blocker / Major / Minor / Cosmetic
Notes / suspected cause: __________________________________________
```

## Sign-off sheet

| | |
|---|---|
| Tester name / signature | |
| Date(s) of execution | |
| Build / commit hash | |
| Steps executed / passed / failed | ______ / ______ / ______ |
| Defects raised (IDs) | |
| Overall verdict | ☐ Accept ☐ Accept with defects ☐ Reject |
| Reviewer (name / date) | |
