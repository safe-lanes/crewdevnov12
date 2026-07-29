# Accounts Module — Manual Test Script
## Vessel 04 · March–April 2026 · End-to-end verification

| | |
|---|---|
| **Purpose** | Verify the entire Accounts module end-to-end: tenant configuration, pay elements, wage scales, CBA floor violation, crew engagement sync, vessel-side monthly entry, office review, office money screens, wage calculation, approvals & locking, portage bill, a second month with a mid-month wage step, allotment suspension, final settlement, settlement-skip re-run, and reports. |
| **Build under test** | Development build served by the "Start application" workflow (port 5000). Record the git commit hash on the sign-off sheet before starting. |
| **Script date** | 29 July 2026 |
| **Estimated time** | 6–7 hours for one careful pass (Phases A–O). Natural break points: after Phase J (portage bill) and after Phase N (settlement). |
| **Audience** | Manual testers. **No maritime or payroll knowledge is required.** Every term is defined in the Glossary; every value to type is given exactly; every expected figure is pre-computed in Appendix A. |
| **Recording results** | Print or copy this document. For each step, tick Pass/Fail and note anything unexpected in the Notes column. Use the Defect Report Template at the end for every Fail. |
| **Verification status** | Every money figure in this script was verified against the live calculation engine (API-level walk-through on 29 Jul 2026). Steps whose exact on-screen wording could not be verified hands-on are marked ⚠ — treat small wording differences there as a Note, not a Fail, as long as the meaning and the figures match. |

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
| **Proration** | Paying part of a monthly amount when someone works only part of the month. This app uses a **30-day month**: a full month always counts as 30 days, no matter the calendar. |
| **Portage bill** | The vessel's monthly wage summary: one row per crew member with earnings, deductions and net pay. |
| **Monthly transaction** | A single one-off money line for one crew member in one month (e.g. overtime hours, a cash advance). |
| **Overtime — fixed vs variable** | Fixed overtime = a flat monthly allowance (GOT). Variable overtime = extra hours × an hourly rate (OTV). |
| **Allotment** | A standing instruction to send part of the wage to a family member's bank account ashore. |
| **Cash advance** | Wages paid early, in cash, on board. Deducted from that month's pay. |
| **Advance (office) & recovery** | A loan arranged by the office, paid back ("recovered") in monthly instalments withheld from pay. |
| **Bond / Slop chest** | The ship's small onboard shop (cigarettes, chocolate, etc.). Purchases are deducted from pay. |
| **CTM** | Cash To Master — the box of physical cash the captain holds. Cash advances paid on board reduce it. |
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
| P3 | **Clean state.** Run `npx tsx scripts/reset-accounts-data.ts --confirm` in the workspace terminal. The script prints a per-table row count and confirms 0 errors. It wipes **only** Accounts data (pay elements, scales, engagements, ledger lines, etc.) and resets tenant config to defaults. Crew, vessels and assignments in the main system are untouched. | Script prints "✅ Done — N rows deleted" (N ≥ 0). Running it a second time immediately prints all zeros. If the script refuses with "production guard", verify `NODE_ENV` is not `production`. |
| P4 | The Accounts module is reached via the **Module Navigator** (grid icon in the top bar) → **Accounts**. Open it once now. | Accounts sidebar appears with (top, no heading): Payroll Run, Vessel Portage, Monthly Txns, Portage Bill, Settlements, Allotments & Cash; then a **Reports** heading (Payslips, GL Export, Fleet Summary); then a **Config** heading (Pay Elements, Wage Scales, CBA Ref, Tenant Config). |
| P5 | Confirm **vessel 04** exists. In the Module Navigator go to Vessels (or Crewing → Vessels). | A vessel named "vessel 04" is listed. Note its internal vessel UUID if shown (optional). |

### Persona-switch guide

Switch personas using the round user icon (P2). When you pick a **Ship** persona you must also choose the vessel — always choose **vessel 04**.

| Phase | Persona |
|---|---|
| A–E | Office — **Sail Admin** |
| F | Office — Sail Admin (calc runs and anchor confirmation) |
| G | Ship — **Vessel Admin** (on vessel 04) for entry; then Office — Sail Admin for review |
| H | Office — Sail Admin |
| I | Office — Sail Admin (office money entries) |
| J | Office — Sail Admin (calculation and figures) |
| K | Office — Sail Admin (submit) + Office — **Admin** (approve); auto-lock fires on approval |
| L | Office — Sail Admin (portage bill & print) |
| M | Ship — Vessel Admin (April entry); then Office — Sail Admin (calc) |
| N | Office — Sail Admin (settlement V4) |
| O | Office — Sail Admin (reports); negative test as Ship — Vessel User |

### The working-set crew (the five crew members you will track closely)

Vessel 04 has **26 active crew** in March 2026. This script focuses on five of them ("the working set") because they cover every pay feature. The other 21 appear only in the warning tally. All five are pre-loaded in the system; do **not** create new crew members.

| Code | Name | Rank | Sign-on | Sign-off |
|---|---|---|---|---|
| V1 | SANJAY VERMA | Master | 01-Mar-2026 | — |
| V2 | IVAN JURIC | Chief Officer | 01-Mar-2026 | — (Year 2 step 16-Apr-2026) |
| V3 | AMIT SHARMA | Able Seaman | 07-Mar-2026 | — |
| V4 | DMITRIY SOKOLOV | Able Seaman | 07-Mar-2026 | 20-Apr-2026 (recorded by Master) |
| V5 | MANOJ REDDY | Able Seaman | 07-Mar-2026 | — |

---

## Phase A — Tenant configuration (Office / Sail Admin)

Menu: **Accounts → Config → Tenant Config** (bottom of the sidebar, under the Config heading).

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| A1 | Open Tenant Config. | A settings form loads showing preparation mode, proration basis, day inclusion rule, functional currency, FX policy, GL wages payable account, max allotment percent, employment models, seniority settings, auto-lock, and vessel entry tab slots. | | |
| A2 | Set **Preparation mode** = `Vessel prepares`, **Proration basis** = `30-day month`, **Day inclusion rule** = `Both inclusive`, **Functional currency** = `USD`, **FX policy** = `Month end`. | Values accepted. | | |
| A3 | Set **GL wages payable account** = `2000`, **Max allotment percent** = `80`, **Auto-lock on approval** = ON. | Values accepted. | | |
| A4 | Leave **Vessel entry tab 1** disabled for now (you will enable it in B10 after the COMM element exists). Save the configuration. | A success message; reopening the page shows the saved values. | | |
| A5 | ⚠ Negative: enable Vessel entry tab 1 with a label but **no pay element selected**, then try to save. | Refused with a validation error (both label and element are required). Disable the tab again and save successfully. | | |

---

## Phase B — Pay elements (Office / Sail Admin)

Menu: **Accounts → Config → Pay Elements**. Create nine elements one by one. For every element unless otherwise stated: **Rounding rule** = `Nearest`, **Rounding precision** = `0.01`, **Status** = `Active`, **Payment timing** = `Paid on board`.

| Step | Code / Name | Type / Category / Calc method / Special | GL code | P/F | Notes |
|---|---|---|---|---|---|
| B1 | `BASIC` / Basic Wage | Earning · Basic · Scale lookup · **Prorate ON** | `5001` | | |
| B2 | `GOT` / Guaranteed Overtime | Earning · Fixed overtime · Scale lookup · Prorate ON | `5002` | | |
| B3 | `OTV` / Variable Overtime | Earning · Variable overtime · Rate × quantity · **Prorate OFF** | `5003` | | |
| B4 | `LEAVE` / Leave Pay | Earning · Leave · Scale lookup · Prorate ON · **Payment timing = Payable at settlement** | `5004` | | |
| B5 | `ALLOT` / Allotment | Deduction · Allotment · Manual entry | `2200` | | |
| B6 | `ADVR` / Advance Recovery | Deduction · Advance recovery · Fixed amount | `2300` | | |
| B7 | `BOND` / Bond / Slop Chest | Deduction · Bond–slop chest · Manual entry | `2400` | | |
| B8 | `COMM` / Radio / Telephone | Deduction · Communication · Manual entry | `2500` | | |
| B9 | `OTHD` / Other Deduction | Deduction · One-off · Manual entry | `2600` | | |
| B10 | Return to **Tenant Config**; enable **Vessel entry tab 1** with label `Radio / Telephone` bound to element `COMM`. Save. | Config saved; reopening shows the extra tab configured. | | |
| B11 | ⚠ Negative: try to create another element reusing code `BASIC`. | Refused with a duplicate-code error. | | |

---

## Phase C — Wage scale (Office / Sail Admin)

Menu: **Accounts → Config → Wage Scales**. Create the scale first, then add all 16 lines.

**C1 — Create the scale header**

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| C1 | Click **New Wage Scale**. Enter name `VESSEL 04 SCALE 2026`, currency `USD`, effective from `2025-01-01`, scope `Fleet-wide` (no specific vessel type). Save. | Scale is created in **Draft** status; the Lines tab is now active. | | |

**C2 — Add scale lines (16 lines, all in USD/month unless the column says /hr)**

For each line: click **Add Line**, choose the rank, element, and experience year, enter the amount, save.

| Line | Rank | Rank code | Element | Year | Amount |
|---|---|---|---|---|---|
| 1 | Master | R001 | BASIC | Year 1 | `7000.00` |
| 2 | Master | R001 | GOT | Year 1 | `1400.00` |
| 3 | Master | R001 | OTV | Year 1 | `17.50` /hr |
| 4 | Master | R001 | LEAVE | Year 1 | `700.00` |
| 5 | Chief Officer | R002 | BASIC | Year 1 | `5000.00` |
| 6 | Chief Officer | R002 | GOT | Year 1 | `1000.00` |
| 7 | Chief Officer | R002 | OTV | Year 1 | `12.50` /hr |
| 8 | Chief Officer | R002 | LEAVE | Year 1 | `500.00` |
| 9 | Chief Officer | R002 | BASIC | **Year 2** | `5500.00` |
| 10 | Chief Officer | R002 | GOT | **Year 2** | `1100.00` |
| 11 | Chief Officer | R002 | OTV | **Year 2** | `13.75` /hr |
| 12 | Chief Officer | R002 | LEAVE | **Year 2** | `550.00` |
| 13 | Able Seaman | R015 | BASIC | Year 1 | `3000.00` |
| 14 | Able Seaman | R015 | GOT | Year 1 | `600.00` |
| 15 | Able Seaman | R015 | OTV | Year 1 | `7.50` /hr |
| 16 | Able Seaman | R015 | LEAVE | Year 1 | `300.00` |

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| C2 | Add all 16 lines as shown. | After each save, the line appears in the Lines list. The scale still shows **Draft** status. Total lines: 16. | | |
| C3 | ⚠ Spot-check: open the Chief Officer entry for BASIC and verify Year 1 = 5,000 and Year 2 = 5,500 are both present as separate rows. | Two separate CO BASIC rows exist (Year 1 and Year 2). | | |

---

## Phase D — CBA reference, floor violation, and scale activation (Office / Sail Admin)

**D1 — Create the CBA reference**

Menu: **Accounts → Config → CBA Ref**. Click **New CBA Reference**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| D1 | Enter name `ITF MINIMUM 2026`, effective from `2026-01-01`. Add one floor entry: rank **Able Seaman (R015)**, element **BASIC**, minimum `3200.00` USD. Save. | CBA reference saved; shows 1 floor entry. | | |
| D2 | ⚠ Note for awareness: the scale has AB BASIC = 3,000 and the CBA minimum is 3,200 — a deliberate deficit of **200.00**. The floor violation will surface when the scale is activated. | — | | |

**D2 — Activate the scale (with acknowledged floor violation)**

Menu: **Accounts → Config → Wage Scales** → open **VESSEL 04 SCALE 2026**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| D3 | Click **Activate** (or similar button). The system performs a floor check against all active CBA references. | A floor-violation warning appears: **1 violation** — Able Seaman (R015) · BASIC · scale value 3,000.00 · CBA minimum 3,200.00 · deficit **200.00**. The activation prompt asks you to acknowledge and proceed. | | |
| D4 | Check the "I acknowledge the floor violation" checkbox and confirm activation. | Scale status changes to **Active**. The floor violation is recorded (acknowledged-by and acknowledged-at are visible). Scale remains usable. | | |
| D5 | ⚠ Negative: attempt to activate the scale a second time. | Refused — "Only draft scales can be activated" (scale is already active). | | |

---

## Phase E — Engagement sync (Office / Sail Admin)

**Context:** vessel 04 has 27 crew assignments in the system. One of them (IRWAN SUBEKTI, signed off 28-Feb-2026) is not active in March. The sync for period **2026-03** should create **26 engagements** and skip IRWAN SUBEKTI.

Menu: **Accounts → Payroll Run** → select **vessel 04** → select period **2026-03** → navigate to the **Crew & Engagements** step.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| E1 | Click **Sync Engagements** (or "Sync from Crew System") for vessel 04, period 2026-03. | Progress indicator; then a results summary. | | |
| E2 | Check the sync result. | **26 created, 0 errors.** IRWAN SUBEKTI is not in the list (correctly excluded — their sign-off was 28 Feb). | | |
| E3 | Scroll the engagement list. Confirm the five working-set crew appear: SANJAY VERMA (Master), IVAN JURIC (Chief Officer), AMIT SHARMA (AB), DMITRIY SOKOLOV (AB), MANOJ REDDY (AB). | All five are listed. V1 and V2 show start date 01-Mar-2026. V3, V4, V5 show start date 07-Mar-2026. | | |
| E4 | Confirm all 26 engagements show **scale assigned** (the scale name "VESSEL 04 SCALE 2026" or its UUID is linked). | No "no scale" badge on any engagement. (Some crew have rank codes for which no scale line exists — that is expected and will surface as a warning during calc.) | | |
| E5 | ⚠ Negative: run the sync a second time. | No new engagements created; result shows **0 created, 26 skipped (already exist)** or equivalent. | | |

---

## Phase F — Seniority anchor warning sequence (Office / Sail Admin)

### Why this phase exists

The engine cannot determine which "Year 1 / Year 2" rate applies until the office confirms the seniority anchor date for each crew member. Until confirmed, the engine runs on the Year 1 default and emits a warning. This phase walks through the full warning-confirmation-re-run cycle.

### F1 — First calculation run (47 warnings expected)

Menu: **Accounts → Payroll Run** → vessel 04 → period **2026-03** → **Run Calculation**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| F1 | Click **Run Calculation** for vessel 04, March 2026. | Run completes (no error). A warning banner appears. | | |
| F2 | Open the warnings list. Count the total. | **47 warnings** total: **26** seniority-anchor warnings ("Seniority anchor not confirmed for …") + **21** no-scale-line warnings ("No scale line for … on scale VESSEL 04 SCALE 2026"). | | |
| F3 | Confirm the 26 anchor warnings cover exactly the 26 synced engagements (all crew currently on the vessel). | ✓ Every engaged crew member has exactly one anchor warning. | | |
| F4 | Confirm the 21 no-scale-line warnings match the non-working-set crew (those whose rank has no lines in the scale). See Appendix C for the full list of 21 names. | ✓ No anchor or no-scale warning for ranks that do have scale lines (Master, Chief Officer, Able Seaman). | | |

### F2 — Bulk-confirm seniority anchors for 25 crew

Menu: **Accounts → Payroll Run** → vessel 04 → period 2026-03 → Crew & Engagements → **Contracts** list (or equivalent bulk-action screen).

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| F5 | Select all **25** engagements **except IVAN JURIC** (V2). Use the bulk-select checkbox if available, then deselect V2. | 25 engagements selected. V2 (IVAN JURIC) is not selected. | | |
| F6 | Apply the bulk action **"Confirm seniority anchor (Year 1 default)"**. | 25 engagements confirmed; their anchor warning is cleared. V2 remains unconfirmed. | | |

### F3 — Set IVAN JURIC's seniority anchor individually

IVAN JURIC needs a specific seniority anchor because he will reach Year 2 on **16 April 2026** — testing the mid-month wage step. His anchor date in the Chief Officer rank is **16 April 2025** (exactly 12 months before the step).

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| F7 | Click IVAN JURIC's name to open his contract / engagement detail. Locate the **Seniority** section. | A seniority form shows fields for "In-rank since" (anchor date) and "Next step date". | | |
| F8 | Set **"In-rank since" (anchor date)** = `2025-04-16`. The system should auto-fill **Next step date** = `2026-04-16`. Save. | Saved. The anchor warning for V2 is cleared. The "Next step date" column in the engagement list shows 16-Apr-2026. | | |

### F4 — Second calculation run (21 warnings, 0 anchor warnings)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| F9 | Run Calculation again for vessel 04, March 2026. | Run completes. Warning count drops to **21**. | | |
| F10 | Confirm: **0** anchor warnings, **21** no-scale-line warnings. The 21 no-scale warnings are for the crew whose ranks have no scale lines (same 21 names as before; see Appendix C). | ✓ No anchor warnings remaining. 21 no-scale warnings match Appendix C. | | |
| F11 | Verify the base figures for the working-set crew in the calc results (no entries yet, so these are pure scale values): V1 gross **8,400.00**, V2 gross **6,000.00**, V3/V4/V5 gross **3,000.00** each. Leave accrual (not in gross): V1 700, V2 500, V3/V4/V5 250 each. | ✓ All five match. | | |

---

## Phase G — Vessel monthly entry, March 2026 (Ship / Vessel Admin on vessel 04)

Switch to persona: **Ship — Vessel Admin (vessel 04)**.

The captain's crew enters the variable items for March. Navigate to **Accounts → Payroll Run** (vessel-side view) → vessel 04 → March 2026.

### G1 — Variable overtime (OTV tab)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G1 | Open the **Overtime** tab (or the OTV section of the monthly entry screen). | A grid shows all engaged crew. The column "Hours worked" (or equivalent) is editable. | | |
| G2 | For **SANJAY VERMA (V1)**: enter **10 hours**. | Row shows hours = 10. Computed amount = 10 × 17.50 = **175.00** (preview or editable). | | |
| G3 | For **AMIT SHARMA (V3)**: enter **20 hours**. | Row shows hours = 20. Computed amount = 20 × 7.50 = **150.00**. | | |

### G2 — Cash advance (vessel side)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G4 | Open the **Cash Advances** tab (or CTM / cash advance section). | A form to add a cash advance for a crew member. | | |
| G5 | Add advance: crew = **DMITRIY SOKOLOV (V4)**, amount = **300.00** USD, date = **2026-03-12**. Save. | Record saved. CTM balance reduced by 300.00 (if CTM balance is shown). | | |

### G3 — Extra allotment this month

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G6 | Open the **Allotments** tab (or allotment entry for this month). | Shows standing allotments (if any) and a field for a one-off extra amount. | | |
| G7 | For **IVAN JURIC (V2)**: enter an extra allotment of **600.00** USD for March 2026 only. | Extra allotment of 600.00 saved for V2 in this month. | | |

### G4 — Bond / slop chest

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G8 | Open the **Bond / Slop Chest** tab. | A grid for entering purchases. | | |
| G9 | For **SANJAY VERMA (V1)**: add one purchase, amount **80.00**, date **2026-03-20**. (Description = "Goods" or any text.) | Bond deduction of 80.00 added for V1. | | |

### G5 — Extra tab (Radio / Telephone = COMM)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G10 | Open the **Radio / Telephone** tab (the extra tab configured in B10). | A grid or form for communication deductions. | | |
| G11 | For **SANJAY VERMA (V1)**: enter **25.00**. | Saved. | | |
| G12 | For **MANOJ REDDY (V5)**: enter **40.00**. | Saved. | | |

### G6 — Submit to office

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| G13 | Click **Submit to office** (or equivalent). | The vessel-side entry is locked; status changes to "Submitted" or "Awaiting review". The five entries (V1 OT, V3 OT, V4 advance, V2 extra allotment, V1 bond, V1 COMM, V5 COMM) are all visible in the submitted state. | | |

---

## Phase H — Office review of vessel entries (Office / Sail Admin)

Switch back to persona: **Office — Sail Admin**.

Menu: **Accounts → Payroll Run** (or **Monthly Txns**) → vessel 04 → March 2026 → review the submitted entries.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| H1 | Open the vessel entries review screen. | All submitted entries are listed with an Accept / Reject action for each. | | |
| H2 | **Accept** the following five entries: V1 OT (10 hr / 175.00), V3 OT (20 hr / 150.00), V4 cash advance (300.00), V2 extra allotment (600.00), V1 bond (80.00), V1 COMM (25.00). | Each accepted entry shows "Accepted" status. | | |
| H3 | **Reject** V5's COMM entry (40.00). Rejection reason: `No receipt attached — resubmit with receipt`. | Entry status shows "Rejected". V5's COMM amount is **not** included in the ledger. | | |
| H4 | Switch to **Ship — Vessel Admin (vessel 04)**. | The vessel-side view shows V5's COMM entry is marked as rejected with the reason provided. | | |
| H5 | Switch back to **Office — Sail Admin**. | — | | |

---

## Phase I — Office money entries, March 2026 (Office / Sail Admin)

These entries are created by the office, not the vessel. They go into the same March 2026 ledger.

### I1 — Standing allotment for V2

Menu: **Accounts → Allotments & Cash** (or Allotments register) → **New Allotment**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| I1 | Create a standing allotment: crew = **IVAN JURIC (V2)**, element = **ALLOT**, beneficiary name = `Elena Juric`, amount = **800.00** USD, valid from `2026-03-01`, fixed amount (not percentage). Save. | Allotment record saved with status "Active". | | |
| I2 | Return to the March 2026 portage. Verify V2's allotment deductions now show **1,400.00** total (800.00 standing + 600.00 extra this month). | ✓ V2 has two ALLOT lines: 800 and 600. | | |

### I2 — Office advance and recovery for V5

Menu: **Accounts → Allotments & Cash** (or Advances) → **New Advance**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| I3 | Create an office advance: crew = **MANOJ REDDY (V5)**, element = **ADVR**, principal = **600.00** USD, recovery amount = **200.00** per month, first recovery period = `2026-03`. Save. | Advance record saved. A preview shows 3 recovery instalments: Mar 200, Apr 200, May 200. | | |
| I4 | Verify the March ledger now shows a 200.00 ADVR deduction for V5 (instalment 1 of 3). | ✓ V5 has ADVR 200.00 in March. | | |

### I3 — Bond rollup for V4 (office-side purchases)

Menu: **Accounts → Payroll Run** → vessel 04 → March 2026 → Bond / Slop Chest (office tab).

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| I5 | Add bond purchase for **DMITRIY SOKOLOV (V4)**: item `Cigarettes`, quantity **2**, unit price **25.00**, sale date `2026-03-15`. | Bond line: 2 × 25.00 = **50.00** for V4. | | |
| I6 | Verify V4's bond total shows **50.00** (office-side only; no vessel-side bond for V4). | ✓ V4 BOND = 50.00. | | |

---

## Phase J — Calculation run & exact figures (Office / Sail Admin)

Now that all entries are in, run the final March calculation.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| J1 | Run Calculation for vessel 04, March 2026. | Run completes. 21 warnings (all no-scale-line; no anchor warnings remaining). | | |
| J2 | Open the portage bill or calc results. Verify each working-set crew member's figures against the table below. All figures in USD. | See Appendix A for full arithmetic. | | |

**March 2026 — expected figures for the working set**

> Proration rule: V3, V4, V5 signed on 07-Mar-2026. With "both inclusive" and 30-day month, their service is 07-Mar to 31-Mar = **25 days** (7th and 31st both count). Proration factor = 25/30. BASIC and GOT are prorated; OTV is not prorated; LEAVE is prorated.

| Crew | Days served | BASIC | GOT | OTV | Gross paid | Deductions | Net on board | Leave accrual |
|---|---|---|---|---|---|---|---|---|
| V1 SANJAY VERMA | 30 | 7,000.00 | 1,400.00 | 175.00 | **8,575.00** | 105.00 ¹ | **8,470.00** | 700.00 |
| V2 IVAN JURIC | 30 | 5,000.00 | 1,000.00 | — | **6,000.00** | 1,400.00 ² | **4,600.00** | 500.00 |
| V3 AMIT SHARMA | 25 | 2,500.00 | 500.00 | 150.00 | **3,150.00** | — | **3,150.00** | 250.00 |
| V4 DMITRIY SOKOLOV | 25 | 2,500.00 | 500.00 | — | **3,000.00** | 350.00 ³ | **2,650.00** | 250.00 |
| V5 MANOJ REDDY | 25 | 2,500.00 | 500.00 | — | **3,000.00** | 200.00 ⁴ | **2,800.00** | 250.00 |
| **Vessel total** | | | | | **23,725.00** | **2,055.00** | **21,670.00** | **1,950.00** |

¹ V1 deductions: BOND 80.00 + COMM 25.00 = 105.00  
² V2 deductions: ALLOT standing 800.00 + ALLOT extra 600.00 = 1,400.00  
³ V4 deductions: vessel cash advance 300.00 + BOND rollup 50.00 = 350.00  
⁴ V5 deductions: ADVR recovery instalment 1 of 3 = 200.00  

**Balance carried forward (running unpaid balance after March):**

| Crew | Balance B/F | Net on board | Balance C/F |
|---|---|---|---|
| V1 | 0.00 | 8,470.00 | **8,470.00** |
| V2 | 0.00 | 4,600.00 | **4,600.00** |
| V3 | 0.00 | 3,150.00 | **3,150.00** |
| V4 | 0.00 | 2,650.00 | **2,650.00** |
| V5 | 0.00 | 2,800.00 | **2,800.00** |

| Step | Check | Expected result | P/F | Notes |
|---|---|---|---|---|
| J3 | Verify vessel-level totals: Gross = **23,725.00**, Net = **21,670.00**. | ✓ | | |
| J4 | Drill into V3 (AMIT SHARMA). Check the proration note on BASIC. | BASIC shows 3,000.00 × 25/30 = **2,500.00** with a proration indicator. | | |
| J5 | Drill into V2 (IVAN JURIC). Check the two ALLOT deduction lines. | Two ALLOT lines: 800.00 (standing allotment) and 600.00 (extra this month). Total deductions = 1,400.00. | | |
| J6 | Drill into V4 (DMITRIY SOKOLOV). Check the deduction breakdown. | Two deduction lines: vessel cash advance 300.00 and BOND rollup 50.00. Total = 350.00. | | |
| J7 | Drill into V1 (SANJAY VERMA). Confirm two deduction lines: BOND 80.00 and COMM 25.00. Total = 105.00. | ✓ | | |
| J8 | Confirm V5 (MANOJ REDDY) has **no** COMM line (rejected in H3) and shows ADVR 200.00 as the only deduction. | ✓ V5 deductions = 200.00 ADVR only. | | |
| J9 | Verify Balance C/F for each crew member matches the table above. | ✓ All five B/F = 0.00 (first month); C/F = Net on board. | | |

---

## Phase K — Approval & locking (Office — Sail Admin + Office — Admin)

The system requires two separate office personas for the approval workflow (separation of duties). Auto-lock fires on the second approval.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| K1 | As **Office — Sail Admin**: navigate to the March 2026 portage bill. Click **Submit for approval** (or "Send to review"). | Status changes to "Submitted" or "Awaiting approval". | | |
| K2 | Switch to **Office — Admin** persona. Open the same vessel 04 / March 2026 portage. | The portage bill is visible in a pending-approval state. The figures are the same. | | |
| K3 | As Office — Admin: click **Approve**. | Because Auto-lock is ON (configured in A3), the period is immediately **Locked** after approval. | | |
| K4 | ⚠ Negative: as Office — Sail Admin, try to edit any entry in the locked March 2026 period. | Edit is refused — "This period is locked." | | |
| K5 | ⚠ Negative (SoD check): as Office — Sail Admin, switch back to Sail Admin and try to both submit AND approve the same portage in a new test period. This requires a second period — skip this step if you do not have a second vessel month to use as a scratch pad. | If attempted, the system refuses the second action with a separation-of-duties error (same user cannot be both submitter and approver). | | |

---

## Phase L — Portage bill & print (Office / Sail Admin)

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| L1 | Navigate to **Accounts → Portage Bill** → vessel 04 → March 2026. | The portage bill is displayed in a printable/exportable format. | | |
| L2 | Verify the portage bill header shows: vessel = vessel 04, period = March 2026, currency = USD, status = Locked. | ✓ | | |
| L3 | Verify the portage bill lists all 26 crew members. | ✓ The 5 working-set crew show exact figures from Phase J. The 21 non-computing crew show zero wages (no scale lines for their ranks). | | |
| L4 | Verify the vessel-level totals row: Gross = **23,725.00**, Net = **21,670.00**, Leave accrual = **1,950.00**. | ✓ | | |
| L5 | ⚠ Export / print: click the Export or Print button. | A PDF or printable view is generated. The figures are legible and match the on-screen totals. | | |

---

## Phase M — April 2026: vessel entry, year-step, and allotment management

### Context for April

- **V2 IVAN JURIC** reaches Year 2 on **16 April 2026**. The engine must split the month: Apr 1–15 at Year 1 rates, Apr 16–30 at Year 2 rates.
- **V4 DMITRIY SOKOLOV** has a master-recorded sign-off on **20 April 2026**. He will be settled in Phase N.
- V5's advance recovery continues: **instalment 2 of 3 = 200.00** in April.
- V2's standing allotment of 800.00 carries forward automatically. The 600.00 extra allotment was March-only.

### M1 — Sync April engagements

Menu: **Accounts → Payroll Run** → vessel 04 → period **2026-04** → Crew & Engagements.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| M1 | Run sync for vessel 04, period **2026-04**. | Engagements updated/created for April. V4 should reflect end date 2026-04-20 (already recorded by the Master). | | |
| M2 | Verify that V2 (IVAN JURIC) shows **Next step date = 2026-04-16** and **Year 2 flag** active after the step date. | ✓ The engine knows to split the month. | | |
| M3 | ⚠ Verify that the standing allotment for V2 (800.00) is automatically re-applied in April without any action. | V2 April allotments show at least 800.00 (standing). The 600.00 extra from March does **not** appear. | | |

### M2 — Vessel entry for April (Ship — Vessel Admin)

Switch to: **Ship — Vessel Admin (vessel 04)**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| M4 | In the OTV tab for April, enter for **SANJAY VERMA (V1)**: **8 hours**. | Computed = 8 × 17.50 = **140.00**. | | |
| M5 | Submit April entries to office. | Status: submitted. | | |

### M3 — Office review and April calculation

Switch to: **Office — Sail Admin**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| M6 | Accept V1's OT entry (140.00). | Accepted. | | |
| M7 | Run Calculation for vessel 04, April 2026. | Run completes. **19 warnings** (all no-scale-line — DEDE ANDREA ISMAIL and AUNG PYONE MYINT MYAT have now left, so two fewer non-computing crew than March). 0 anchor warnings. | | |
| M8 | Verify V2's April figures reflect the year-step split on 16 April. See Appendix A §A3. | V2 April gross = **6,300.00** (3,000 at Year 1 + 3,300 at Year 2). V2 deductions = ALLOT standing 800.00. V2 net = **5,500.00**. | | |
| M9 | Verify April figures for the other working-set crew (no entries, pure scale, except V1 OT and V5 advance recovery). See Appendix A §A3 for full table. | ✓ All match. | | |
| M10 | Verify V5 (MANOJ REDDY) shows ADVR **200.00** (instalment 2 of 3). | ✓ | | |
| M11 | Verify V4 (DMITRIY SOKOLOV) is prorated for 20 days (Apr 1–20 both inclusive): BASIC = **2,000.00**, GOT = **400.00**, gross = **2,400.00**, net = **2,400.00** (no deductions in April for V4). | ✓ | | |

---

## Phase N — Settlement of V4 (DMITRIY SOKOLOV) (Office / Sail Admin)

V4's contract ended 20 April 2026 (recorded by the Master). Now the office finalises his pay-off.

### N1 — Create the settlement

Menu: **Accounts → Settlements** → **New Settlement** → select engagement for DMITRIY SOKOLOV.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| N1 | Open the settlement creation screen for V4. | The screen shows: Unpaid on-board balance, cumulative leave accrual, and a field for adjustments. | | |
| N2 | Verify the pre-filled figures: Unpaid balance = **5,050.00** (2,650 March + 2,400 April), cumulative leave accrual = **450.00** (250 March + 200 April). Subtotal = **5,500.00**. | ✓ Both figures match Appendix A §A4. | | |
| N3 | Add a settlement adjustment: element = **OTHD**, amount = `-50.00`, description = `Lost cabin key`. | Adjustment appears. Revised subtotal = 5,500.00 − 50.00 = **5,450.00**. | | |
| N4 | Submit the settlement. | Settlement status = "Submitted" (or "Awaiting approval"). | | |
| N5 | Approve the settlement (as Office — Admin, if SoD is required). | Settlement status = **Approved** (or Paid/Locked depending on workflow). V4's engagement is frozen. | | |

### N2 — Settlement-skip re-run of April

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| N6 | Run Calculation again for vessel 04, April 2026. | Run completes. V4 is **skipped** (settlement frozen — engine preserves the existing ledger lines and does not recompute). A note or banner shows "1 engagement skipped (settled)." The figures for V1, V2, V3, V5 are unchanged. | | |
| N7 | Verify April calc totals exclude V4's lines from the re-run total but the portage bill still includes V4's previously-computed lines. | ✓ Portage bill shows V4 rows from the pre-settlement run. The settlement-skip note is informational only. | | |

---

## Phase O — Reports (Office / Sail Admin)

### O1 — Payslip

Menu: **Accounts → Reports → Payslips**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O1 | Generate payslip for **AMIT SHARMA (V3)**, period **2026-03**. | Payslip shows: rank = Able Seaman, service days = 25, BASIC 2,500.00, GOT 500.00, OTV 150.00, leave accrual 250.00, gross paid 3,150.00, deductions 0.00, net 3,150.00, balance B/F 0.00, balance C/F 3,150.00. | | |
| O2 | Generate payslip for **IVAN JURIC (V2)**, period **2026-04**. | Payslip shows Year 1/Year 2 split lines: Apr 1–15 BASIC 2,500 + GOT 500; Apr 16–30 BASIC 2,750 + GOT 550. Gross 6,300.00, ALLOT deduction 800.00, net 5,500.00. | | |
| O3 | Generate payslip for **DMITRIY SOKOLOV (V4)**, period **2026-04**. | Payslip shows 20 days served (Apr 1–20). BASIC 2,000.00, GOT 400.00. Gross 2,400.00, deductions 0.00, net 2,400.00. | | |

### O2 — GL export (March 2026)

Menu: **Accounts → Reports → GL Export** → vessel 04 → March 2026.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O4 | Generate GL export for vessel 04, March 2026. | A two-column table (Debit / Credit) with GL account codes and amounts. | | |
| O5 | Verify total **Debits = total Credits = 23,725.00** (the gross payroll). | ✓ DR = CR. | | |
| O6 | Confirm GL account **5001 (BASIC)** debit total = **19,500.00** (7,000 + 5,000 + 2,500 + 2,500 + 2,500). | ✓ | | |
| O7 | Confirm GL account **5002 (GOT)** debit total = **3,900.00** (1,400 + 1,000 + 500 + 500 + 500). | ✓ | | |
| O8 | Confirm GL account **5003 (OTV)** debit total = **325.00** (175 + 150). | ✓ | | |
| O9 | Confirm GL account **2000 (Wages payable)** credit total = **21,670.00** (total net on board). | ✓ | | |
| O10 | Confirm GL account **2200 (ALLOT)** credit total = **1,400.00** (800 + 600). | ✓ | | |

### O3 — Fleet summary

Menu: **Accounts → Reports → Fleet Summary** → period **2026-03**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O11 | Generate fleet summary for March 2026. | Vessel 04 appears in the summary with its gross = 23,725.00 and net = 21,670.00. | | |

### O4 — Permissions negative test (Ship — Vessel User)

Switch to: **Ship — Vessel User (vessel 04)**.

| Step | Action | Expected result | P/F | Notes |
|---|---|---|---|---|
| O12 | Attempt to open **Accounts → Config → Wage Scales**. | Access denied (403 or the option is hidden). A Vessel User cannot see wage scale configuration. | | |
| O13 | Attempt to open **Accounts → Reports → GL Export**. | Access denied or hidden. GL export is an office-only report. | | |
| O14 | Open **Accounts → Payroll Run** → vessel 04. Attempt to run a new calculation. | The "Run Calculation" button is hidden or disabled. A Vessel User can view the portage but cannot trigger a calc run. | | |

---

## Appendix A — Worked arithmetic

### A1 — March scale values (full month, 30 days)

| Rank | BASIC | GOT | LEAVE | OTV rate |
|---|---|---|---|---|
| Master (R001) | 7,000.00 | 1,400.00 | 700.00 | 17.50/hr |
| Chief Officer Year 1 (R002) | 5,000.00 | 1,000.00 | 500.00 | 12.50/hr |
| Chief Officer Year 2 (R002) | 5,500.00 | 1,100.00 | 550.00 | 13.75/hr |
| Able Seaman (R015) | 3,000.00 | 600.00 | 300.00 | 7.50/hr |

### A2 — March 2026 full calculation (all working-set crew)

**Proration for V3, V4, V5:** sign-on 07-Mar-2026, both-inclusive, 30-day month.  
Service days = 07 Mar to 31 Mar inclusive = 31 − 7 + 1 = **25 days**. Factor = 25/30.

| Item | V1 SANJAY VERMA | V2 IVAN JURIC | V3 AMIT SHARMA | V4 DMITRIY SOKOLOV | V5 MANOJ REDDY |
|---|---|---|---|---|---|
| Service days | 30 | 30 | 25 | 25 | 25 |
| BASIC | 7,000.00 | 5,000.00 | 3,000 × 25/30 = **2,500.00** | 2,500.00 | 2,500.00 |
| GOT | 1,400.00 | 1,000.00 | 600 × 25/30 = **500.00** | 500.00 | 500.00 |
| OTV | 10 hr × 17.50 = **175.00** | — | 20 hr × 7.50 = **150.00** | — | — |
| **Gross paid** | **8,575.00** | **6,000.00** | **3,150.00** | **3,000.00** | **3,000.00** |
| ALLOT standing | — | 800.00 | — | — | — |
| ALLOT extra | — | 600.00 | — | — | — |
| Vessel advance | — | — | — | 300.00 | — |
| BOND rollup | 80.00 | — | — | 50.00 | — |
| COMM | 25.00 | — | — | — | — |
| ADVR recovery | — | — | — | — | 200.00 |
| **Total deductions** | **105.00** | **1,400.00** | **0.00** | **350.00** | **200.00** |
| **Net on board** | **8,470.00** | **4,600.00** | **3,150.00** | **2,650.00** | **2,800.00** |
| LEAVE accrual | 700 × 30/30 = **700.00** | 500 × 30/30 = **500.00** | 300 × 25/30 = **250.00** | 250.00 | 250.00 |
| Balance B/F | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| **Balance C/F** | **8,470.00** | **4,600.00** | **3,150.00** | **2,650.00** | **2,800.00** |

**March vessel totals:** Gross = 23,725.00 · Deductions = 2,055.00 · Net = 21,670.00 · Leave accrual = 1,950.00

### A3 — April 2026 full calculation (working set, before V4 settlement)

**V4 proration:** sign-off 20 Apr 2026, both-inclusive. Service = Apr 1–20 = **20 days**. Factor = 20/30.  
**V2 year-step split:** Apr 1–15 (15 days, Year 1) + Apr 16–30 (15 days, Year 2). Factor each = 15/30 = 0.5.

| Item | V1 SANJAY VERMA | V2 IVAN JURIC | V3 AMIT SHARMA | V4 DMITRIY SOKOLOV | V5 MANOJ REDDY |
|---|---|---|---|---|---|
| Service days | 30 | 30 | 30 | 20 | 30 |
| BASIC (Apr 1–15 Y1) | — | 5,000 × 0.5 = 2,500.00 | — | — | — |
| BASIC (Apr 16–30 Y2) | — | 5,500 × 0.5 = 2,750.00 | — | — | — |
| BASIC | 7,000.00 | **5,250.00** | 3,000.00 | 3,000 × 20/30 = **2,000.00** | 3,000.00 |
| GOT (Y1 half) | — | 1,000 × 0.5 = 500.00 | — | — | — |
| GOT (Y2 half) | — | 1,100 × 0.5 = 550.00 | — | — | — |
| GOT | 1,400.00 | **1,050.00** | 600.00 | 600 × 20/30 = **400.00** | 600.00 |
| OTV | 8 hr × 17.50 = **140.00** | — | — | — | — |
| **Gross paid** | **8,540.00** | **6,300.00** | **3,600.00** | **2,400.00** | **3,600.00** |
| ALLOT standing | — | 800.00 | — | — | — |
| ADVR recovery | — | — | — | — | 200.00 |
| **Total deductions** | **0.00** | **800.00** | **0.00** | **0.00** | **200.00** |
| **Net on board** | **8,540.00** | **5,500.00** | **3,600.00** | **2,400.00** | **3,400.00** |
| LEAVE accrual | 700.00 | 0.5×500+0.5×550 = **525.00** | 300.00 | 300 × 20/30 = **200.00** | 300.00 |
| Balance B/F | 8,470.00 | 4,600.00 | 3,150.00 | 2,650.00 | 2,800.00 |
| **Balance C/F** | **17,010.00** | **10,100.00** | **6,750.00** | **5,050.00** | **6,200.00** |

**April vessel totals (5 crew, pre-settlement):** Gross = 24,440.00 · Deductions = 1,000.00 · Net = 23,440.00 · Leave accrual = 2,025.00

### A4 — V4 settlement (DMITRIY SOKOLOV)

| Item | Amount |
|---|---|
| Unpaid on-board balance (B/F into settlement) | 5,050.00 |
| Cumulative leave accrual (Mar 250 + Apr 200) | 450.00 |
| **Subtotal before adjustments** | **5,500.00** |
| Adjustment: OTHD "Lost cabin key" | −50.00 |
| **Net settlement payable** | **5,450.00** |

### A5 — CBA floor violation summary

| CBA | Rank | Element | Scale value | CBA minimum | Deficit |
|---|---|---|---|---|---|
| ITF MINIMUM 2026 | Able Seaman (R015) | BASIC | 3,000.00 | 3,200.00 | **200.00** |

This is a deliberate test: the scale is below the CBA minimum. The activation prompt warns of 1 violation; the tester acknowledges and proceeds. The scale remains usable; the violation is informational only until the office decides to correct it.

---

## Appendix B — The 21 non-computing crew and the 19 in April

These crew members are active on vessel 04 in March but their ranks have no lines in VESSEL 04 SCALE 2026. They produce no-scale-line warnings (21 in March, 19 in April). They are **not** a defect; the scale deliberately covers only Master, Chief Officer, and Able Seaman to keep the test focused.

### B1 — March 2026 (21 no-scale warnings)

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

### B2 — April 2026 (19 no-scale warnings)

Same list as B1, **minus** DEDE ANDREA ISMAIL (sign-off 01-Mar-2026, not active in April) and AUNG PYONE MYINT MYAT (sign-off 08-Mar-2026, not active in April). All other 19 are present.

---

## Appendix C — The 26 active engagements in March 2026

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

> IRWAN SUBEKTI (sign-off 28-Feb-2026) is **not** in the list — the sync correctly excludes them from the March period.

---

## Defect report template

Copy one block per defect.

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
